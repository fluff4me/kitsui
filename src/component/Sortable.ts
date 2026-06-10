import type { ComponentEvents } from 'Component'
import Component from 'Component'
import Breakdown from 'component/Breakdown'
import State from 'utility/State'

interface SortableEvents<T> extends ComponentEvents {
	commit (event: Sortable.CommitEvent<T>): unknown
}

interface SortableExtensions<T> {
	readonly rows: State<readonly T[]>
}

interface Sortable<T> extends Component.WithEvents<SortableEvents<T>>, SortableExtensions<T> {
}

interface SortableRowState<T> {
	readonly row: T
	readonly index: number
}

interface SortablePayload<T> {
	readonly key: unknown
	readonly row: T
	readonly index: number
}

interface AutoScrollSession {
	readonly part: Component
	readonly sourceElement: HTMLElement
	readonly grabOffset: { x: number, y: number }
	readonly sourceKey: unknown
	readonly pointer: { x: number, y: number }
}

interface SortableOptions<T> {
	/** Optional method to determine if a row is draggable */
	draggable?(row: T, index: number): boolean
	/** Optional method to determine if a row is droppable */
	droppable?(row: T, index: number): boolean
	/** Optional method to filter input events */
	inputFilter?(event: PointerEvent, row: T, index: number): boolean
}

const POINTER_THRESHOLD = 6
const AUTO_SCROLL_THRESHOLD = 36
const AUTO_SCROLL_MAX_SPEED = 18

