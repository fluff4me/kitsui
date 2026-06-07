import Component from 'Component'
import State from 'utility/State'
import Vector2 from 'utility/Vector2'

function DragDrop<T> (id: string): DragDrop<T> {
	const active = State<DragDrop.Session<T> | undefined>(undefined)
	const targets = new Set<DragDrop.DropTarget<T>>()
	let targetOrder = 0

	const Draggable = Component.Extension<[DragDrop.DraggableInitialiser<T>], DragDrop.Draggable<T>>((component, initialiser) => {
		const config = DraggableConfig<T>()
		initialiser(config)

		const dragging = State(false)
		const dragSession = State<DragDrop.Session<T> | undefined>(undefined)
		const disabled = config.getDisabled()
		let suppressNextClick = false
		let clearSuppressNextClickTimeout: number | undefined
		let controller: AbortController | undefined
		let session: DragDrop.Session<T> | undefined
		let preview: Component | undefined

		component
			.style.setProperties({
				userSelect: 'none',
				['-webkitUserDrag' as never]: 'none',
			})
			.event.subscribe('pointerdown', event => {
				if (!(event instanceof PointerEvent) || event.button !== 0 || disabled.value)
					return

				const payload = config.getPayload()?.value
				const sourceElement = component.element
				if (payload === undefined || payload === null || !sourceElement)
					return

				const payloadValue = payload
				const start = Vector2.fromClient(event)
				const sourceRect = sourceElement.getBoundingClientRect()
				const offset = Vector2.subtract(start, sourceRect)
				let started = false
				controller?.abort()
				controller = new AbortController()

				document.addEventListener('pointermove', handleMove, { signal: controller.signal })
				document.addEventListener('pointerup', handleUp, { signal: controller.signal })
				document.addEventListener('pointercancel', handleCancel, { signal: controller.signal })

				const capture = sourceElement.setPointerCapture
				if (capture)
					try {
						capture.call(sourceElement, event.pointerId)
					}
					catch { }

				function handleMove (event: PointerEvent) {
					const pointer = Vector2.fromClient(event)
					if (!started) {
						if (Vector2.distanceWithin(config.getThreshold(), start, pointer))
							return

						started = true
						suppressNextClick = true
						clearTimeout(clearSuppressNextClickTimeout)
						startSession(pointer, payloadValue)
					}

					event.preventDefault()
					if (!session)
						return

					session.pointer.value = pointer
					updatePreview(session)
					updateTargets(session)
				}

				function handleUp (event: PointerEvent) {
					controller?.abort()
					controller = undefined
					if (!started || !session)
						return

					event.preventDefault()
					void drop(session)
				}

				function handleCancel () {
					cancelSession()
				}

				function startSession (pointer: Vector2, payload: T) {
					const pointerState = State(pointer)
					const activeTarget = State<DragDrop.DropTarget<T> | undefined>(undefined)
					const dropping = State(false)
					const nextSession: DragDrop.Session<T> = {
						id,
						payload,
						source: draggable,
						sourceRect,
						start,
						pointer: pointerState,
						offset,
						activeTarget,
						dropping,
						cancel: cancelSession,
					}
					session = nextSession

					for (const handler of config.getStartHandlers())
						handler(nextSession, payload)

					const previewFactory = config.getPreview()
					preview = previewFactory?.(nextSession, payload)
					if (preview) {
						preview
							.style.setProperties({
								position: 'fixed',
								left: '0',
								top: '0',
								width: `${sourceRect.width}px`,
								height: `${sourceRect.height}px`,
								pointerEvents: 'none',
								zIndex: '2147483647',
							})
							.appendTo(Component.getBody())
					}

					active.value = nextSession
					dragging.value = true
					dragSession.value = nextSession
					updatePreview(nextSession)
					updateTargets(nextSession)
					startAutoScroll(nextSession)
				}
			})
			.event.subscribeCapture('click', event => {
				if (!suppressNextClick)
					return

				suppressNextClick = false
				clearTimeout(clearSuppressNextClickTimeout)
				event.preventDefault()
				event.stopPropagation()
			})
			.onRemoveManual(cancelSession)

		disabled.subscribe(component, disabled => {
			if (disabled && session)
				cancelSession()
		})

		const draggable = component.extend<DragDrop.DraggableExtensions<T>>(component => ({
			dragging,
			dragSession,
			cancelDrag: () => {
				cancelSession()
				return component
			},
		}))
		return draggable

		async function drop (sessionToDrop: DragDrop.Session<T>) {
			const target = sessionToDrop.activeTarget.value
			const targetState = target && targetStateMap.get(target)
			if (!target || !targetState?.drop) {
				cancelSession()
				return
			}

			target.dragDropPending.value = true
			sessionToDrop.dropping.value = true
			try {
				await targetState.drop(sessionToDrop.payload, sessionToDrop)
			}
			finally {
				target.dragDropPending.value = false
				cancelSession()
			}
		}

		function cancelSession () {
			const hadSession = !!session
			controller?.abort()
			controller = undefined
			if (active.value === session)
				active.value = undefined

			preview?.remove()
			preview = undefined
			session = undefined
			dragging.value = false
			dragSession.value = undefined
			updateTargets()
			if (hadSession) {
				clearTimeout(clearSuppressNextClickTimeout)
				clearSuppressNextClickTimeout = window.setTimeout(() => suppressNextClick = false, 1000)
			}
		}

		function updatePreview (session: DragDrop.Session<T>) {
			if (!preview)
				return

			preview.style.setProperty('transform', `translate3d(${session.pointer.value.x - session.offset.x}px, ${session.pointer.value.y - session.offset.y}px, 0)`)
		}
	})

	const targetStateMap = new WeakMap<DragDrop.DropTarget<T>, DragDrop.DropTargetState<T>>()

	const DropTarget = Component.Extension<[DragDrop.DropTargetInitialiser<T>], DragDrop.DropTarget<T>>((component, initialiser) => {
		const config = DropTargetConfig<T>()
		initialiser(config)

		const disabled = config.getDisabled()
		const dragDropShown = State(false)
		const dragDropActive = State(false)
		const dragDropPending = State(false)
		const target = component.extend<DragDrop.DropTargetExtensions<T>>(component => ({
			dragDropShown,
			dragDropActive,
			dragDropPending,
		}))
		const state: DragDrop.DropTargetState<T> = {
			component: target,
			accepts: config.getAccepts(),
			disabled,
			drop: config.getDrop(),
			order: targetOrder++,
			priority: config.getPriority(),
		}
		targetStateMap.set(target, state)
		targets.add(target)
		target.onRemoveManual(() => {
			targets.delete(target)
			targetStateMap.delete(target)
			updateTargets(active.value)
		})
		disabled.subscribe(target, () => updateTargets(active.value))
		active.subscribe(target, session => updateTargetDisplay(target, session))
		return target
	})

	return {
		id,
		active,
		Draggable,
		DropTarget,
	}

	function updateTargets (session = active.value) {
		const activeTarget = session && getActiveTarget(session)
		for (const target of targets)
			updateTargetDisplay(target, session, activeTarget)

		if (session)
			session.activeTarget.value = activeTarget
	}

	function updateTargetDisplay (target: DragDrop.DropTarget<T>, session = active.value, activeTarget = session?.activeTarget.value) {
		const shown = !!session && isTargetEligible(target, session)
		target.dragDropShown.value = shown
		target.dragDropActive.value = shown && target === activeTarget
	}

	function getActiveTarget (session: DragDrop.Session<T>): DragDrop.DropTarget<T> | undefined {
		const pointer = session.pointer.value
		return [...targets]
			.filter(target => {
				if (!isTargetEligible(target, session))
					return false

				const rect = target.element?.getBoundingClientRect()
				return !!rect
					&& pointer.x >= rect.left
					&& pointer.x <= rect.right
					&& pointer.y >= rect.top
					&& pointer.y <= rect.bottom
			})
			.sort((a, b) => {
				const aState = targetStateMap.get(a)
				const bState = targetStateMap.get(b)
				const priority = (bState?.priority ?? 0) - (aState?.priority ?? 0)
				if (priority)
					return priority

				const depth = getDepth(b) - getDepth(a)
				if (depth)
					return depth

				return (bState?.order ?? 0) - (aState?.order ?? 0)
			})
			[0]
	}

	function isTargetEligible (target: DragDrop.DropTarget<T>, session: DragDrop.Session<T>) {
		const state = targetStateMap.get(target)
		if (!state || state.disabled.value || !target.element || target === session.source as Component)
			return false

		return state.accepts?.(session.payload, session) ?? true
	}

	function getDepth (component: Component) {
		let depth = 0
		let cursor: HTMLElement | null | undefined = component.element
		while ((cursor = cursor?.parentElement ?? null))
			depth++

		return depth
	}

	function startAutoScroll (session: DragDrop.Session<T>) {
		const margin = 72
		const maxSpeed = 28
		const scroll = () => {
			if (active.value !== session)
				return

			const { y } = session.pointer.value
			const height = window.innerHeight
			const top = y < margin ? -((margin - y) / margin) : 0
			const bottom = y > height - margin ? (y - (height - margin)) / margin : 0
			const delta = Math.round((top + bottom) * maxSpeed)
			if (delta) {
				window.scrollBy(0, delta)
				updateTargets(session)
			}

			requestAnimationFrame(scroll)
		}
		requestAnimationFrame(scroll)
	}
}

