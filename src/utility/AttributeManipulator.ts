import type Component from 'Component'
import Maps from 'utility/Maps'
import State from 'utility/State'
import { StringApplicatorSource } from 'utility/StringApplicator'

interface AttributeManipulator<HOST> {
	has (attribute: string): boolean
	get (attribute: string): State<string | undefined>
	/** Adds the given attributes with no values */
	append (...attributes: string[]): HOST
	/** 
	 * Adds the given attributes with no values.
	 * Note that prepending attributes requires removing all previous attributes, then re-appending them after.
	 */
	prepend (...attributes: string[]): HOST
	/**
	 * Inserts the given attributes before the reference attribute with no values.
	 * Note that inserting attributes requires removing all previous attributes, then re-appending them after.
	 */
	insertBefore (referenceAttribute: string, ...attributes: string[]): HOST
	/**
	 * Inserts the given attributes after the reference attribute with no values.
	 * Note that inserting attributes requires removing all previous attributes, then re-appending them after.
	 */
	insertAfter (referenceAttribute: string, ...attributes: string[]): HOST
	/** Sets the attribute to `value`, or removes the attribute if `value` is `undefined` */
	set (attribute: string, value?: string): HOST
	bind (state: State<boolean>, attribute: string, value?: string, orElse?: string): HOST
	bind (attribute: string, state: State<string | undefined>): HOST
	/**
	 * If the attribute is already set, does nothing. 
	 * Otherwise, calls the supplier, and sets the attribute to the result, or removes the attribute if it's `undefined` 
	 */
	compute (attribute: string, supplier: (host: HOST) => string | undefined): HOST
	use (attribute: string, source: StringApplicatorSource): HOST
	getUsing (attribute: string): StringApplicatorSource | undefined
	remove (...attributes: string[]): HOST
	toggle (present: boolean, attribute: string, value?: string): HOST
	copy (component: Component): HOST
	copy (element: HTMLElement): HOST
}

interface TranslationHandlerRegistration {
	source: StringApplicatorSource
	unuse?: State.Unsubscribe
}

