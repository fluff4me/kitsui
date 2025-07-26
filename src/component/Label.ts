import Component from 'Component'
import State from 'utility/State'

export interface LabelExtensions {
	readonly textWrapper: Component
	readonly for: State.Mutable<string | undefined>
	readonly required: State.Mutable<boolean>
	readonly invalid: State<boolean>
	setTarget (target?: LabelTarget): this
	setFor (targetName?: string): this
	setRequired (required?: boolean | State<boolean>): this
}

enum LabelStyleTargets {
	Label,
}

interface Label extends Component, LabelExtensions, Component.StyleHost<typeof LabelStyleTargets> { }

const Label = Component('label', (label): Label => {
	const textWrapper = Component()
		.appendTo(label)

	let requiredOwner: State.Owner.Removable | undefined
	let unuseTarget: State.Unsubscribe | undefined
	return label
		.addStyleTargets(LabelStyleTargets)
		.extend<LabelExtensions>(label => ({
			textWrapper,
			for: State(undefined),
			required: State(false),
			invalid: State(false),
			setFor: inputName => {
				label.attributes.set('for', inputName)
				label.for.asMutable?.setValue(inputName)
				return label
			},
			setRequired: (required = true) => {
				requiredOwner?.remove(); requiredOwner = undefined

				if (typeof required === 'boolean')
					label.required.value = required
				else {
					requiredOwner = State.Owner.create()
					label.required.bind(requiredOwner, required)
				}

				return label
			},
			setTarget: target => {
				unuseTarget?.(); unuseTarget = undefined
				label.setFor(target?.name.value)
				label.setRequired(target?.required)

				const targetInvalidOwner = State.Owner.create()
				if (target?.invalid)
					State.Use(targetInvalidOwner, { invalid: target.invalid, touched: target.touched })
						.use(targetInvalidOwner, ({ invalid, touched }) =>
							label.invalid.asMutable?.setValue(!!invalid && (touched ?? true)))

				unuseTarget = !target ? undefined : () => {
					targetInvalidOwner.remove()
					unuseTarget = undefined
				}
				return label
			},
		}))
		.extendJIT('text', label => label.textWrapper.text.rehost(label))
		.onRooted(label => {
			label.for.subscribeManual(inputName => label.setFor(inputName))
			label.required.subscribeManual(required => {
				if (requiredOwner)
					return // don't recursively setRequired when required is bound to another state

				label.setRequired(required)
			})
		})
		.onRemoveManual(() => {
			requiredOwner?.remove()
		})
})

export default Label

interface LabelTargetExtensions {
	readonly required?: State.Mutable<boolean>
	readonly invalid?: State<boolean>
	readonly touched?: State<boolean>
}

export interface LabelTarget extends Component, LabelTargetExtensions { }

export const LabelTarget = Component.Extension(component => {
	return component
})