function DraggableConfig<T> (): DragDrop.DraggableConfig<T> & {
	getPayload (): State<T | undefined | null> | undefined
	getDisabled (): State<boolean>
	getThreshold (): number
	getPreview (): DragDrop.PreviewFactory<T> | undefined
	getStartHandlers (): DragDrop.StartHandler<T>[]
} {
	let payloadState: State<T | undefined | null> | undefined
	let disabledState: State<boolean> = State(false)
	let thresholdPx = 6
	let previewFactory: DragDrop.PreviewFactory<T> | undefined
	const startHandlers: DragDrop.StartHandler<T>[] = []
	return {
		payload (state) {
			payloadState = state
			return this
		},
		disabledWhen (state) {
			disabledState = State.get(state)
			return this
		},
		threshold (threshold) {
			thresholdPx = threshold
			return this
		},
		preview (factory) {
			previewFactory = factory
			return this
		},
		onStart (handler) {
			startHandlers.push(handler)
			return this
		},
		getPayload: () => payloadState,
		getDisabled: () => disabledState,
		getThreshold: () => thresholdPx,
		getPreview: () => previewFactory,
		getStartHandlers: () => startHandlers,
	}
}

function DropTargetConfig<T> (): DragDrop.DropTargetConfig<T> & {
	getAccepts (): DragDrop.Accepts<T> | undefined
	getDisabled (): State<boolean>
	getDrop (): DragDrop.DropHandler<T> | undefined
	getPriority (): number
} {
	let accepts: DragDrop.Accepts<T> | undefined
	let disabledState: State<boolean> = State(false)
	let dropHandler: DragDrop.DropHandler<T> | undefined
	let priorityValue = 0
	return {
		accepts (predicate) {
			accepts = predicate
			return this
		},
		disabledWhen (state) {
			disabledState = State.get(state)
			return this
		},
		drop (handler) {
			dropHandler = handler
			return this
		},
		priority (priority) {
			priorityValue = priority
			return this
		},
		getAccepts: () => accepts,
		getDisabled: () => disabledState,
		getDrop: () => dropHandler,
		getPriority: () => priorityValue,
	}
}

