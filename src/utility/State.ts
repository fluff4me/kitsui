import Arrays, { NonNullish as FilterNonNullish } from 'utility/Arrays'
import type { SupplierOr } from 'utility/Functions'
import Functions from 'utility/Functions'
import type { Mutable as MakeMutable } from 'utility/Objects'
import { DefineMagic, DefineProperty, mutable } from 'utility/Objects'

interface State<T, E = T> {
	readonly isState: true
	readonly value: T

	readonly comparator: <V extends T>(value: V) => boolean

	id?: string
	setId (id: string): this

	/** Subscribe to state change events. Receive the initial state as an event. */
	use (owner: State.Owner, subscriber: (value: E, oldValue: E | undefined, owner: State.Owner) => unknown): State.Unsubscribe
	useManual (subscriber: (value: E, oldValue: E | undefined, owner: State.Owner) => unknown): State.Unsubscribe
	/** Subscribe to state change events. The initial state is not sent as an event. */
	subscribe (owner: State.Owner, subscriber: (value: E, oldValue?: E) => unknown): State.Unsubscribe
	subscribeManual (subscriber: (value: E, oldValue?: E) => unknown): State.Unsubscribe
	unsubscribe (subscriber: (value: E, oldValue?: E) => unknown): void
	emit (oldValue?: E): void
	match<R extends Arrays.Or<T>> (owner: State.Owner, value: R, then: (value: R extends (infer R)[] ? R : R) => unknown): State.Unsubscribe
	matchManual<R extends Arrays.Or<T>> (value: R, then: (value: R extends (infer R)[] ? R : R) => unknown): State.Unsubscribe
	await (owner: State.Owner, value: T): Promise<T>

	map<R> (owner: State.Owner, mapper: (value: T) => State.Or<R>, equals?: State.ComparatorFunction<R>): State.Generator<R>
	mapManual<R> (mapper: (value: T) => State.Or<R>, equals?: State.ComparatorFunction<R>): State.Generator<R>
	nonNullish: State.Generator<boolean>
	truthy: State.Generator<boolean>
	falsy: State.Generator<boolean>
	not: State.Generator<boolean>
	equals (value: T): State.Generator<boolean>
	coalesce<R> (right: State.Or<R>): State.Generator<Exclude<T, null | undefined> | R>

	delay (owner: State.Owner, delay: SupplierOr<number, [T]>, mapper?: null, equals?: State.ComparatorFunction<T>): State<T>
	delay<R> (owner: State.Owner, delay: SupplierOr<number, [T]>, mapper: (value: T) => State.Or<R>, equals?: State.ComparatorFunction<R>): State<R>

	asMutable?: MutableState<T>
}

interface MutableStateSimple<T> extends State<T> {
	value: T
}

interface MutableState<T> extends MutableStateSimple<T> {
	setValue (value: T): this
	bind (owner: State.Owner, state: State<T>): State.Unsubscribe
	bindManual (state: State<T>): State.Unsubscribe
}

// const SYMBOL_UNSUBSCRIBE = Symbol('UNSUBSCRIBE')
// interface SubscriberFunction<T> {
// 	(value: T, oldValue: T): unknown
// 	[SYMBOL_UNSUBSCRIBE]?: Set<() => void>
// }

const SYMBOL_VALUE = Symbol('VALUE')
const SYMBOL_SUBSCRIBERS = Symbol('SUBSCRIBERS')
interface InternalState<T> {
	[SYMBOL_VALUE]: T
	[SYMBOL_SUBSCRIBERS]: ((value: unknown, oldValue: unknown) => unknown)[]
}