function AttributeManipulator (component: Component): AttributeManipulator<Component> {
	const dom = component.__dom
	let removed = false
	let translationHandlers: Record<string, TranslationHandlerRegistration> | undefined
	const unuseAttributeMap = new Map<string, State.Unsubscribe>()
	const attributeStates = new Map<string, State<string | undefined>>()

	State.Owner.getRemovedState(component)?.matchManual(true, () => {
		removed = true

		for (const registration of Object.values(translationHandlers ?? {}))
			registration.unuse?.()

		translationHandlers = undefined
	})

	const result: AttributeManipulator<Component> = {
		has (attribute) {
			return dom.hasAttribute(attribute)
		},
		get (attribute) {
			return Maps.compute(attributeStates, attribute, () =>
				State(dom.getAttribute(attribute) ?? undefined))
		},
		append (...attributes) {
			for (const attribute of attributes) {
				translationHandlers?.[attribute]?.unuse?.()
				delete translationHandlers?.[attribute]
				dom.setAttribute(attribute, '')
				attributeStates.get(attribute)?.asMutable?.setValue('')
			}
			return component
		},
		prepend (...attributes) {
			const oldAttributes = Object.fromEntries(dom.getAttributes())

			for (const attribute of attributes) {
				const value = oldAttributes[attribute] ?? ''
				dom.prependAttribute(attribute, value)
				attributeStates.get(attribute)?.asMutable?.setValue(value)
			}

			return component
		},
		insertBefore (referenceAttribute, ...attributes) {
			const oldAttributes = Object.fromEntries(dom.getAttributes())
			for (const attribute of attributes) {
				const value = oldAttributes[attribute] ?? ''
				dom.insertAttribute(referenceAttribute, 'before', attribute, value)
				attributeStates.get(attribute)?.asMutable?.setValue(value)
			}

			return component
		},
		insertAfter (referenceAttribute, ...attributes) {
			const oldAttributes = Object.fromEntries(dom.getAttributes())
			for (const attribute of attributes) {
				const value = oldAttributes[attribute] ?? ''
				dom.insertAttribute(referenceAttribute, 'after', attribute, value)
				attributeStates.get(attribute)?.asMutable?.setValue(value)
			}

			return component
		},
		set (attribute, value) {
			translationHandlers?.[attribute]?.unuse?.()
			delete translationHandlers?.[attribute]
			if (value === undefined) {
				dom.removeAttribute(attribute)
				attributeStates.get(attribute)?.asMutable?.setValue(undefined)
			}
			else {
				dom.setAttribute(attribute, value)
				attributeStates.get(attribute)?.asMutable?.setValue(value)
			}
			return component
		},
		bind (...args) {
			if (typeof args[0] === 'string') {
				const [attribute, state] = args as [string, State<string | undefined>]
				unuseAttributeMap.get(attribute)?.()
				unuseAttributeMap.set(attribute, state.use(component, value => {
					if (value === undefined) {
						dom.removeAttribute(attribute)
						attributeStates.get(attribute)?.asMutable?.setValue(undefined)
					}
					else {
						dom.setAttribute(attribute, value)
						attributeStates.get(attribute)?.asMutable?.setValue(value)
					}
				}))
			}
			else {
				let [state, attribute, value, orElse] = args as [State<boolean>, string, string?, string?]
				unuseAttributeMap.get(attribute)?.()
				unuseAttributeMap.set(attribute, state.use(component, active => {
					if (active) {
						value ??= ''
						dom.setAttribute(attribute, value)
						attributeStates.get(attribute)?.asMutable?.setValue(value)
					}
					else if (orElse !== undefined) {
						dom.setAttribute(attribute, orElse)
						attributeStates.get(attribute)?.asMutable?.setValue(orElse)
					}
					else {
						dom.removeAttribute(attribute)
						attributeStates.get(attribute)?.asMutable?.setValue(undefined)
					}
				}))
			}
			return component
		},
		compute (attribute, supplier) {
			if (dom.hasAttribute(attribute))
				return component

			translationHandlers?.[attribute]?.unuse?.()
			delete translationHandlers?.[attribute]
			const value = supplier(component)
			if (value === undefined) {
				dom.removeAttribute(attribute)
				attributeStates.get(attribute)?.asMutable?.setValue(undefined)
			}
			else {
				dom.setAttribute(attribute, value)
				attributeStates.get(attribute)?.asMutable?.setValue(value)
			}
			return component
		},
		getUsing (attribute) {
			return translationHandlers?.[attribute]?.source
		},
		use (attribute, source) {
			if (removed)
				return component

			translationHandlers?.[attribute]?.unuse?.(); delete translationHandlers?.[attribute]

			const unuse = StringApplicatorSource.apply(source => {
				const registration = translationHandlers?.[attribute]
				if (!registration)
					return

				const value = StringApplicatorSource.toString(source ?? '')
				dom.setAttribute(attribute, value)
				attributeStates.get(attribute)?.asMutable?.setValue(value)
			}, source)

			translationHandlers ??= {}
			translationHandlers[attribute] = { source: source, unuse }

			return component
		},
		remove (...attributes) {
			for (const attribute of attributes) {
				translationHandlers?.[attribute]?.unuse?.()
				delete translationHandlers?.[attribute]
				dom.removeAttribute(attribute)
				attributeStates.get(attribute)?.asMutable?.setValue(undefined)
			}
			return component
		},
		toggle (present, attribute, value = '') {
			return this[present ? 'set' : 'remove'](attribute, value)
		},
		copy (element) {
			const attributes = 'isComponent' in element
				? element.__dom.getAttributes()
				: [...element.attributes].map(attribute => [attribute.name, attribute.value] as [string, string])

			for (const [name, value] of attributes) {
				dom.setAttribute(name, value)
				attributeStates.get(name)?.asMutable?.setValue(value)
			}
			return component
		},
	}

	return result
}

export default AttributeManipulator
