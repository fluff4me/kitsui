import Component from 'Component'
import State from 'utility/State'

interface BreakdownPart<T> {
	state: State.Mutable<T>
	component: Component
	unuseInsertionSubstitute: State.Unsubscribe
}

interface BreakdownPartConstructor {
	(unique: unknown): Component
	(unique: unknown, initialiser: (component: Component) => unknown): Component
	<T> (unique: unknown, value: T, initialiser: (component: Component, state: State<T>) => unknown): Component
}

type OrderEntry =
	| { type: 'part', component: Component }
	| { type: 'node', node: Node }

class PlacementRun {

	readonly placements = new Map<Component, Comment>()

	constructor (readonly signal: AbortSignal) { }

	substitute (component: Component): Comment | undefined {
		if (this.signal.aborted)
			return

		this.placements.get(component)?.remove()
		const anchor = document.createComment('kitsui-breakdown-part')
		this.placements.set(component, anchor)
		return anchor
	}

	commit (): void {
		const parents = new Set<Element>()
		const componentByAnchor = new Map<Comment, Component>()
		const placedComponentByElement = new Map<Element, Component>()
		for (const [component, anchor] of this.placements) {
			componentByAnchor.set(anchor, component)
			const element = component.element
			if (element)
				placedComponentByElement.set(element, component)

			const parent = anchor.parentNode
			if (parent instanceof Element)
				parents.add(parent)
		}

		for (const parent of parents) {
			const oldOrder = normaliseOldOrder(parent, componentByAnchor)
			const newOrder = normaliseNewOrder(parent, componentByAnchor, placedComponentByElement)
			if (ordersEqual(oldOrder, newOrder))
				continue

			const insertedComponents = new Set<Component>()
			const insertedNodes: Node[] = []
			for (const anchor of getAnchors(parent, componentByAnchor)) {
				const component = componentByAnchor.get(anchor)
				if (!component)
					continue

				insertedComponents.add(component)
				const node = Component.getDomController(component).realiseForInsertion()
				insertedNodes.push(node)
				Component.moveBefore(parent, node, anchor)
			}

			for (const component of insertedComponents)
				component.emitInsert()
			if (parent instanceof Element && insertedNodes.length)
				parent.component?.event.emit('childrenInsert', insertedNodes)
		}

		for (const parent of parents) {
			const anchors = getAnchors(parent, componentByAnchor)
			for (let i = anchors.length - 1; i >= 0; i--)
				anchors[i].remove()
		}
	}

	cleanup (): void {
		for (const anchor of this.placements.values())
			anchor.remove()
		this.placements.clear()
	}

}

function getAnchors (parent: Element, componentByAnchor: Map<Comment, Component>): Comment[] {
	return [...parent.childNodes]
		.filter((node): node is Comment => node instanceof Comment && componentByAnchor.has(node))
}

function normaliseOldOrder (parent: Element, componentByAnchor: Map<Comment, Component>): OrderEntry[] {
	const order: OrderEntry[] = []
	for (const node of parent.childNodes) {
		if (node instanceof Comment && componentByAnchor.has(node))
			continue

		const component = node instanceof Element ? node.component : undefined
		if (component)
			order.push({ type: 'part', component })
		else
			order.push({ type: 'node', node })
	}

	return order
}

function normaliseNewOrder (parent: Element, componentByAnchor: Map<Comment, Component>, placedComponentByElement: Map<Element, Component>): OrderEntry[] {
	const order: OrderEntry[] = []
	for (const node of parent.childNodes) {
		if (node instanceof Comment) {
			const component = componentByAnchor.get(node)
			if (component) {
				order.push({ type: 'part', component })
				continue
			}
		}

		if (node instanceof Element && placedComponentByElement.has(node))
			continue

		const component = node instanceof Element ? node.component : undefined
		if (component)
			order.push({ type: 'part', component })
		else
			order.push({ type: 'node', node })
	}

	return order
}

function ordersEqual (a: OrderEntry[], b: OrderEntry[]): boolean {
	if (a.length !== b.length)
		return false

	return a.every((entry, index) => {
		const other = b[index]
		if (entry.type !== other.type)
			return false

		if (entry.type === 'part' && other.type === 'part')
			return entry.component === other.component

		return entry.type === 'node' && other.type === 'node' && entry.node === other.node
	})
}

export default function <T> (owner: State.Owner, state: State<T>, handler: (value: T, Part: BreakdownPartConstructor, Store: Component) => unknown): void {
	const store = Component().setOwner(owner)
	Component.getDomController(store).realiseForInsertion()
	const parts = new Map<unknown, BreakdownPart<unknown>>()
	const seen: Set<unknown> = new Set()
	let controller: AbortController | undefined
	let activeRun: PlacementRun | undefined
	owner.removed.matchManual(true, () => {
		controller?.abort()
		activeRun?.cleanup()
		for (const part of parts.values()) {
			part.unuseInsertionSubstitute()
			part.component.remove()
		}
		parts.clear()
		store.remove()
	})
	const Part: BreakdownPartConstructor = <B> (unique: unknown, value?: B, initialiser?: (component: Component, state: State<B>) => unknown): Component => {
		if (typeof value === 'function' && !initialiser)
			initialiser = value as NonNullable<typeof initialiser>, value = undefined

		value ??= null as B

		seen.add(unique)
		let part = parts.get(unique) as BreakdownPart<B> | undefined
		if (part) {
			part.state.value = value
			return part.component
		}

		const state = State<B>(value)
		const component = Component().setOwner(owner)
		initialiser?.(component, state)
		const unuseInsertionSubstitute = Component.substituteInsertion(component, component => activeRun?.substitute(component))
		part = { state, component, unuseInsertionSubstitute }
		parts.set(unique, part)
		return component
	}
	state.use(owner, async value => {
		seen.clear()
		controller?.abort()

		controller = new AbortController()
		const signal = controller.signal
		const run = new PlacementRun(signal)
		const InstancePart: BreakdownPartConstructor = <B> (unique: unknown, value?: B, initialiser?: (component: Component, state: State<B>) => unknown): Component => {
			if (signal.aborted)
				return Component().tweak(c => c.remove())

			return Part<B>(unique, value!, initialiser!)
		}
		try {
			activeRun = run
			try {
				await handler(value, InstancePart, store)
			}
			finally {
				if (activeRun === run)
					activeRun = undefined
			}

			if (signal.aborted)
				return

			run.commit()
			for (const [unique, part] of parts) {
				if (!seen.has(unique)) {
					part.unuseInsertionSubstitute()
					part.component.remove()
					parts.delete(unique)
				}
			}
			seen.clear()
		}
		finally {
			run.cleanup()
		}
	})
}