function State<T> (defaultValue: T, comparator?: State.ComparatorFunction<T>): State.Mutable<T> {
	let unuseBoundState: State.Unsubscribe | undefined
	let equalsMap: Map<T, State.Generator<boolean>> | undefined
	const result: MakeMutable<State.Mutable<T>> & InternalState<T> = {
		isState: true,
		setId (id) {
			result.id = id
			return result
		},
		[SYMBOL_VALUE]: defaultValue,
		[SYMBOL_SUBSCRIBERS]: [],
		get value () {
			return result[SYMBOL_VALUE]
		},
		set value (value: T) {
			unuseBoundState?.()
			setValue(value)
		},
		setValue (value) {
			unuseBoundState?.()
			setValue(value)
			return result
		},
		comparator: value => comparator === false ? false
			: result[SYMBOL_VALUE] === value || comparator?.(result[SYMBOL_VALUE], value) || false,
		emit: oldValue => {
			if (result.id !== undefined)
				console.log('emit', result.id)

			for (const subscriber of result[SYMBOL_SUBSCRIBERS].slice())
				subscriber(result[SYMBOL_VALUE], oldValue)

			return result
		},
		bind (owner, state) {
			if (state.id)
				console.log('bind', state.id)
			unuseBoundState?.()
			unuseBoundState = state.use(owner, setValue)
			return unuseBoundState
		},
		bindManual (state) {
			if (state.id)
				console.log('bind', state.id)
			unuseBoundState?.()
			unuseBoundState = state.useManual(setValue)
			return unuseBoundState
		},
		use: (owner, subscriber) => {
			let subOwner: State.Owner.Removable | undefined
			result.subscribe(owner, executeSubscriber)
			executeSubscriber(result[SYMBOL_VALUE], undefined)
			return () => result.unsubscribe(executeSubscriber)

			function executeSubscriber (value: T, oldValue: T | undefined) {
				subOwner?.remove(); subOwner = State.Owner.create()
				subscriber(value, oldValue, subOwner)
			}
		},
		useManual: subscriber => {
			let subOwner: State.Owner.Removable | undefined
			result.subscribeManual(executeSubscriber)
			executeSubscriber(result[SYMBOL_VALUE], undefined)
			return () => result.unsubscribe(executeSubscriber)

			function executeSubscriber (value: T, oldValue: T | undefined) {
				subOwner?.remove(); subOwner = State.Owner.create()
				subscriber(value, oldValue, subOwner)
			}
		},
		subscribe: (owner, subscriber) => {
			const ownerClosedState = State.Owner.getRemovedState(owner)
			if (!ownerClosedState || ownerClosedState.value)
				return Functions.NO_OP

			function cleanup () {
				ownerClosedState.unsubscribe(cleanup)
				result.unsubscribe(subscriber)
				// fn[SYMBOL_UNSUBSCRIBE]?.delete(cleanup)
			}

			State.OwnerMetadata.setHasSubscriptions(owner)
			// const fn = subscriber as SubscriberFunction<T>
			// fn[SYMBOL_UNSUBSCRIBE] ??= new Set()
			// fn[SYMBOL_UNSUBSCRIBE].add(cleanup)
			ownerClosedState.subscribeManual(cleanup)
			result.subscribeManual(subscriber)
			return cleanup
		},
		subscribeManual: subscriber => {
			result[SYMBOL_SUBSCRIBERS].push(subscriber as never)
			return () => result.unsubscribe(subscriber)
		},
		unsubscribe: subscriber => {
			Arrays.filterInPlace(result[SYMBOL_SUBSCRIBERS], s => s !== subscriber)
			return result
		},
		match (owner, values, then) {
			return result.use(owner, function awaitValue (newValue) {
				if (newValue !== values && (!Array.isArray(values) || !values.includes(newValue)))
					return

				result.unsubscribe(awaitValue)
				then(newValue as never)
			})
		},
		matchManual (values, then) {
			return result.useManual(function awaitValue (newValue) {
				if (newValue !== values && (!Array.isArray(values) || !values.includes(newValue)))
					return

				result.unsubscribe(awaitValue)
				then(newValue as never)
			})
		},
		await (owner, value) {
			return new Promise<T>(resolve =>
				result.match(owner, value, () => { resolve(result.value) })
			)
		},

		map: (owner, mapper, equals) => State.Map(owner, [result], mapper, equals),
		mapManual: (mapper, equals) => State.MapManual([result], mapper, equals),
		get nonNullish () {
			return DefineProperty(result, 'nonNullish', State
				.Generator(() => result.value !== undefined && result.value !== null)
				.observeManual(result))
		},
		get truthy () {
			return DefineProperty(result, 'truthy', State
				.Generator(() => !!result.value)
				.observeManual(result))
		},
		get not () {
			return getNot()
		},
		get falsy () {
			return getNot()
		},
		equals (value) {
			equalsMap ??= new Map()
			let equalsResult = equalsMap.get(value)
			if (equalsResult === undefined)
				equalsMap.set(value, equalsResult = State.Generator(() => result.value === value).observeManual(result))
			return equalsResult
		},
		coalesce (right) {
			const rightState = State.get(right)
			return State.Generator(() => {
				const leftValue = result.value
				if (leftValue !== undefined && leftValue !== null)
					return leftValue as Exclude<T, null | undefined>

				return rightState.value
			}).observeManual(result, rightState)
		},
		delay (owner: State.Owner, delay: SupplierOr<number, [T]>, mapper?: null | ((value: T) => State.Or<any>), equals?: State.ComparatorFunction<any>) {
			const delayed = State(!mapper ? result.value : mapper(result.value), equals)
			let timeout: number | undefined
			result.subscribe(owner, value => {
				window.clearTimeout(timeout)

				const ms = Functions.resolve(delay, value)
				if (!ms)
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					return delayed.value = !mapper ? value : mapper(value)

				timeout = window.setTimeout(() => {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					delayed.value = !mapper ? value : mapper(value)
				}, ms)
			})
			return delayed
		},
	}
	result.asMutable = result
	return result // Objects.stringify.disable(result)

	function setValue (value: T) {
		if (comparator !== false && (result[SYMBOL_VALUE] === value || comparator?.(result[SYMBOL_VALUE], value)))
			return

		const oldValue = result[SYMBOL_VALUE]
		result[SYMBOL_VALUE] = value
		result.emit(oldValue)
	}

	function getNot () {
		const not = State
			.Generator(() => !result.value)
			.observeManual(result)
		DefineProperty(result, 'not', not)
		DefineProperty(result, 'falsy', not)
		return not
	}
}

