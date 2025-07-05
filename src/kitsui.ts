import _Label, { LabelTarget as _LabelTarget } from 'component/Label'

export { default as Component } from 'Component'
export { default as State } from 'utility/State'

export namespace Kit {
	export type Label = _Label
	export const Label = _Label
	export type LabelTarget = _LabelTarget
	export const LabelTarget = _LabelTarget
}
