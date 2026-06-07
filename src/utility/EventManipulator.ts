import type Component from 'Component'
import Arrays from 'utility/Arrays'
import type { AnyFunction } from 'utility/Functions'
import State from 'utility/State'

interface EventExtensions<HOST> {
	host: HOST
	targetComponent: Component | undefined
}

type EventParameters<HOST, EVENTS, EVENT extends keyof EVENTS> = EVENTS[EVENT] extends (...params: infer PARAMS) => unknown ? PARAMS extends [infer EVENT extends Event, ...infer PARAMS] ? [EVENT & EventExtensions<HOST>, ...PARAMS] : [Event & EventExtensions<HOST>, ...PARAMS] : never
type EventParametersEmit<EVENTS, EVENT extends keyof EVENTS> = EVENTS[EVENT] extends (...params: infer PARAMS) => unknown ? PARAMS extends [Event, ...infer PARAMS] ? PARAMS : PARAMS : never
type EventResult<EVENTS, EVENT extends keyof EVENTS> = EVENTS[EVENT] extends (...params: any[]) => infer RESULT ? RESULT : never

export interface EventDispatchImmediate<RESULT> {
	readonly deferred: false
	readonly result: RESULT[]
	readonly defaultPrevented: boolean
	readonly stoppedPropagation: boolean | 'immediate'
}

export interface EventDispatchDeferred<RESULT> {
	readonly deferred: true
	readonly result: Promise<RESULT[]>
	readonly defaultPrevented: false
	readonly stoppedPropagation: false
}

export type EventDispatchResult<RESULT> = EventDispatchImmediate<RESULT> | EventDispatchDeferred<RESULT>

export type EventHandler<HOST, EVENTS, EVENT extends keyof EVENTS> = (...params: EventParameters<HOST, EVENTS, EVENT>) => EventResult<EVENTS, EVENT>

type ResolveEvent<EVENT extends Arrays.Or<PropertyKey>> = EVENT extends PropertyKey[] ? EVENT[number] : EVENT

interface EventManipulatorSubscribe<HOST, EVENTS extends Record<string, any>> {
	subscribe<EVENT extends Arrays.Or<keyof EVENTS>> (event: EVENT, handler: EventHandler<HOST, EVENTS, ResolveEvent<EVENT> & keyof EVENTS>): HOST
	subscribeCapture<EVENT extends Arrays.Or<keyof EVENTS>> (event: EVENT, handler: EventHandler<HOST, EVENTS, ResolveEvent<EVENT> & keyof EVENTS>): HOST
	subscribePassive<EVENT extends Arrays.Or<keyof EVENTS>> (event: EVENT, handler: EventHandler<HOST, EVENTS, ResolveEvent<EVENT> & keyof EVENTS>): HOST
}

interface EventManipulatorUntilSubscribe<HOST, EVENTS extends Record<string, any>> {
	subscribe<EVENT extends Arrays.Or<keyof EVENTS>> (event: EVENT, handler: EventHandler<HOST, EVENTS, ResolveEvent<EVENT> & keyof EVENTS>): this
	subscribeCapture<EVENT extends Arrays.Or<keyof EVENTS>> (event: EVENT, handler: EventHandler<HOST, EVENTS, ResolveEvent<EVENT> & keyof EVENTS>): this
	subscribePassive<EVENT extends Arrays.Or<keyof EVENTS>> (event: EVENT, handler: EventHandler<HOST, EVENTS, ResolveEvent<EVENT> & keyof EVENTS>): this
}

interface EventManipulator<HOST, EVENTS extends Record<string, any>> extends EventManipulatorSubscribe<HOST, EVENTS> {
	emit<EVENT extends keyof EVENTS> (event: EVENT, ...params: EventParametersEmit<EVENTS, EVENT>): EventDispatchResult<EventResult<EVENTS, EVENT>>
	bubble<EVENT extends keyof EVENTS> (event: EVENT, ...params: EventParametersEmit<EVENTS, EVENT>): EventDispatchResult<EventResult<EVENTS, EVENT>>
	unsubscribe<EVENT extends Arrays.Or<keyof EVENTS>> (event: EVENT, handler: EventHandler<HOST, EVENTS, ResolveEvent<EVENT> & keyof EVENTS>): HOST
	until (owner: State.Owner, initialiser: (until: EventManipulatorUntilSubscribe<HOST, EVENTS>) => unknown): HOST
}

export type NativeEvents = { [KEY in keyof HTMLElementEventMap]: (event: KEY extends 'toggle' ? ToggleEvent : HTMLElementEventMap[KEY]) => unknown }

export type Events<HOST, EXTENSIONS extends Record<string, any>> =
	HOST extends { event: EventManipulator<any, infer EVENTS> }
	? (
		keyof EXTENSIONS extends never
		? EVENTS
		: (
			Lowercase<keyof EXTENSIONS & string> extends keyof EXTENSIONS
			? 'Custom events contain at least one uppercase letter'
			: {
				[KEY in keyof EVENTS | keyof EXTENSIONS]:
				| KEY extends keyof EVENTS ?
				| KEY extends keyof EXTENSIONS ? EVENTS[KEY] & EXTENSIONS[KEY]
				: EVENTS[KEY]
				: KEY extends keyof EXTENSIONS ? EXTENSIONS[KEY]
				: never
			}
		)
	)
	: never

interface EventDetail {
	result: any[]
	params: any[]
}

