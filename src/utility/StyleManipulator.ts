import type Component from 'Component'
import Arrays, { NonNullish } from 'utility/Arrays'
import type { PartialRecord } from 'utility/Objects'
import State from 'utility/State'

export interface Styles {
}

export const style = State<Styles>({})

export type ComponentName = keyof typeof style.value
export type ComponentNameType<PREFIX extends string> = keyof { [KEY in ComponentName as KEY extends `${PREFIX}-${infer TYPE}--${string}` ? TYPE
	: KEY extends `${PREFIX}-${infer TYPE}` ? TYPE
	: never]: string[] }

interface StyleManipulatorFunctions<HOST> {
	get (): ComponentName[]
	has (name: ComponentName): boolean
	getState (owner: State.Owner, name: ComponentName): State<boolean> | undefined
	remove (...names: ComponentName[]): HOST
	toggle (...names: ComponentName[]): HOST
	toggle (enabled: boolean, ...names: ComponentName[]): HOST
	bind (state: State.Or<boolean>, ...names: ComponentName[]): HOST
	// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
	bind (state: State<boolean>, names: State<ComponentName[] | ComponentName | undefined>): HOST
	// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
	bindFrom (state: State<ComponentName[] | ComponentName | undefined>): HOST
	// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
	unbind (state?: State<boolean> | State<ComponentName[] | ComponentName | undefined>): HOST
	/** Add a combined style when multiple requirement styles are present */
	combine (combined: ComponentName, requirements: ComponentName[]): HOST
	uncombine (combined: ComponentName): HOST
	refresh (): HOST

	hasProperty (property: string): boolean
	setProperty (property: string, value?: string | number | null): HOST
	setProperties (properties: PartialRecord<Extract<keyof CSSStyleDeclaration, string>, string | number | null>): HOST
	toggleProperty (enabled: boolean | undefined, property: string, value?: string | number | null): HOST
	setVariable (variable: string, value?: string | number | null): HOST
	bindProperty (property: string, state: State.Or<string | number | undefined | null>): HOST
	bindVariable (variable: string, state: State.Or<string | number | undefined | null>): HOST
	removeProperties (...properties: string[]): HOST
	removeVariables (...variables: string[]): HOST
}

interface StyleManipulatorFunction<HOST> {
	(...names: ComponentName[]): HOST
	(...names: State<ComponentName | undefined>[]): HOST
}

interface StyleManipulator<HOST> extends StyleManipulatorFunction<HOST>, StyleManipulatorFunctions<HOST> {
}