namespace State {

	export interface Owner {
		removed: State<boolean>
		remove?(): void
	}

	export namespace Owner {
		export function getRemovedState (ownerIn: Owner): State<boolean>
		export function getRemovedState (ownerIn?: unknown): State<boolean> | undefined
		export function getRemovedState (ownerIn: unknown) {
			const state = (ownerIn as Partial<Owner>)?.removed
			if (is(state))
				return state

			return undefined
		}

		export interface Removable extends Owner {
			remove (): void
		}

		export function create (): Owner.Removable {
			const removed = State(false)
			return {
				removed,
				remove: () => removed.value = true,
			}
		}
	}

	export type Mutable<T> = MutableState<T>
	export type MutableSetOnly<T> = MutableStateSimple<T>

	export type Or<T> = T | State<T>
	export type MutableOr<T> = T | State.Mutable<T>

	export type Unsubscribe = () => void
	export type ComparatorFunction<T> = false | ((a: T, b: T) => boolean)

	export function is<T> (value: unknown): value is State<T> {
		return typeof value === 'object' && (value as State<T>)?.isState === true
	}

	export function get<T> (value: T | State.Mutable<T>): State.Mutable<T>
	export function get<T> (value: T | State<T>): State<T>
	export function get<T> (value: T | State<T>): State<T> {
		return is<T>(value) ? value : State(value)
	}

	export function value<T> (state: T | State<T>): T {
		return is<T>(state) ? state.value : state
	}

	export function getInternalValue<T> (state: T | State<T>): T {
		return is<T>(state) ? (state as State<T> & InternalState<T>)[SYMBOL_VALUE] : state
	}

	const SYMBOL_HAS_SUBSCRIPTIONS = Symbol('HAS_SUBSCRIPTIONS')
	export interface OwnerMetadata {
		[SYMBOL_HAS_SUBSCRIPTIONS]?: boolean
	}
	export namespace OwnerMetadata {
		export function setHasSubscriptions (owner: Owner) {
			(owner as any as OwnerMetadata)[SYMBOL_HAS_SUBSCRIPTIONS] = true
		}

		export function hasSubscriptions (owner: Owner) {
			return (owner as any as OwnerMetadata)[SYMBOL_HAS_SUBSCRIPTIONS] === true
		}
	}