namespace DragDrop {
	export interface Session<T> {
		readonly id: string
		readonly payload: T
		readonly source: Draggable<T>
		readonly sourceRect: DOMRect
		readonly start: Vector2
		readonly pointer: State.Mutable<Vector2>
		readonly offset: Vector2
		readonly activeTarget: State.Mutable<DropTarget<T> | undefined>
		readonly dropping: State.Mutable<boolean>
		cancel (): void
	}

	export type PreviewFactory<T> = (session: Session<T>, payload: T) => Component | undefined
	export type StartHandler<T> = (session: Session<T>, payload: T) => unknown
	export type Accepts<T> = (payload: T, session: Session<T>) => boolean
	export type DropHandler<T> = (payload: T, session: Session<T>) => unknown | Promise<unknown>

	export interface DraggableConfig<T> {
		payload (state: State<T>): this
		payload (state: State<T | undefined | null>): this
		disabledWhen (state: State.Or<boolean>): this
		threshold (threshold: number): this
		preview (factory: PreviewFactory<T>): this
		onStart (handler: StartHandler<T>): this
	}

	export interface DropTargetConfig<T> {
		accepts (predicate: Accepts<T>): this
		disabledWhen (state: State.Or<boolean>): this
		drop (handler: DropHandler<T>): this
		priority (priority: number): this
	}

	export type DraggableInitialiser<T> = (drag: DraggableConfig<T>) => unknown
	export type DropTargetInitialiser<T> = (target: DropTargetConfig<T>) => unknown

	export interface DraggableExtensions<T> {
		readonly dragging: State<boolean>
		readonly dragSession: State<Session<T> | undefined>
		cancelDrag (): this
	}

	export interface DropTargetExtensions<T> {
		readonly dragDropShown: State.Mutable<boolean>
		readonly dragDropActive: State.Mutable<boolean>
		readonly dragDropPending: State.Mutable<boolean>
	}

	export interface Draggable<T> extends Component, DraggableExtensions<T> { }
	export interface DropTarget<T> extends Component, DropTargetExtensions<T> { }

	export interface DropTargetState<T> {
		component: DropTarget<T>
		accepts?: Accepts<T>
		disabled: State<boolean>
		drop?: DropHandler<T>
		order: number
		priority: number
	}
}

interface DragDrop<T> {
	readonly id: string
	readonly active: State<DragDrop.Session<T> | undefined>
	readonly Draggable: Component.Extension<[DragDrop.DraggableInitialiser<T>], DragDrop.Draggable<T>>
	readonly DropTarget: Component.Extension<[DragDrop.DropTargetInitialiser<T>], DragDrop.DropTarget<T>>
}

export default DragDrop
