import _Label, { LabelTarget as _LabelTarget } from 'component/Label'
import _Loading from 'component/Loading'
import _Slot from 'component/Slot'

export { default as Component } from 'Component'
export { default as State } from 'utility/State'

export namespace Kit {
	export type Label = _Label
	export const Label = _Label
	export type LabelTarget = _LabelTarget
	export const LabelTarget = _LabelTarget
	export type Slot = _Slot
	export const Slot = _Slot
	export type Loading = _Loading
	export const Loading = _Loading
}