	export interface Generator<T> extends State<T> {
		refresh (): this // NEVER ACCEPT A BOOL PARAM HERE. It breaks everything and I don't know why
		regenerate (): this
		observe (owner: Owner, ...states: (State<any> | undefined)[]): this
		observeManual (...states: (State<any> | undefined)[]): this
		unobserve (...states: (State<any> | undefined)[]): this
	}

	export function Generator<T> (generate: () => State.Or<T>, equals?: ComparatorFunction<T>): Generator<T> {
		const result = State(undefined as T, equals) as State<T> as MakeMutable<Generator<T>> & InternalState<T>
		delete result.asMutable

		DefineMagic(result, 'value', {
			get: () => result[SYMBOL_VALUE],
		})

		let initial = true
		let unuseInternalState: State.Unsubscribe | undefined
		result.refresh = () => refreshInternal()
		result.regenerate = () => refreshInternal(true)

		result.refresh()

		result.observe = (owner, ...states) => {
			const ownerClosedState = Owner.getRemovedState(owner)
			if (!ownerClosedState || ownerClosedState.value)
				return result

			OwnerMetadata.setHasSubscriptions(owner)

			for (const state of states)
				state?.subscribeManual(result.refresh)

			let unuseOwnerRemove: State.Unsubscribe | undefined = ownerClosedState.subscribeManual(removed => removed && onRemove())
			return result

			function onRemove () {
				unuseOwnerRemove?.()
				unuseOwnerRemove = undefined
				for (const state of states)
					state?.unsubscribe(result.refresh)
			}
		}

		result.observeManual = (...states) => {
			for (const state of states)
				state?.subscribeManual(result.refresh)
			return result
		}

		result.unobserve = (...states) => {
			for (const state of states)
				state?.unsubscribe(result.refresh)
			return result
		}

		return result

		function refreshInternal (forceOverwrite?: true) {
			unuseInternalState?.(); unuseInternalState = undefined

			const value = generate()
			if (State.is(value)) {
				unuseInternalState = value.useManual(value => {
					if (result.comparator(value))
						return result

					const oldValue = result[SYMBOL_VALUE]
					result[SYMBOL_VALUE] = value
					result.emit(oldValue)
				})
				return result
			}

			if (result.comparator(value) && !initial && !forceOverwrite)
				return result

			initial = false
			const oldValue = result[SYMBOL_VALUE]
			result[SYMBOL_VALUE] = value
			result.emit(oldValue)
			return result
		}
	}

	export interface JIT<T> extends State<T, () => T> {
		markDirty (): this
		observe (...states: State<any>[]): this
		unobserve (...states: State<any>[]): this
	}

	export function JIT<T> (generate: (owner: Owner) => State.Or<T>): JIT<T> {
		const result = State(undefined!) as State<T, () => T> as MakeMutable<JIT<T>> & InternalState<T>
		delete result.asMutable

		let isCached = false
		let cached: T | undefined
		let unuseInternalState: State.Unsubscribe | undefined
		let owner: Owner.Removable | undefined
		DefineMagic(result, 'value', {
			get: () => {
				if (!isCached) {
					unuseInternalState?.(); unuseInternalState = undefined
					owner?.remove(); owner = undefined

					isCached = true

					owner = Owner.create()
					const result = generate(owner)
					if (State.is(result))
						unuseInternalState = result.useManual(value => cached = value)
					else
						cached = result
				}

				return cached as T
			},
		})

		const get = () => result.value
		result.emit = () => {
			for (const subscriber of result[SYMBOL_SUBSCRIBERS].slice())
				subscriber(get, cached)
			return result
		}

		result.use = (owner, subscriber) => {
			let subOwner: State.Owner.Removable | undefined
			result.subscribe(owner, executeSubscriber)
			executeSubscriber(get, undefined)
			return () => result.unsubscribe(executeSubscriber)

			function executeSubscriber (value: () => T, oldValue: (() => T) | undefined) {
				subOwner?.remove(); subOwner = State.Owner.create()
				subscriber(value, oldValue, subOwner)
			}
		}
		result.useManual = subscriber => {
			let subOwner: State.Owner.Removable | undefined
			result.subscribeManual(executeSubscriber)
			executeSubscriber(get, undefined)
			return () => result.unsubscribe(executeSubscriber)

			function executeSubscriber (value: () => T, oldValue: (() => T) | undefined) {
				subOwner?.remove(); subOwner = State.Owner.create()
				subscriber(value, oldValue, subOwner)
			}
		}

		result.markDirty = () => {
			unuseInternalState?.(); unuseInternalState = undefined
			owner?.remove(); owner = undefined
			const oldValue = cached
			isCached = false
			cached = undefined
			result.emit(oldValue as undefined)
			return result
		}

		result.observe = (...states) => {
			for (const state of states)
				state.subscribeManual(result.markDirty)
			return result
		}

		result.unobserve = (...states) => {
			for (const state of states)
				state.unsubscribe(result.markDirty)
			return result
		}

		return result
	}

