import type Component from 'Component'
import type State from 'utility/State'

interface ClassManipulator<HOST> {
	has (...classes: string[]): boolean
	some (...classes: string[]): boolean
	add (...classes: string[]): HOST
	remove (...classes: string[]): HOST
	toggle (present: boolean, ...classes: string[]): HOST
	bind (state: State<boolean>, ...classes: string[]): HOST
	copy (component: Component): HOST
	copy (element: HTMLElement): HOST
}

function ClassManipulator (component: Component): ClassManipulator<Component> {
	const dom = component.__dom
	return {
		has (...classes) {
			return dom.hasClasses(...classes)
		},
		some (...classes) {
			return dom.someClasses(...classes)
		},
		add (...classes) {
			dom.addClasses(...classes)
			return component
		},
		remove (...classes) {
			dom.removeClasses(...classes)
			return component
		},
		toggle (present, ...classes) {
			return this[present ? 'add' : 'remove'](...classes)
		},
		copy (element) {
			const classes = 'isComponent' in element
				? element.__dom.getClasses()
				: [...element.classList]
			dom.addClasses(...classes)
			return component
		},
		bind (state, ...classes) {
			state.use(component, present => this.toggle(!!present, ...classes))
			return component
		},
	}
}

export default ClassManipulator