function StyleManipulator (component: Component): StyleManipulator<Component> {
	const styles = new Set<ComponentName>()
	const currentClasses: string[] = []
	// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
	const stateUnsubscribers = new WeakMap<State<boolean> | State<ComponentName[] | ComponentName | undefined>, [State.Unsubscribe, ComponentName[]]>()
	const unbindPropertyState: Record<string, State.Unsubscribe | undefined> = {}

	const styleState = State.JIT(() => styles)

	interface Combination {
		combined: ComponentName
		requirements: ComponentName[]
	}
	const combinations: Combination[] = []

	// if (Env.isDev)
	style.subscribe(component, () => updateClasses())

	const result: StyleManipulator<Component> = Object.assign(
		// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
		((...names: string[] | State<ComponentName | undefined>[]) => {
			for (const name of names)
				if (typeof name === 'string')
					styles.add(name as ComponentName)
				else
					result.bindFrom(name)
			updateClasses()
			return component
		}) as StyleManipulatorFunction<Component>,

		{
			get: () => [...styles].sort(),
			has (name) {
				return styles.has(name)
			},
			getState (owner, name) {
				return styleState.map(owner, styles => styles.has(name))
			},
			remove (...names) {
				for (const name of names)
					styles.delete(name)

				updateClasses()
				return component
			},
			toggle (enabled, ...names) {
				if (enabled)
					for (const name of names)
						styles.add(name)
				else
					for (const name of names)
						styles.delete(name)

				updateClasses()
				return component
			},
			bind (state, ...toAdd) {
				if (State.is(toAdd[0])) {
					const bstate = state as State<boolean>
					result.unbind(bstate)

					const owner = State.Owner.create()
					const currentNames: ComponentName[] = []
					State.Use(owner, { state: bstate, names: toAdd[0] }).use(owner, ({ state, names }, { state: oldState, names: oldNames } = { state: false, names: undefined }) => {
						oldNames = oldNames && oldState ? Array.isArray(oldNames) ? oldNames : [oldNames] : []
						names = names && state ? Array.isArray(names) ? names : [names] : []

						for (const oldName of oldNames ?? [])
							styles.delete(oldName)

						for (const name of names)
							styles.add(name)

						currentNames.splice(0, Infinity, ...names)
						updateClasses()
					})

					stateUnsubscribers.set(bstate, [owner.remove, currentNames])
					return component
				}

				const names = toAdd as ComponentName[]

				if (!State.is(state))
					return result.toggle(state, ...names)

				result.unbind(state)

				const unsubscribe = state.use(component, active => {
					if (active)
						for (const name of names)
							styles.add(name)
					else
						for (const name of names)
							styles.delete(name)

					updateClasses()
				})

				stateUnsubscribers.set(state, [unsubscribe, names])
				return component
			},
			bindFrom (state) {
				result.unbind(state)

				const currentNames: ComponentName[] = []
				const unsubscribe = state.use(component, (names, oldNames) => {
					if (!Array.isArray(names))
						names = names ? [names] : []
					if (!Array.isArray(oldNames))
						oldNames = oldNames ? [oldNames] : []

					for (const oldName of oldNames ?? [])
						styles.delete(oldName)

					for (const name of names)
						styles.add(name)

					currentNames.splice(0, Infinity, ...names)

					updateClasses()
				})

				stateUnsubscribers.set(state, [unsubscribe, currentNames])
				return component
			},
			unbind (state) {
				const bound = state && stateUnsubscribers.get(state)
				if (!bound)
					return component

				const [unsubscribe, names] = bound
				unsubscribe?.()
				stateUnsubscribers.delete(state)
				result.remove(...names)
				return component
			},
			combine (combined, requirements) {
				combinations.push({ combined, requirements })
				return component
			},
			uncombine (combined) {
				Arrays.filterInPlace(combinations, combination => combination.combined !== combined)
				result.remove(combined)
				return component
			},
			refresh: () => updateClasses(),

			hasProperty (property) {
				return component.element.style.getPropertyValue(property) !== ''
			},
			setProperty (property, value) {
				unbindPropertyState[property]?.()
				setProperty(property, value)
				return component
			},
			setProperties (properties) {
				for (let [property, value] of Object.entries(properties)) {
					unbindPropertyState[property]?.()
					property = property.replaceAll(/[a-z][A-Z]/g, match => `${match[0]}-${match[1].toLowerCase()}`).toLowerCase()
					setProperty(property, value)
				}
				return component
			},
			toggleProperty (enabled, property, value) {
				enabled ??= !result.hasProperty(property)
				if (enabled === true)
					return result.setProperty(property, enabled ? value : undefined)
				else
					return result.removeProperties(property)
			},
			setVariable (variable, value) {
				return result.setProperty(`--${variable}`, value)
			},
			bindProperty (property, state) {
				unbindPropertyState[property]?.()

				if (State.is(state))
					unbindPropertyState[property] = state.use(component, value => setProperty(property, value))
				else {
					setProperty(property, state)
					unbindPropertyState[property] = undefined
				}

				return component
			},
			bindVariable (variable, state) {
				return result.bindProperty(`--${variable}`, state)
			},
			removeProperties (...properties) {
				for (const property of properties)
					component.element.style.removeProperty(property)
				return component
			},
			removeVariables (...variables) {
				for (const variable of variables)
					component.element.style.removeProperty(`--${variable}`)
				return component
			},
		} satisfies StyleManipulatorFunctions<Component>,
	)

	return result

	function updateClasses () {
		const stylesArray = [...styles]

		for (const combination of combinations) {
			const hasRequirements = combination.requirements.every(name => styles.has(name))
			if (hasRequirements) {
				styles.add(combination.combined)
				stylesArray.push(combination.combined)
			}
			else {
				styles.delete(combination.combined)
				Arrays.remove(stylesArray, combination.combined)
			}
		}

		if (!component.attributes.has('component'))
			component.attributes.insertBefore('class', 'component')

		component.attributes.set('component', stylesArray.join(' '))

		const toAdd: string[] = stylesArray.flatMap(component => style.value[component]).filter(NonNullish)
		const toRemove = currentClasses.filter(cls => !toAdd.includes(cls))

		if (toRemove)
			component.element.classList.remove(...toRemove)

		component.element.classList.add(...toAdd)
		currentClasses.push(...toAdd)
		styleState.markDirty()
		return component
	}

	function setProperty (property: string, value?: string | number | null) {
		if (value === undefined || value === null)
			component.element.style.removeProperty(property)
		else
			component.element.style.setProperty(property, `${value}`)
	}
}

export default StyleManipulator