	export interface AsyncStatePending<T, D = never> {
		readonly settled: false
		readonly value: undefined
		readonly lastValue: T | undefined
		readonly error: undefined
		readonly progress: AsyncProgress<D> | undefined
	}

	export interface AsyncStateResolved<T> {
		readonly settled: true
		readonly value: T
		readonly lastValue: T | undefined
		readonly error: undefined
		readonly progress: undefined
	}

	export interface AsyncStateRejected<T> {
		readonly settled: true
		readonly value: undefined
		readonly lastValue: T | undefined
		readonly error: Error
		readonly progress: undefined
	}

	export type AsyncState<T, D = never> = AsyncStatePending<T, D> | AsyncStateResolved<T> | AsyncStateRejected<T>

	export interface AsyncProgress<D> {
		readonly progress: number
		readonly details?: D
	}

	interface AsyncBase<T, D = never> extends State<T | undefined> {
		readonly settled: State<boolean>
		readonly lastValue: State<T | undefined>
		readonly error: State<Error | undefined>
		readonly state: State<AsyncState<T, D>>
		readonly progress: State<AsyncProgress<D> | undefined>
	}

	export interface Async<T, D = never> extends AsyncBase<T, D> {
		readonly promise: Promise<T>
	}

	export type AsyncMapGenerator<FROM, T, D = never> = (value: FROM, signal: AbortSignal, setProgress: (progress: number | null, details?: D) => void) => Promise<T>
	export type AsyncGenerator<T, D = never> = (signal: AbortSignal, setProgress: (progress: number | null, details?: D) => void) => Promise<T>

	export function Async<FROM, T, D = never> (owner: State.Owner, from: State<FROM>, generator: AsyncMapGenerator<FROM, T, D>): Async<T>
	export function Async<T, D = never> (owner: State.Owner, generator: AsyncGenerator<T, D>): Async<T>
	export function Async<FROM, T, D = never> (owner: State.Owner, _from: State<FROM> | AsyncGenerator<T, D>, _generator?: AsyncMapGenerator<FROM, T, D>): Async<T> {
		const from = State.is(_from) ? _from : State(null as FROM)
		const generator: AsyncMapGenerator<FROM, T, D> = State.is(_from) ? _generator! : (_, signal, setProgress) => _from(signal, setProgress)

		const state = State<AsyncState<T, D>>({
			settled: false,
			value: undefined,
			lastValue: undefined,
			error: undefined,
			progress: undefined,
		})

		const settled = state.mapManual(state => state.settled)
		const error = state.mapManual(state => state.error)
		const value = state.mapManual(state => state.value)
		const lastValue = state.mapManual(state => state.lastValue)
		const progress = state.mapManual(state => state.progress)
		let abortController: AbortController | undefined
		let promise: Promise<T> | undefined

		from.use(owner, async from => {
			abortController?.abort()

			const lastValue = state.value.value
			state.value = {
				settled: false,
				value: undefined,
				lastValue,
				error: undefined,
				progress: undefined,
			}
			abortController = new AbortController()
			promise = Promise.resolve(generator(from, abortController.signal, (progress, details) => {
				mutable(state.value).progress = { progress, details }
				state.emit()
			}))
			const { value, error } = await promise.then(
				value => ({ value, error: undefined }),
				error => ({ error: new Error('Async state rejection:', { cause: error }), value: undefined }),
			)

			if (abortController.signal.aborted)
				return

			state.value = {
				settled: true,
				value,
				lastValue,
				error,
				progress: undefined,
			} as AsyncState<T, D>
		})

		const result: AsyncBase<T, D> = Object.assign(
			value,
			{
				settled,
				lastValue,
				error,
				state,
				progress,
			}
		)

		Object.defineProperty(result, 'promise', {
			get: () => promise,
		})

		return result as Async<T>
	}

