import type Component from 'Component'
import type { StringApplicatorSource } from 'utility/StringApplicator'
import StringApplicator from 'utility/StringApplicator'

interface TextManipulator<HOST> extends Omit<StringApplicator.Optional<HOST>, 'rehost'> {
	prepend (text: string): HOST
	append (text: string): HOST
	rehost<COMPONENT extends Component> (component: COMPONENT): TextManipulator<COMPONENT>
}

function TextManipulator (component: Component, target = component): TextManipulator<Component> {
	return apply(StringApplicator.Nodes(component, nodes => {
		target.removeContents()
		target.append(...nodes)
		return nodes
	}))

	function apply (applicator: StringApplicator.Optional<Component>): TextManipulator<Component> {
		const rehost = applicator.rehost
		return Object.assign(
			applicator,
			{
				prepend (text?: StringApplicatorSource | null) {
					target.prepend(...StringApplicator.render(text))
					return component
				},
				append (text?: StringApplicatorSource | null) {
					target.append(...StringApplicator.render(text))
					return component
				},
				rehost (component: Component) {
					return apply(rehost(component))
				},
			}
		)
	}
}

export default TextManipulator
