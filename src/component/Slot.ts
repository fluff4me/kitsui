import Component, { ComponentInsertionDestination } from 'Component'
import ComponentInsertionTransaction from 'ext/ComponentInsertionTransaction'
import type { AbortablePromiseOr } from 'utility/AbortablePromise'
import AbortablePromise from 'utility/AbortablePromise'
import State from 'utility/State'
import type { Falsy } from 'utility/Type'

export interface SlotComponentExtensions {
	hasContent (): boolean
	appendWhen (state: State<boolean>, ...contents: (Component | Node | Falsy)[]): this
	prependWhen (state: State<boolean>, ...contents: (Component | Node | Falsy)[]): this
	insertWhen (state: State<boolean>, direction: 'before' | 'after', sibling: Component | Element | undefined, ...contents: (Component | Node | Falsy)[]): this
	appendToWhen (state: State<boolean>, destination: ComponentInsertionDestination | Element): this
	prependToWhen (state: State<boolean>, destination: ComponentInsertionDestination | Element): this
	insertToWhen (state: State<boolean>, destination: ComponentInsertionDestination | Element, direction: 'before' | 'after', sibling?: Component | Element): this
}

declare module 'Component' {
	interface ComponentExtensions extends SlotComponentExtensions { }
}

Component.extend(component => {
	component.extend<SlotComponentExtensions>(component => ({
		hasContent () {
			const walker = document.createTreeWalker(component.element, NodeFilter.SHOW_TEXT)
			while (walker.nextNode())
				if (walker.currentNode.textContent?.trim())
					return true

			for (const child of component.getDescendants())
				if (!child.is(Slot))
					return true

			return false
		},
		appendWhen (state, ...contents) {
			let temporaryHolder: Component | undefined = Component().append(...contents)
			Slot().appendTo(component).preserveContents().if(state, slot => {
				slot.append(...contents)
				temporaryHolder?.remove()
				temporaryHolder = undefined
			})
			return component
		},
		prependWhen (state, ...contents) {
			let temporaryHolder: Component | undefined = Component().append(...contents)
			Slot().prependTo(component).preserveContents().if(state, slot => {
				slot.append(...contents)
				temporaryHolder?.remove()
				temporaryHolder = undefined
			})
			return component
		},
		insertWhen (state, direction, sibling, ...contents) {
			let temporaryHolder: Component | undefined = Component().append(...contents)
			Slot().insertTo(component, direction, sibling).preserveContents().if(state, slot => {
				slot.append(...contents)
				temporaryHolder?.remove()
				temporaryHolder = undefined
			})
			return component
		},
		appendToWhen (state, destination) {
			let temporaryHolder: Component | undefined
			if (component.parent) {
				temporaryHolder = Component()
				component.appendTo(temporaryHolder)
			}

			Slot().appendTo(destination).preserveContents().if(state, slot => {
				slot.append(component)
				temporaryHolder?.remove()
				temporaryHolder = undefined
			})
			return component
		},
		prependToWhen (state, destination) {
			let temporaryHolder: Component | undefined
			if (component.parent) {
				temporaryHolder = Component()
				component.appendTo(temporaryHolder)
			}

			Slot().prependTo(destination).preserveContents().if(state, slot => {
				slot.append(component)
				temporaryHolder?.remove()
				temporaryHolder = undefined
			})
			return component
		},
		insertToWhen (state, destination, direction, sibling) {
			let temporaryHolder: Component | undefined
			if (component.parent) {
				temporaryHolder = Component()
				component.appendTo(temporaryHolder)
			}

			Slot().insertTo(destination, direction, sibling).preserveContents().if(state, slot => {
				slot.append(component)
				temporaryHolder?.remove()
				temporaryHolder = undefined
			})
			return component
		},
	}))
})

interface SlotIfElseExtensions {
	elseIf (state: State<boolean>, initialiser: Slot.Initialiser): this
	else (initialiser: Slot.Initialiser): this
}

export interface SlotExtensions {
	use<const STATES extends State<any>[]> (states: STATES, initialiser: (slot: ComponentInsertionTransaction, ...values: { [INDEX in keyof STATES]: STATES[INDEX] extends State<infer T> ? T : never }) => Slot.InitialiserReturn): this
	use<T> (state: T | State<T>, initialiser: (slot: ComponentInsertionTransaction, value: T) => Slot.InitialiserReturn): this
	if (state: State<boolean>, initialiser: Slot.Initialiser): this & SlotIfElseExtensions
	preserveContents (): this
}

interface Slot extends Component, SlotExtensions { }

namespace Slot {
	export type Cleanup = () => unknown
	export type Initialiser = (slot: ComponentInsertionTransaction) => Slot.InitialiserReturn
	export type InitialiserReturn = AbortablePromiseOr<Slot.Cleanup | Component | ComponentInsertionTransaction | undefined | null | false | 0 | '' | void>
}