	export interface EndpointResult<T> extends Async<T> {
		refresh (): void
	}

	export interface ArrayItem<T> {
		value: T
		index: number
		removed: State<boolean>
	}

	export interface ArraySubscriber<T> {
		onItem (item: State<ArrayItem<T>>, state: Array<T>): unknown
		onMove (startIndex: number, endIndex: number, newStartIndex: number): unknown
		onMoveAt (indices: number[], newStartIndex: number): unknown
	}

	export interface Array<T> extends State<readonly T[]> {
		readonly length: State<number>

		set (index: number, value: T): this
		emitItem (index: number): this
		modify (index: number, modifier: (value: T, index: number, array: this) => T | void): this
		clear (): this
		push (...values: T[]): this
		unshift (...values: T[]): this
		pop (): this
		shift (): this
		splice (start: number, deleteCount: number, ...values: T[]): this
		filterInPlace (predicate: (value: T, index: number) => boolean): this
		move (startIndex: number, endIndex: number, newStartIndex: number): this
		moveAt (indices: number[], newStartIndex: number): this

		useEach (owner: State.Owner, subscriber: ArraySubscriber<T>): State.Unsubscribe
	}

	export function Array<T> (...values: T[]): Array<T> {
		const itemStates: State<ArrayItem<T>>[] = []
		const subscribers: ArraySubscriber<T>[] = []

		const state: Array<T> = Object.assign(
			State(values),
			{
				length: undefined!,
				set (index: number, value: T) {
					values[index] = value
					const itemState = itemStates[index]
					itemState.value.value = value
					itemState.emit()
					state.emit()
					return state
				},
				emitItem (index: number) {
					itemStates[index]?.emit()
					return state
				},
				modify (index: number, modifier: (value: T, index: number, array: Array<T>) => T) {
					let value = values[index]
					value = modifier(value, index, state) ?? value
					state.set(index, value)
					return state
				},
				clear () {
					values.length = 0
					itemStates.length = 0
					state.emit()
					return state
				},
				push (...newValues: T[]) {
					const start = state.value.length
					values.push(...newValues)
					for (let i = 0; i < newValues.length; i++)
						itemStates.push(addState(newValues[i], start + i))

					state.emit()
					return state
				},
				unshift (...newValues: T[]) {
					values.unshift(...newValues)
					for (let i = 0; i < newValues.length; i++)
						itemStates.unshift(addState(newValues[i], i))

					for (let i = newValues.length; i < itemStates.length; i++)
						itemStates[i].value.index = i

					for (let i = newValues.length; i < itemStates.length; i++)
						itemStates[i].emit()

					state.emit()
					return state
				},
				pop () {
					values.pop()
					itemStates.pop()
					state.emit()
					return state
				},
				shift () {
					values.shift()
					itemStates.shift()
					for (let i = 0; i < itemStates.length; i++)
						itemStates[i].value.index = i

					for (const itemState of itemStates)
						itemState.emit()

					state.emit()
					return state
				},
				splice (start: number, deleteCount: number, ...newValues: T[]) {
					values.splice(start, deleteCount, ...newValues)

					itemStates.splice(start, deleteCount, ...newValues
						.map((value, i) => addState(value, start + i)))

					for (let i = start + newValues.length; i < itemStates.length; i++)
						itemStates[i].value.index = i

					for (let i = start + newValues.length; i < itemStates.length; i++)
						itemStates[i].emit()

					state.emit()
					return state
				},
				filterInPlace (predicate: (value: T, index: number) => boolean) {
					Arrays.filterInPlace(values, predicate)
					let oldStatesI = 0
					NextValue: for (let i = 0; i < values.length; i++) {
						while (oldStatesI < itemStates.length) {
							if (itemStates[oldStatesI].value.value !== values[i]) {
								itemStates[oldStatesI].value.removed.asMutable?.setValue(true)
								oldStatesI++
								continue
							}

							itemStates[i] = itemStates[oldStatesI]
							itemStates[i].value.index = i
							oldStatesI++
							continue NextValue
						}
					}

					// clip off the states that were pulled back or not included
					for (let i = oldStatesI; i < itemStates.length; i++)
						itemStates[i].value.removed.asMutable?.setValue(true)
					itemStates.length = values.length

					for (const itemState of itemStates)
						itemState.emit()

					state.emit()
					return state
				},
				move (startIndex: number, endIndex: number, newStartIndex: number) {
					startIndex = Math.max(0, startIndex)
					endIndex = Math.min(endIndex, values.length)

					newStartIndex = Math.max(0, Math.min(newStartIndex, values.length))

					if (startIndex >= endIndex)
						return state

					if (newStartIndex >= startIndex && newStartIndex < endIndex)
						// if the slice is moved to a new position within itself, do nothing
						return state

					const valuesToMove = values.splice(startIndex, endIndex - startIndex)
					const statesToMove = itemStates.splice(startIndex, endIndex - startIndex)

					const actualInsertionIndex = startIndex < newStartIndex
						? newStartIndex - (endIndex - startIndex) + 1 // account for spliced out indices
						: newStartIndex

					values.splice(actualInsertionIndex, 0, ...valuesToMove)
					itemStates.splice(actualInsertionIndex, 0, ...statesToMove)

					const emitIndices: number[] = []
					for (let i = 0; i < itemStates.length; i++) {
						const savedIndex = itemStates[i].value.index
						if (savedIndex !== i) {
							itemStates[i].value.index = i
							emitIndices.push(i)
						}
					}

					for (const index of emitIndices)
						itemStates[index]?.emit()

					for (const subscriber of subscribers)
						subscriber.onMove(startIndex, endIndex, newStartIndex)

					state.emit()
					return state
				},
				moveAt (movingIndices: number[], newStartIndex: number) {
					if (!movingIndices.length)
						return state

					const length = values.length
					movingIndices = movingIndices.map(i => Math.max(0, Math.min(length - 1, i)))
					Arrays.distinctInPlace(movingIndices)
					movingIndices.sort((a, b) => a - b)

					newStartIndex = Math.min(newStartIndex, length - movingIndices.length)

					let staticReadIndex = 0
					let movingReadIndex = 0
					let writeIndex = 0
					let movedCount = 0

					const sourceValues = values.slice()
					const sourceItems = itemStates.slice()

					let mode: 'moving' | 'static'

					while (writeIndex < length) {
						mode = writeIndex >= newStartIndex && movedCount < movingIndices.length ? 'moving' : 'static'

						if (mode === 'static') {
							for (let i = staticReadIndex; i < length; i++)
								if (!movingIndices.includes(i)) {
									staticReadIndex = i
									break
								}

							values[writeIndex] = sourceValues[staticReadIndex]
							itemStates[writeIndex] = sourceItems[staticReadIndex]
							staticReadIndex++
							writeIndex++
						}
						else {
							values[writeIndex] = sourceValues[movingIndices[movingReadIndex]]
							itemStates[writeIndex] = sourceItems[movingIndices[movingReadIndex]]
							movingReadIndex++
							movedCount++
							writeIndex++
						}
					}

					const emitIndices: number[] = []
					for (let i = 0; i < itemStates.length; i++) {
						const savedIndex = itemStates[i].value.index
						if (savedIndex !== i) {
							itemStates[i].value.index = i
							emitIndices.push(i)
						}
					}

					for (const index of emitIndices)
						itemStates[index]?.emit()

					for (const subscriber of subscribers)
						subscriber.onMoveAt(movingIndices, newStartIndex)

					state.emit()
					return state
				},

				useEach (owner: State.Owner, subscriber: ArraySubscriber<T>) {
					const ownerClosedState = State.Owner.getRemovedState(owner)
					if (!ownerClosedState || ownerClosedState.value)
						return Functions.NO_OP

					for (const itemState of itemStates)
						subscriber.onItem(itemState, state)

					State.OwnerMetadata.setHasSubscriptions(owner)
					// const fn = subscriber as SubscriberFunction<T>
					// fn[SYMBOL_UNSUBSCRIBE] ??= new Set()
					// fn[SYMBOL_UNSUBSCRIBE].add(cleanup)
					ownerClosedState.subscribeManual(cleanup)

					subscribers.push(subscriber)
					return cleanup

					function cleanup () {
						ownerClosedState.unsubscribe(cleanup)
						Arrays.filterInPlace(subscribers, s => s !== subscriber)
						// fn[SYMBOL_UNSUBSCRIBE]?.delete(cleanup)
					}
				},
			}
		)

		mutable(state).length = state.mapManual(state => state.length)
		return state

		function addState (value: T, index: number) {
			const itemState = State({ value, index, removed: State(false) })

			for (const subscriber of subscribers)
				subscriber.onItem(itemState, state)

			return itemState
		}
	}

