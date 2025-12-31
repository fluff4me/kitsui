import { Component, State } from 'kitsui'

interface BreakdownPart<T> {
	state: State.Mutable<T>
	component: Component
}

interface BreakdownPartConstructor {
	(unique: unknown): Component
	(unique: unknown, initialiser: (component: Component) => unknown): Component
	<T> (unique: unknown, value: T, initialiser: (component: Component, state: State<T>) => unknown): Component
}

export default function <T> (owner: State.Owner, state: State<T>, handler: (value: T, Part: BreakdownPartConstructor, Store: Component) => unknown): void {
	const store = Component().setOwner(owner)
	const parts = new Map<unknown, BreakdownPart<unknown>>()
	const seen: Set<unknown> = new Set()
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
		const component = Component()
		initialiser?.(component, state)
		part = { state, component }
		parts.set(unique, part)
		return component
	}
	let controller: AbortController | undefined
	state.use(owner, async value => {
		seen.clear()
		controller?.abort()

		controller = new AbortController()
		const signal = controller.signal
		const InstancePart: BreakdownPartConstructor = <B> (unique: unknown, value?: B, initialiser?: (component: Component, state: State<B>) => unknown): Component => {
			if (signal.aborted)
				return Component().tweak(c => c.remove())

			return Part<B>(unique, value!, initialiser!)
		}
		await handler(value, InstancePart, store)
		if (signal.aborted)
			return

		for (const [unique, part] of parts) {
			if (!seen.has(unique)) {
				part.component.remove()
				parts.delete(unique)
			}
		}
		seen.clear()
	})
}
