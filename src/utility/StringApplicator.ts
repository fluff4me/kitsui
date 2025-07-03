import { NonNullish } from 'utility/Arrays'
import type { SupplierOr } from 'utility/Functions'
import State from 'utility/State'

export interface StringApplicatorSources {
	string: string
}

export interface StringApplicatorSourceDefinition<SOURCE extends keyof StringApplicatorSources = keyof StringApplicatorSources> {
	requiredState?: State<unknown>
	match (value: unknown): value is StringApplicatorSources[SOURCE]
	toString (value: StringApplicatorSources[SOURCE]): string
	toNodes (value: StringApplicatorSources[SOURCE]): Node[]
}

let cumulativeSourceRequiredState: State<unknown> | undefined
export namespace StringApplicatorSources {

	export const REGISTRY: Partial<Record<keyof StringApplicatorSources, StringApplicatorSourceDefinition>> = {}

	export function register<SOURCE extends keyof StringApplicatorSources> (source: SOURCE, value: StringApplicatorSourceDefinition) {
		REGISTRY[source] = value as never
		cumulativeSourceRequiredState = State.MapManual(Object.values(REGISTRY).map(def => def.requiredState).filter(NonNullish), () => null, false)
	}

	export function toString (source: StringApplicatorSource): string {
		if (typeof source === 'function')
			source = source()

		if (typeof source === 'string')
			return source

		for (const def of Object.values(REGISTRY))
			if (def.match(source))
				return def.toString(source)

		throw new Error(`No StringApplicatorSourceDefinition found for source: ${String(source)}`)
	}

	export function toNodes (source: StringApplicatorSource): Node[] {
		if (typeof source === 'function')
			source = source()

		if (typeof source === 'string')
			return [document.createTextNode(source)]

		for (const def of Object.values(REGISTRY))
			if (def.match(source))
				return def.toNodes(source)

		throw new Error(`No StringApplicatorSourceDefinition found for source: ${String(source)}`)
	}
}

export type StringApplicatorSource = SupplierOr<StringApplicatorSources[keyof StringApplicatorSources]>

interface StringApplicator<HOST> {
	readonly state: State<string>
	set (value: StringApplicatorSource): HOST
	bind (state: State<StringApplicatorSource>): HOST
	unbind (): HOST
	/** Create a new string applicator with the same target that returns a different host */
	rehost<NEW_HOST> (newHost: NEW_HOST): StringApplicator<NEW_HOST>
}

function BaseStringApplicator<HOST> (
	host: HOST,
	defaultValue: string | undefined,
	set: (result: StringApplicator.Optional<HOST>, value?: StringApplicatorSource | null) => void,
): StringApplicator.Optional<HOST> {
	let unbind: State.Unsubscribe | undefined
	let unown: State.Unsubscribe | undefined
	let subUnown: State.Unsubscribe | undefined
	let removed = false
	const state = State(defaultValue)
	const result = makeApplicator(host)
	const setInternal = set.bind(null, result)
	return result

	function setFromSource (source?: StringApplicatorSource | null) {
		subUnown?.(); subUnown = undefined

		if (typeof source !== 'function')
			return setInternal(source)

		const sourceFunction = source
		if (!cumulativeSourceRequiredState)
			return setInternal(sourceFunction())

		const subOwner = State.Owner.create()
		subUnown = subOwner.remove
		cumulativeSourceRequiredState?.use(subOwner, () => setInternal(sourceFunction()))
	}

	function makeApplicator<HOST> (host: HOST): StringApplicator.Optional<HOST> {
		const hostOwner = host as HOST & State.Owner
		State.Owner.getRemovedState(host)?.matchManual(true, () => {
			removed = true
			unbind?.(); unbind = undefined
			unown?.(); unown = undefined
			subUnown?.(); subUnown = undefined
		})

		return {
			state,
			set: value => {
				if (removed)
					return host

				unbind?.(); unbind = undefined
				unown?.(); unown = undefined
				setFromSource(value)
				return host
			},
			bind: (state?: State.Or<StringApplicatorSource | null | undefined>) => {
				if (removed)
					return host

				unbind?.(); unbind = undefined
				unown?.(); unown = undefined
				subUnown?.(); subUnown = undefined

				if (state === undefined || state === null) {
					setInternal(defaultValue)
					return host
				}

				if (!State.is(state)) {
					setInternal(state)
					return host
				}

				unbind = state?.use(hostOwner, state => setFromSource(state))
				return host
			},
			unbind: () => {
				unbind?.(); unbind = undefined
				unown?.(); unown = undefined
				subUnown?.(); subUnown = undefined
				setInternal(defaultValue)
				return host
			},
			rehost: makeApplicator,
		}
	}
}

function StringApplicator<HOST> (host: HOST, apply: (value?: string) => unknown): StringApplicator.Optional<HOST>
function StringApplicator<HOST> (host: HOST, defaultValue: string, apply: (value: string) => unknown): StringApplicator<HOST>
function StringApplicator<HOST> (host: HOST, defaultValueOrApply: string | undefined | ((value?: string) => unknown), maybeApply?: (value: string) => unknown): StringApplicator.Optional<HOST> {
	const defaultValue = !maybeApply ? undefined : defaultValueOrApply as string
	const apply = (maybeApply ?? defaultValueOrApply) as (value?: string) => unknown

	return BaseStringApplicator(host, defaultValue, (result, value) => {
		if (value !== undefined && value !== null)
			value = StringApplicatorSources.toString(value)

		if (result.state.value !== value) {
			result.state.asMutable?.setValue(value)
			apply(value ?? undefined)
		}
	})
}

namespace StringApplicator {

	export interface Optional<HOST> extends Omit<StringApplicator<HOST>, 'state' | 'set' | 'bind' | 'rehost'> {
		state: State<string | undefined | null>
		set (value?: StringApplicatorSource | null): HOST
		bind (state?: State.Or<StringApplicatorSource | undefined | null>): HOST
		/** Create a new string applicator with the same target that returns a different host */
		rehost<NEW_HOST> (newHost: NEW_HOST): StringApplicator.Optional<NEW_HOST>
	}

	export function render (content?: StringApplicatorSource | null): Node[] {
		return !content ? [] : StringApplicatorSources.toNodes(content)
	}

	export function Nodes<HOST> (host: HOST, apply: (nodes: Node[]) => unknown): StringApplicator.Optional<HOST>
	export function Nodes<HOST> (host: HOST, defaultValue: string, apply: (nodes: Node[]) => unknown): StringApplicator<HOST>
	export function Nodes<HOST> (host: HOST, defaultValueOrApply: string | undefined | ((nodes: Node[]) => unknown), maybeApply?: (nodes: Node[]) => unknown): StringApplicator.Optional<HOST> {
		const defaultValue = !maybeApply ? undefined : defaultValueOrApply as string
		const apply = (maybeApply ?? defaultValueOrApply) as (nodes: Node[]) => unknown

		return BaseStringApplicator(host, defaultValue, (result, value: StringApplicatorSource | null | undefined) => {
			const valueString = value !== undefined && value !== null ? StringApplicatorSources.toString(value) : undefined
			result.state.asMutable?.setValue(valueString)
			apply(render(value))
		})
	}

}

export default StringApplicator