const Slot = Object.assign(
	Component.Builder((slot): Slot => {
		let unuse: State.Unsubscribe | undefined
		let cleanup: Slot.Cleanup | undefined
		let abort: (() => unknown) | undefined
		let abortTransaction: (() => unknown) | undefined

		interface Elses {
			elseIfs: { state: State<boolean>, initialiser: Slot.Initialiser }[]
			else?: Slot.Initialiser
		}

		const elses = State<Elses>({ elseIfs: [] })
		let unuseElses: State.Unsubscribe | undefined
		let unuseOwner: State.Unsubscribe | undefined
		let preserveContents = false
		let inserted = false
		const hidden = State(false)

		return slot
			.style.bindProperty('display', hidden.mapManual(hidden => hidden ? 'none' : 'contents'))
			.extend<SlotExtensions & SlotIfElseExtensions>(slot => ({
				preserveContents () {
					if (elses.value.elseIfs.length || elses.value.else)
						throw new Error('Cannot preserve contents when using elses')

					preserveContents = true
					return slot
				},
				use: (state: unknown, initialiser: (slot: ComponentInsertionTransaction, ...values: any[]) => Slot.InitialiserReturn) => {
					if (preserveContents)
						throw new Error('Cannot "use" when preserving contents')

					unuse?.(); unuse = undefined
					abort?.(); abort = undefined
					abortTransaction?.(); abortTransaction = undefined
					unuseOwner?.(); unuseOwner = undefined
					unuseElses?.(); unuseElses = undefined

					const wasArrayState = Array.isArray(state)
					if (!wasArrayState)
						state = State.get(state)
					else {
						const owner = State.Owner.create()
						unuseOwner = owner.remove
						state = State.Map(owner, state as State<any>[], (...outputs) => outputs as never[])
					}

					unuse = (state as State<unknown>).use(slot, value => {
						abort?.(); abort = undefined
						cleanup?.(); cleanup = undefined
						abortTransaction?.(); abortTransaction = undefined

						const component = Component()
						const transaction = ComponentInsertionTransaction(component, () => {
							slot.removeContents()
							slot.append(...component.element.children)
							inserted = true
						})
						Object.assign(transaction, { closed: component.removed })
						abortTransaction = transaction.abort

						handleSlotInitialiserReturn(transaction, wasArrayState
							? initialiser(transaction, ...value as never[])
							: initialiser(transaction, value))
					})

					return slot
				},
				if: (state, initialiser) => {
					unuse?.(); unuse = undefined
					abort?.(); abort = undefined
					abortTransaction?.(); abortTransaction = undefined
					unuseOwner?.(); unuseOwner = undefined
					unuseElses?.(); unuseElses = undefined

					state.use(slot, value => {
						abort?.(); abort = undefined
						cleanup?.(); cleanup = undefined
						abortTransaction?.(); abortTransaction = undefined
						unuseOwner?.(); unuseOwner = undefined
						unuseElses?.(); unuseElses = undefined

						if (!value) {
							if (preserveContents) {
								hidden.value = true
								return
							}

							let unuseElsesList: State.Unsubscribe | undefined
							const unuseElsesContainer = elses.useManual(elses => {
								unuseElsesList = State.MapManual(elses.elseIfs.map(({ state }) => state), (...elses) => elses.indexOf(true))
									.useManual(elseToUse => {
										const initialiser = elseToUse === -1 ? elses.else : elses.elseIfs[elseToUse].initialiser
										if (!initialiser) {
											slot.removeContents()
											return
										}

										handleSlotInitialiser(initialiser)
									})
							})

							unuseElses = () => {
								unuseElsesList?.()
								unuseElsesContainer()
							}

							return
						}

						hidden.value = false
						if (preserveContents && inserted)
							return

						handleSlotInitialiser(initialiser)
					})

					return slot
				},
				elseIf (state, initialiser) {
					if (preserveContents)
						throw new Error('Cannot use else when preserving contents')

					elses.value.elseIfs.push({ state, initialiser })
					elses.emit()
					return slot
				},
				else (initialiser) {
					if (preserveContents)
						throw new Error('Cannot use else when preserving contents')

					elses.value.else = initialiser
					elses.emit()
					return slot
				},
			}))
			.tweak(slot => slot.removed.matchManual(true, () => cleanup?.()))

		function handleSlotInitialiser (initialiser: Slot.Initialiser) {
			const component = Component()
			const transaction = ComponentInsertionTransaction(component, () => {
				slot.removeContents()
				slot.append(...component.element.children)
				inserted = true
			})
			Object.assign(transaction, { closed: component.removed })
			abortTransaction = transaction.abort

			handleSlotInitialiserReturn(transaction, initialiser(transaction))
		}

		function handleSlotInitialiserReturn (transaction: ComponentInsertionTransaction, result: Slot.InitialiserReturn) {
			if (!(result instanceof AbortablePromise))
				return handleSlotInitialiserReturnNonPromise(transaction, result || undefined)

			abort = result.abort
			result.then(result => handleSlotInitialiserReturnNonPromise(transaction, result || undefined))
				.catch(err => console.error('Slot initialiser promise rejection:', err))
		}

		function handleSlotInitialiserReturnNonPromise (transaction: ComponentInsertionTransaction, result: Exclude<Slot.InitialiserReturn, Promise<any> | void> | undefined) {
			result ||= undefined

			if (result === slot)
				result = undefined

			transaction.close()
			abortTransaction = undefined

			if (Component.is(result)) {
				result.appendTo(slot)
				inserted = true
				cleanup = undefined
				return
			}

			if (ComponentInsertionDestination.is(result)) {
				cleanup = undefined
				return
			}

			cleanup = result
		}
	}),
	{
		using: <T> (value: T | State<T>, initialiser: (transaction: ComponentInsertionTransaction, value: T) => Slot.InitialiserReturn) =>
			Slot().use(State.get(value), initialiser),
	}
)

export default Slot