const SortableImplementation = Component.Builder(<T> (
	component: Component,
	rowsInput: readonly T[] | State<readonly T[]>,
	key: (row: T) => unknown,
	render: (row: State<T>, index: State<number>) => Component,
	options?: SortableOptions<T>,
): Sortable<T> => {
	component.style('sortable' as never)

	const ownsRows = !State.is(rowsInput)
	const rows = State.is<readonly T[]>(rowsInput) ? rowsInput : State<readonly T[]>(rowsInput)
	const mutableRows = ownsRows ? rows as State.Mutable<readonly T[]> : undefined
	const movingKey = State<unknown | undefined>(undefined)
	const elementKeys = new WeakMap<Element, unknown>()
	const componentKeys = new WeakMap<Component, unknown>()

	let slot: Component | undefined
	let movingPart: Component | undefined
	let pointerController: AbortController | undefined
	let dragOrder: unknown[] | undefined
	let autoScrollFrame: number | undefined
	let autoScrollSession: AutoScrollSession | undefined

	Breakdown(component, rows, (rows, Part) => {
		const keyedRows = rows.map((row, index) => ({
			key: key(row),
			row,
			index,
		}))

		for (const keyedRow of keyedRows) {
			const rowPart = Part<SortableRowState<T>>(keyedRow.key, {
				row: keyedRow.row,
				index: keyedRow.index,
			}, (part, state) => {
				const row = state.map(part, state => state.row)
				const index = state.map(part, state => state.index)
				const draggable = State.Map(part, [row, index], (row, index) => options?.draggable?.(row, index) ?? true)
				const droppable = State.Map(part, [row, index], (row, index) => options?.droppable?.(row, index) ?? true)
				const payload = State.Map(part, [row, index], (row, index): SortablePayload<T> => ({
					key: key(row),
					row,
					index,
				}))

				const rendered = render(row, index).appendTo(part)
				componentKeys.set(part, keyedRow.key)
				part.onRealise(part => {
					if (part.element)
						elementKeys.set(part.element, keyedRow.key)
				})
				rendered.style.bind(movingKey.map(part, key => key === payload.value.key), 'sortable-row-child--moving' as never)

				part.style('sortable-row' as never)
					.style.bind(draggable, 'sortable-row--draggable' as never)
					.style.bind(droppable, 'sortable-row--droppable' as never)
					.style.bind(movingKey.map(part, key => key === payload.value.key), 'sortable-row--moving-source' as never)
					.tabIndex(draggable.value ? 'auto' : undefined)
					.event.subscribe('pointerdown', event => {
						if (!(event instanceof PointerEvent) || event.button !== 0 || !draggable.value)
							return
						if (options?.inputFilter?.(event, row.value, index.value) === false)
							return

						startPointerSort(part, event, payload.value)
					})
					.event.subscribe('keydown', event => {
						if (event.target !== part.element || !draggable.value)
							return

						const direction = event.key === 'ArrowUp' || event.key === 'ArrowLeft'
							? 'before'
							: event.key === 'ArrowDown' || event.key === 'ArrowRight'
								? 'after'
								: undefined
						if (!direction)
							return

						const target = findKeyboardTarget(payload.value.key, direction)
						if (!target)
							return

						event.preventDefault()
						commitDirectReorder(payload.value.key, target.key, direction)
						window.setTimeout(() => part.focus())
					})
					.event.subscribeCapture('click', event => {
						if (!part.element?.hasAttribute('data-sortable-suppress-click'))
							return

						part.element.removeAttribute('data-sortable-suppress-click')
						event.preventDefault()
						event.stopPropagation()
					})

				draggable.subscribe(part, draggable => part.tabIndex(draggable ? 'auto' : undefined))
			})
			rowPart.appendTo(component)
		}
	})

	function startPointerSort (part: Component, event: PointerEvent, payload: SortablePayload<T>) {
		const host = component.element
		const element = part.element
		if (!host || !element)
			return
		const sourceElement = element

		const start = pointFromPointer(event)
		const sourceRect = element.getBoundingClientRect()
		const grabOffset = {
			x: start.x - sourceRect.left,
			y: start.y - sourceRect.top,
		}
		const savedPosition = positionFromPointer(start, grabOffset)
		dragOrder = rows.value.map(row => key(row))
		let started = false

		pointerController?.abort()
		pointerController = new AbortController()

		document.addEventListener('pointermove', handleMove, { signal: pointerController.signal })
		document.addEventListener('pointerup', handleUp, { signal: pointerController.signal })
		document.addEventListener('pointercancel', handleCancel, { signal: pointerController.signal })

		try {
			element.setPointerCapture(event.pointerId)
		}
		catch { }

		function handleMove (event: PointerEvent) {
			const pointer = pointFromPointer(event)
			const delta = {
				x: pointer.x - start.x,
				y: pointer.y - start.y,
			}
			if (!started) {
				if (Math.hypot(delta.x, delta.y) <= POINTER_THRESHOLD)
					return

				started = true
				beginMoving(part, sourceRect, savedPosition, payload.key)
			}

			event.preventDefault()
			moveMovingPart(part, sourceElement, grabOffset, pointer, payload.key)
			updateAutoScroll({
				part,
				sourceElement,
				grabOffset,
				sourceKey: payload.key,
				pointer,
			})
		}

		function handleUp (event: PointerEvent) {
			pointerController?.abort()
			pointerController = undefined
			if (!started)
				return

			event.preventDefault()
			part.element?.setAttribute('data-sortable-suppress-click', 'true')
			commitSlotReorder(payload.key)
			cleanupPointerSort()
		}

		function handleCancel () {
			cleanupPointerSort()
		}
	}

	function beginMoving (part: Component, sourceRect: DOMRect, savedPosition: { x: number, y: number }, sourceKey: unknown) {
		cleanupMovingState()

		const host = component.element
		const element = part.element
		if (!host || !element)
			return

		slot = Component()
			.style('sortable-slot' as never)
			.style.setProperties({
				height: `${sourceRect.height}px`,
				width: `${sourceRect.width}px`,
			})
		host.insertBefore(Component.realise(slot), element)

		movingPart = part
		movingKey.value = sourceKey
		part.style('sortable-row--moving' as never)
			.style.setProperties({
				left: `${savedPosition.x}px`,
				top: `${savedPosition.y}px`,
				width: `${sourceRect.width}px`,
			})
	}

	function moveMovingPart (
		part: Component,
		sourceElement: HTMLElement,
		grabOffset: { x: number, y: number },
		pointer: { x: number, y: number },
		sourceKey: unknown,
	) {
		const position = positionFromPointer(pointer, grabOffset)
		part.style.setProperties({
			left: `${position.x}px`,
			top: `${position.y}px`,
		})
		moveSlot(sourceElement, position, sourceKey)
		return position
	}

	function positionFromPointer (pointer: { x: number, y: number }, grabOffset: { x: number, y: number }) {
		const host = component.element
		const hostRect = host?.getBoundingClientRect()
		if (!host || !hostRect)
			return {
				x: 0,
				y: 0,
			}

		return {
			x: pointer.x - hostRect.left + host.scrollLeft - grabOffset.x,
			y: pointer.y - hostRect.top + host.scrollTop - grabOffset.y,
		}
	}

	function moveSlot (sourceElement: HTMLElement, position: { x: number, y: number }, sourceKey: unknown) {
		const host = component.element
		const slotElement = slot?.element
		if (!host || !slotElement)
			return

		const before = findItemBefore(sourceElement, position, [...host.children] as HTMLElement[])
		host.insertBefore(slotElement, !before ? host.firstElementChild : before.nextElementSibling)
		const beforeKey = before && keyForElement(before)
		if (before && beforeKey === undefined)
			return

		updateDragOrder(sourceKey, beforeKey)
	}

	function updateDragOrder (sourceKey: unknown, beforeKey: unknown) {
		const order = [...dragOrder ?? rows.value.map(row => key(row))]
			.filter(key => key !== sourceKey)
		const insertIndex = beforeKey === undefined
			? 0
			: order.indexOf(beforeKey) + 1
		order.splice(Math.max(0, insertIndex), 0, sourceKey)
		dragOrder = order
	}

	function keyForElement (element: Element) {
		const component = Component.get(element)
		return elementKeys.get(element)
			?? (component && componentKeys.get(component))
	}

	function updateAutoScroll (session: AutoScrollSession) {
		autoScrollSession = session
		if (autoScrollFrame !== undefined)
			return

		autoScrollFrame = requestAnimationFrame(autoScroll)
	}

	function autoScroll () {
		autoScrollFrame = undefined
		const session = autoScrollSession
		const scrollContainer = findScrollContainer(component.element)
		if (!session || !scrollContainer)
			return

		const rect = scrollContainer.getBoundingClientRect()
		const topDistance = session.pointer.y - rect.top
		const bottomDistance = rect.bottom - session.pointer.y
		const scrollDelta = topDistance < AUTO_SCROLL_THRESHOLD
			? -autoScrollSpeed(topDistance)
			: bottomDistance < AUTO_SCROLL_THRESHOLD
				? autoScrollSpeed(bottomDistance)
				: 0
		if (!scrollDelta)
			return

		scrollContainer.scrollBy({ top: scrollDelta })
		moveMovingPart(session.part, session.sourceElement, session.grabOffset, session.pointer, session.sourceKey)
		autoScrollFrame = requestAnimationFrame(autoScroll)
	}

	function autoScrollSpeed (distance: number) {
		const intensity = Math.max(0, Math.min(1, (AUTO_SCROLL_THRESHOLD - distance) / AUTO_SCROLL_THRESHOLD))
		return Math.ceil(intensity * AUTO_SCROLL_MAX_SPEED)
	}

	function findScrollContainer (element?: Element | null) {
		for (let parent = element instanceof HTMLElement ? element : element?.parentElement; parent; parent = parent.parentElement) {
			const style = getComputedStyle(parent)
			if (!/(auto|scroll|overlay)/.test(`${style.overflow}${style.overflowY}`))
				continue

			if (parent.scrollHeight > parent.clientHeight)
				return parent
		}

		return document.scrollingElement as HTMLElement | null
	}

	function cleanupAutoScroll () {
		if (autoScrollFrame !== undefined)
			cancelAnimationFrame(autoScrollFrame)
		autoScrollFrame = undefined
		autoScrollSession = undefined
	}

	function findItemBefore (sourceElement: HTMLElement, position: { x: number, y: number }, children: HTMLElement[]) {
		const hostBox = component.element?.getBoundingClientRect()
		if (!hostBox)
			return
		const hostScrollLeft = component.element?.scrollLeft ?? 0
		const hostScrollTop = component.element?.scrollTop ?? 0

		let lastTop: number | undefined
		const firstRealIndex = children.findIndex(child => child !== sourceElement && child !== slot?.element)
		for (let i = 0; i < children.length; i++) {
			const child = children[i]
			if (child === sourceElement || child === slot?.element)
				continue

			let { left, top, width, height } = child.getBoundingClientRect()
			left = left - hostBox.left + hostScrollLeft
			top = top - hostBox.top + hostScrollTop

			if (i === firstRealIndex) {
				if (position.y < top)
					return

				if (position.x < left && position.y < top + height)
					return
			}

			if (lastTop !== undefined && lastTop !== top) {
				if (position.y < top)
					return findPreviousRealChild(children, i - 1, sourceElement)

				if (position.y >= top && position.y < top + height && position.x < left)
					return findPreviousRealChild(children, i - 1, sourceElement)
			}

			lastTop = top

			if (position.x >= left && position.x < left + width && position.y >= top && position.y < top + height)
				return child
		}

		return findPreviousRealChild(children, children.length - 1, sourceElement)
	}

	function findPreviousRealChild (children: HTMLElement[], startIndex: number, sourceElement: HTMLElement) {
		for (let i = startIndex; i >= 0; i--) {
			const child = children[i]
			if (child !== sourceElement && child !== slot?.element)
				return child
		}
	}

	function cleanupPointerSort () {
		pointerController?.abort()
		pointerController = undefined
		cleanupMovingState()
	}

	function cleanupMovingState () {
		movingPart?.style.remove('sortable-row--moving' as never)
		movingPart?.style.removeProperties('left', 'top', 'width')
		movingPart = undefined
		slot?.remove()
		slot = undefined
		movingKey.value = undefined
		dragOrder = undefined
		cleanupAutoScroll()
	}

	function commitSlotReorder (sourceKey: unknown) {
		if (sourceKey === undefined)
			return

		const oldRows = rows.value
		const entries = oldRows.map((row, index) => ({
			key: key(row),
			row,
			index,
		}))
		const source = entries.find(entry => entry.key === sourceKey)
		if (!source)
			return

		const order = dragOrder ?? entries.map(entry => entry.key)
		if (order.length !== entries.length || order.filter(key => key === sourceKey).length !== 1)
			return

		const entriesByKey = new Map(entries.map(entry => [entry.key, entry]))
		const nextEntries = order
			.map(key => entriesByKey.get(key))
			.filter((entry): entry is SortablePayload<T> => !!entry)
		if (nextEntries.length !== entries.length)
			return
		const nextRows = nextEntries.map(entry => entry.row)

		if (arraysEqual(oldRows, nextRows))
			return

		emitCommit(oldRows, nextRows, source, nextEntries.findIndex(entry => entry === source))
	}

	function commitDirectReorder (sourceKey: unknown, targetKeyValue: unknown, position: 'before' | 'after') {
		if (targetKeyValue === undefined || sourceKey === targetKeyValue)
			return

		const oldRows = rows.value
		const entries = oldRows.map((row, index) => ({
			key: key(row),
			row,
			index,
		}))
		const source = entries.find(entry => entry.key === sourceKey)
		const target = entries.find(entry => entry.key === targetKeyValue)
		if (!source || !target)
			return

		const nextEntries = entries.filter(entry => entry !== source)
		const targetIndex = nextEntries.findIndex(entry => entry === target)
		if (targetIndex === -1)
			return

		const insertIndex = targetIndex + (position === 'after' ? 1 : 0)
		nextEntries.splice(insertIndex, 0, source)
		const nextRows = nextEntries.map(entry => entry.row)

		if (arraysEqual(oldRows, nextRows))
			return

		emitCommit(oldRows, nextRows, source, nextEntries.findIndex(entry => entry === source))
	}

	function emitCommit (oldRows: readonly T[], nextRows: readonly T[], source: SortablePayload<T>, toIndex: number) {
		const event: Sortable.CommitEvent<T> = {
			rows: nextRows,
			oldRows,
			item: source.row,
			fromIndex: source.index,
			toIndex,
		}
		if (!component.event.emit('commit' as never, event as never).defaultPrevented)
			mutableRows?.setValue(nextRows)
	}

	function arraysEqual (a: readonly T[], b: readonly T[]) {
		return a.length === b.length && a.every((value, index) => value === b[index])
	}

	function findKeyboardTarget (sourceKey: unknown, position: 'before' | 'after') {
		const entries = rows.value.map((row, index) => ({
			key: key(row),
			row,
			index,
		}))
		const sourceIndex = entries.findIndex(entry => entry.key === sourceKey)
		if (sourceIndex === -1)
			return

		const step = position === 'before' ? -1 : 1
		for (let i = sourceIndex + step; i >= 0 && i < entries.length; i += step)
			if (options?.droppable?.(entries[i].row, entries[i].index) ?? true)
				return entries[i]
	}

	return component.extend<SortableExtensions<T>>(() => ({
		rows,
		event: component.event as never,
	}))
}).setName('Sortable')

function pointFromPointer (event: PointerEvent) {
	return {
		x: event.clientX,
		y: event.clientY,
	}
}

namespace Sortable {
	export type Params<T> = [
		rowsInput: readonly T[] | State<readonly T[]>,
		key: (row: T) => unknown,
		render: (row: State<T>, index: State<number>) => Component,
		options?: SortableOptions<T>,
	]

	export interface Builder extends Omit<Component.Builder<Params<unknown>, Sortable<unknown>>, 'from'> {
		<T> (...params: Params<T>): Sortable<T>
		from<COMPONENT extends Component, T> (component: COMPONENT | undefined, ...params: Params<T>): COMPONENT & Sortable<T>
	}

	export interface CommitEvent<T> {
		readonly rows: readonly T[]
		readonly oldRows: readonly T[]
		readonly item: T
		readonly fromIndex: number
		readonly toIndex: number
	}
}

const Sortable = SortableImplementation as never as Sortable.Builder

export default Sortable