	export function Truthy (owner: Owner, state: State<any>): Generator<boolean> {
		return Generator(() => !!state.value)
			.observe(owner, state)
	}

	export function NonNullish (owner: Owner, state: State<any>): Generator<boolean> {
		return Generator(() => state.value !== undefined && state.value !== null)
			.observe(owner, state)
	}

	export function Falsy (owner: Owner, state: State<any>): Generator<boolean> {
		return Generator(() => !!state.value)
			.observe(owner, state)
	}

	export function Some (owner: Owner, ...anyOfStates: State<unknown>[]): Generator<boolean> {
		return Generator(() => anyOfStates.some(state => state.value))
			.observe(owner, ...anyOfStates)
	}

	export function Every (owner: Owner, ...anyOfStates: State<unknown>[]): Generator<boolean> {
		return Generator(() => anyOfStates.every(state => state.value))
			.observe(owner, ...anyOfStates)
	}

	export function Map<const INPUT extends (State<unknown> | undefined)[], OUTPUT> (owner: Owner, inputs: INPUT, outputGenerator: (...inputs: NoInfer<{ [I in keyof INPUT]: INPUT[I] extends State<infer INPUT> ? INPUT : undefined }>) => State.Or<OUTPUT>, equals?: ComparatorFunction<NoInfer<OUTPUT>>): Generator<OUTPUT> {
		return Generator(() => outputGenerator(...inputs.map(input => input?.value) as never), equals)
			.observe(owner, ...inputs.filter(FilterNonNullish))
	}