const SYMBOL_REGISTERED_FUNCTION = Symbol('REGISTERED_FUNCTION')
interface EventHandlerRegistered extends AnyFunction {
	[SYMBOL_REGISTERED_FUNCTION]?: AnyFunction
}

function isComponent (host: unknown): host is Component {
	return typeof host === 'object' && host !== null && 'isComponent' in host
}

function EventManipulator<T extends object> (host: T): EventManipulator<T, NativeEvents> {
	const elementHost = isComponent(host)
		? host
		: { element: document.createElement('span') }
	const dom = isComponent(host) ? host.__dom : undefined

	const manipulator: EventManipulator<T, NativeEvents> = {
		emit (event, ...params) {
			return dispatch(event, params, false)
		},
		bubble (event, ...params) {
			return dispatch(event, params, true)
		},
		subscribe (events, handler) {
			return subscribe(handler, events)
		},
		subscribePassive (events, handler) {
			return subscribe(handler, events, { passive: true })
		},
		subscribeCapture (events, handler) {
			return subscribe(handler, events, { capture: true })
		},
		unsubscribe (events, handler) {
			const realHandler = (handler as EventHandlerRegistered)[SYMBOL_REGISTERED_FUNCTION]
			if (!realHandler)
				return host

			delete (handler as EventHandlerRegistered)[SYMBOL_REGISTERED_FUNCTION]

			for (const event of Arrays.resolve(events))
				if (dom)
					dom.removeEventListener(event, realHandler as EventListener)
				else
					elementHost.element!.removeEventListener(event, realHandler)

			return host
		},
		until (owner, initialiser) {
			initialiser({
				subscribe (event, handler) {
					manipulator.subscribe(event, handler)
					State.Owner.getRemovedState(owner).matchManual(true, () => manipulator.unsubscribe(event, handler))
					return this
				},
				subscribeCapture (event, handler) {
					manipulator.subscribeCapture(event, handler)
					State.Owner.getRemovedState(owner).matchManual(true, () => manipulator.unsubscribe(event, handler))
					return this
				},
				subscribePassive (event, handler) {
					manipulator.subscribePassive(event, handler)
					State.Owner.getRemovedState(owner).matchManual(true, () => manipulator.unsubscribe(event, handler))
					return this
				},
			})
			return host
		},
	}

	return manipulator

	function dispatch (event: keyof NativeEvents, params: any[], bubble: boolean) {
		const run = (): EventDispatchImmediate<any> => {
			const detail: EventDetail = { result: [], params }
			let stoppedPropagation: boolean | 'immediate' = false
			let preventedDefault = false
			const eventObject = Object.assign(
				new CustomEvent(event, { detail, bubbles: bubble }),
				{
					preventDefault () {
						Event.prototype.preventDefault.call(this)
						preventedDefault ||= true
					},
					stopPropagation () {
						Event.prototype.stopPropagation.call(this)
						stoppedPropagation ||= true
					},
					stopImmediatePropagation () {
						Event.prototype.stopImmediatePropagation.call(this)
						stoppedPropagation = 'immediate'
					},
				}
			)
			const element = dom?.element ?? elementHost.element!
			element.dispatchEvent(eventObject)
			return {
				deferred: false,

				result: detail.result,
				defaultPrevented: eventObject.defaultPrevented || preventedDefault,
				stoppedPropagation,
			}
		}

		if (dom && !dom.element) {
			let resolveResult!: (result: any[]) => void
			const result = new Promise<any[]>(resolve => resolveResult = resolve)
			let resolved = false
			const resolveOnce = (result: any[]) => {
				if (resolved)
					return

				resolved = true
				resolveResult(result)
			}

			let unuseRemoved: State.Unsubscribe | undefined
			dom.queueDispatch(() => {
				unuseRemoved?.()
				resolveOnce(run().result)
			}, bubble)
			if (isComponent(host))
				unuseRemoved = host.removed.matchManual(true, () => {
					unuseRemoved?.()
					resolveOnce([])
				})

			const deferredResult: EventDispatchDeferred<any> = {
				deferred: true,
				result,
				defaultPrevented: false,
				stoppedPropagation: false,
			}
			return deferredResult
		}

		return run()
	}

	function subscribe (handler: EventHandlerRegistered, events: Arrays.Or<keyof NativeEvents>, options?: AddEventListenerOptions) {
		if (handler[SYMBOL_REGISTERED_FUNCTION]) {
			console.error(`Can't register handler for event(s) ${Arrays.resolve(events).join(', ')}, already used for other events`, handler)
			return host
		}

		const realHandler = (event: Event) => {
			const customEvent = event instanceof CustomEvent ? event : undefined
			const eventDetail = customEvent?.detail as EventDetail | undefined
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
			const result = (handler as any)(Object.assign(event, {
				host,
				targetComponent: getNearestComponent(event.target),
			} satisfies EventExtensions<any>), ...eventDetail?.params ?? [])
			eventDetail?.result.push(result)
		}

		Object.assign(handler, { [SYMBOL_REGISTERED_FUNCTION]: realHandler })

		for (const event of Arrays.resolve(events))
			if (dom)
				dom.addEventListener(event, realHandler as EventListener, options)
			else
				elementHost.element!.addEventListener(event, realHandler, options)

		return host
	}
}

function getNearestComponent (target: EventTarget | null): Component | undefined {
	if (!target || !(target instanceof Node))
		return undefined

	let node: Node | null = target
	do {
		const component = node.component
		if (component)
			return component
	}
	while ((node = node.parentNode))
}

export default EventManipulator