	export function MapManual<const INPUT extends (State<unknown> | undefined)[], OUTPUT> (inputs: INPUT, outputGenerator: (...inputs: NoInfer<{ [I in keyof INPUT]: Exclude<INPUT[I], undefined> extends State<infer INPUT> ? INPUT : undefined }>) => State.Or<OUTPUT>, equals?: ComparatorFunction<NoInfer<OUTPUT>>): Generator<OUTPUT> {
		return Generator(() => outputGenerator(...inputs.map(input => input?.value) as never), equals)
			.observeManual(...inputs.filter(FilterNonNullish))
	}

	export function Use<const INPUT extends Record<string, (State<unknown> | undefined)>> (owner: Owner, input: INPUT): Generator<{ [KEY in keyof INPUT]: INPUT[KEY] extends State<infer INPUT, infer OUTPUT> ? INPUT : INPUT[KEY] extends State<infer INPUT, infer OUTPUT> | undefined ? INPUT | undefined : undefined }> {
		return Generator(() => Object.fromEntries(Object.entries(input).map(([key, state]) => [key, state?.value])) as never)
			.observe(owner, ...Object.values(input).filter(FilterNonNullish))
	}

	export function UseManual<const INPUT extends Record<string, (State<unknown> | undefined)>> (input: INPUT): Generator<{ [KEY in keyof INPUT]: INPUT[KEY] extends State<infer INPUT, infer OUTPUT> ? INPUT : INPUT[KEY] extends State<infer INPUT, infer OUTPUT> | undefined ? INPUT | undefined : undefined }> {
		return Generator(() => Object.fromEntries(Object.entries(input).map(([key, state]) => [key, state?.value])) as never)
			.observeManual(...Object.values(input).filter(FilterNonNullish))
	}
}

export default State
