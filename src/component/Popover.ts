import Component, { ComponentPerf } from 'Component'
import Dialog from 'component/Dialog'
import FocusListener from 'utility/FocusListener'
import HoverListener from 'utility/HoverListener'
import type { InputEvent } from 'utility/InputBus'
import InputBus, { HandlesMouseEvents } from 'utility/InputBus'
import Mouse from 'utility/Mouse'
import { mutable } from 'utility/Objects'
import State from 'utility/State'
import Task from 'utility/Task'
import Vector2 from 'utility/Vector2'
import Viewport from 'utility/Viewport'

namespace FocusTrap {
	let component: Component | undefined
	function get () {
		return component ??= Component()
			.tabIndex('auto')
			.ariaHidden()
			.style.setProperties({
				position: 'fixed',
				display: 'none',
			})
			.prependTo(document.body)
	}

	export function show () {
		get().style.setProperty('display', 'inline')
	}

	export function hide () {
		get().style.setProperty('display', 'none')
	}
}

export interface PopoverComponentRegisteredExtensions {
	popover: Popover
	tweakPopover (initialiser: PopoverInitialiser<this>): this
	/** Simulate a click on a button for this popover */
	showPopover (): this
	togglePopover (): this
}

interface InternalPopoverExtensions {
	clickState: boolean
	isHoverable: boolean
}

export type PopoverInitialiser<HOST> = (popover: Popover, host: HOST) => unknown

export interface PopoverComponentExtensions {
	/** Disallow any popovers to continue showing if this component is hovered */
	clearPopover (): this
	setPopover (event: 'hover/longpress' | 'hover/click' | 'click', initialiser: PopoverInitialiser<this>): this & PopoverComponentRegisteredExtensions
	setPopover (event: 'hover/longpress' | 'hover/click' | 'click', popover: Popover): this & PopoverComponentRegisteredExtensions
	hasPopoverSet (): boolean
}

declare module 'Component' {
	interface ComponentExtensions extends PopoverComponentExtensions { }
}

const PopoverHost = Component.Tag()

Component.extend(component => {
	component.extend<PopoverComponentExtensions>((component: Component & PopoverComponentExtensions & Partial<PopoverComponentRegisteredExtensions> & Partial<InternalPopoverExtensions>) => ({
		hasPopoverSet () {
			return !!(component as Component & PopoverComponentRegisteredExtensions).popover
		},
		clearPopover: () => component
			.attributes.set('data-clear-popover', 'true'),
		setPopover: (popoverEvent, initialiserOrPopover) => {
			component.and(PopoverHost)

			if (component.popover)
				component.popover.remove()

			const popoverIn = Component.is(initialiserOrPopover) ? initialiserOrPopover : undefined
			const initialiser = Component.is(initialiserOrPopover) ? undefined : initialiserOrPopover

			if (popoverIn && popoverIn.hasOwner()) {
				console.log('Detaching popover from owner', popoverIn)
				popoverIn.setOwner(undefined)
			}

			component.style.setProperties({
				['-webkitTouchCallout' as never]: 'none',
				userSelect: 'none',
			})

			let isShown = false

			const popover = popoverIn ?? Popover()
				.anchor.from(component)
				.tweak(popover => popover
					.prepend(Component()
						.style(popover.styleTargets.PopoverCloseSurface)
						.event.subscribe('click', () => popover.hide())
					)
				)
				.setOwner(component)
				.setCloseDueToMouseInputFilter(event => {
					const hovered = HoverListener.hovered() ?? null
					if (component.element.contains(hovered))
						return false

					return true
				})
				.event.subscribe('toggle', e => {
					if (!popover.element.matches(':popover-open')) {
						isShown = false
						component.clickState = false
						Mouse.offMove(updatePopoverState)
					}
				})
				.tweak(initialiser, component)
				.tweak(popover => {
					popover.visible.match(popover, true, async () => {
						if (popover.hasContent()) {
							popover.style.setProperty('visibility', 'hidden')
							popover.show()
							await Task.yield()
							popover.anchor.apply()
							await Task.yield()
							popover.anchor.markDirty()
							popover.style.removeProperties('visibility')
						}
					})

					popover.style.bind(popover.anchor.state.mapManual((location, oldLocation) => (location?.preference ?? oldLocation?.preference)?.yAnchor.side === 'bottom'), popover.styleTargets.Popover_AnchoredTop)
					popover.style.bind(popover.anchor.state.mapManual((location, oldLocation) => (location?.preference ?? oldLocation?.preference)?.xAnchor.side === 'left'), popover.styleTargets.Popover_AnchoredLeft)
				})

			const combinedOwner = State.Owner.getCombined(component, popover)

			if (!popoverIn)
				component.getStateForClosest(Dialog)
					.map(popover, dialog => dialog() ?? document.body)
					.use(popover, parent => popover.appendTo(parent))

			let touchTimeout: number | undefined
			let touchStart: Vector2 | undefined
			let longpressed = false
			function cancelLongpress () {
				longpressed = false
				touchStart = undefined
				clearTimeout(touchTimeout)
			}
			component.event.until(combinedOwner, event => event
				.subscribe('touchstart', event => {
					touchStart = Vector2.fromClient(event.touches[0])
					if (event.touches.length > 1)
						return cancelLongpress()

					const closestWithPopover = [
						event.targetComponent,
						...event.targetComponent?.getAncestorComponents() ?? [],
					]
						.find(component => component?.hasPopoverSet())

					////////////////////////////////////
					//#region Debugging

					// function useError (supplier: () => unknown) {
					// 	try {
					// 		return supplier()
					// 	}
					// 	catch (e) {
					// 		return e instanceof Error ? e.message : String(e)
					// 	}
					// }
					// Component('pre')
					// 	.style.setProperties({
					// 		position: 'relative',
					// 		zIndex: '2',
					// 		background: '#222',
					// 		color: '#aaa',
					// 		fontSize: 'var(--font-0)',
					// 		whiteSpace: 'pre-wrap',
					// 	})
					// 	.text.set(Object
					// 		.entries({
					// 			eventPopoverHost: component?.fullType,
					// 			...(event.targetComponent === component
					// 				? { targetIsEventHost: true }
					// 				: {
					// 					targetIsEventHost: false,
					// 					target: event.targetComponent?.fullType,
					// 					...(closestWithPopover === component
					// 						? { closestIsEventHost: true }
					// 						: {
					// 							closestIsEventHost: false,
					// 							closestPopoverHost: closestWithPopover?.fullType,
					// 						}
					// 					),
					// 				}
					// 			),
					// 		})
					// 		.map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
					// 		.join('\n')
					// 	)
					// 	.appendTo(component)

					//#endregion
					////////////////////////////////////

					if (closestWithPopover !== component)
						return

					touchTimeout = window.setTimeout(() => {
						longpressed = true
						void updatePopoverState(null, null, 'longpress')
					}, 800)
				})
				.subscribePassive('touchmove', event => {
					if (!touchStart)
						return

					if (event.touches.length > 1)
						return cancelLongpress()

					const newPosition = Vector2.fromClient(event.touches[0])
					if (!Vector2.distanceWithin(20, touchStart, newPosition))
						return cancelLongpress()
				})
				.subscribe('touchend', event => {
					if (longpressed)
						event.preventDefault()

					cancelLongpress()
				})
			)

			const hostHoveredOrFocusedForLongEnough = component.hoveredOrFocused.delay(combinedOwner, hoveredOrFocused => {
				if (!hoveredOrFocused)
					return 0 // no delay for mouseoff or blur

				return popover.getDelay()
			})

			if ((popoverEvent === 'hover/click' || popoverEvent === 'hover/longpress') && !component.popover)
				hostHoveredOrFocusedForLongEnough.subscribe(component, updatePopoverState)

			component.clickState = false
			if (!component.popover) {
				component.event.until(combinedOwner, event => event
					.subscribe('click', async event => {
						if (popoverEvent === 'hover/longpress')
							return

						const closestHandlesMouseEvents = (event.target as HTMLElement).component?.closest(HandlesMouseEvents)
						if (closestHandlesMouseEvents && closestHandlesMouseEvents?.element !== component.element && component.element.contains(closestHandlesMouseEvents.element))
							return

						component.clickState = !component.clickState

						event.stopPropagation()
						event.preventDefault()

						if (component.clickState)
							await showPopoverClick()
						else
							popover.hide()
					})
				)

				ComponentPerf.CallbacksOnInsertions.add(component, updatePopoverParent)
				// component.receiveInsertEvents()
				// component.receiveAncestorInsertEvents()
				// component.event.subscribe(['insert', 'ancestorInsert'], updatePopoverParent)
			}

			popover.popoverHasFocus.subscribe(combinedOwner, (hasFocused, oldValue) => {
				if (hasFocused)
					return

				component.clickState = false
				component.popover?.hide()
				if (oldValue !== 'no-focus')
					component.focus()
			})

			return component.extend<PopoverComponentRegisteredExtensions>(component => ({
				popover,
				popoverDescendants: [],
				tweakPopover: initialiser => {
					initialiser(component.popover, component)
					return component
				},
				showPopover: () => {
					void showPopoverClick()
					return component
				},
				togglePopover: () => {
					if (popover.visible.value)
						popover.hide()
					else
						void showPopoverClick()

					return component
				},
			}))

			async function showPopoverClick () {
				popover.anchor.from(component)
				popover.style.setProperty('visibility', 'hidden')
				popover.show()
				popover.focus()
				popover.style.removeProperties('left', 'top')
				await Task.yield()
				popover.anchor.apply()
				await Task.yield()
				popover.anchor.markDirty()
				popover.style.removeProperties('visibility')
			}

			function updatePopoverParent () {
				if (!component.popover)
					return

				const oldParent = component.popover.popoverParent.value
				component.popover.popoverParent.asMutable?.setValue(component.closest(Popover))
				if (oldParent && oldParent !== component.popover.popoverParent.value)
					oldParent.popoverChildren.asMutable?.setValue(oldParent.popoverChildren.value.filter(c => c !== component.popover))

				if (component.popover.popoverParent.value && component.popover.popoverParent.value !== oldParent)
					component.popover.popoverParent.value.popoverChildren.asMutable?.setValue([...component.popover.popoverParent.value.popoverChildren.value, component.popover])
			}

			async function updatePopoverState (_1?: any, _2?: any, reason?: 'longpress') {
				if (!component.popover)
					return

				const shouldShow = false
					|| (hostHoveredOrFocusedForLongEnough.value && !Viewport.tablet.value)
					|| reason === 'longpress'
					|| (true
						&& isShown
						&& (false
							|| (component.popover.isHoverable.value && component.popover.isMouseWithin(true) && !shouldClearPopover())
							|| InputBus.isDown('F4'))
					)
					|| !!component.clickState

				////////////////////////////////////
				//#region Debugging

				// Component('pre')
				// 	.style.setProperties({
				// 		fontSize: 'var(--font-0)',
				// 		whiteSpace: 'pre-wrap',
				// 	})
				// 	.text.set(JSON.stringify({
				// 		shouldShow,
				// 		isShown,
				// 		reason,
				// 	}, null, '  '))
				// 	.prependTo(document.body)

				//#endregion
				////////////////////////////////////

				if (isShown === shouldShow)
					return

				if (hostHoveredOrFocusedForLongEnough.value && !isShown)
					Mouse.onMove(updatePopoverState)

				if (!shouldShow)
					Mouse.offMove(updatePopoverState)

				if (!shouldShow)
					FocusTrap.hide()

				isShown = shouldShow
				popover.toggle(shouldShow)
				if (!shouldShow)
					return

				popover.anchor.from(component)
				popover.style.setProperty('visibility', 'hidden')
				FocusTrap.show()
				// component.popover.style.removeProperties('left', 'top')
				await Task.yield()
				popover.anchor.apply()
				await Task.yield()
				popover.anchor.markDirty()
				popover.style.removeProperties('visibility')
			}

			function shouldClearPopover () {
				if (!component.popover)
					return false

				const hovered = HoverListener.hovered() ?? null
				if (component.element.contains(hovered) || component.popover.element.contains(hovered))
					return false

				const clearsPopover = hovered?.closest('[data-clear-popover]')
				if (!clearsPopover)
					return false

				const clearsPopoverContainsHost = clearsPopover.contains(component.element)
				if (clearsPopoverContainsHost)
					return false

				const clearsPopoverWithinPopover = clearsPopover.component?.closest(Popover)
				if (component.popover.containsPopoverDescendant(clearsPopoverWithinPopover))
					return false

				return true
			}
		},
	}))
})

export interface PopoverExtensions {
	readonly visible: State<boolean>
	readonly popoverChildren: State<readonly Popover[]>
	readonly popoverParent: State<Popover | undefined>
	readonly popoverHasFocus: State<'focused' | 'no-focus' | undefined>
	readonly lastStateChangeTime: number
	readonly isHoverable: State<boolean>

	/** Sets the distance the mouse can be from the popover before it hides, if it's shown due to hover */
	setMousePadding (padding?: number): this
	/** Sets the delay until this popover will show (only in hover mode) */
	setDelay (ms: number): this
	getDelay (): number
	// /** Disables using the popover API for this element, using normal stacking instead of the element going into the top layer */
	// setNormalStacking (): this

	isMouseWithin (checkDescendants?: true): boolean
	containsPopoverDescendant (node?: Node | Component): boolean
	/** Defaults on */
	setCloseOnInput (closeOnInput?: boolean): this
	setCloseDueToMouseInputFilter (filter: (event: InputEvent) => boolean): this
	/** Disallow this popover from being hoverable (to keep it open) */
	notHoverable (): this

	show (): this
	hide (): this
	toggle (shown?: boolean): this
	bind (state: State<boolean>): this
	unbind (): this
}

enum PopoverStyleTargets {
	Popover,
	PopoverCloseSurface,
	Popover_AnchoredTop,
	Popover_AnchoredLeft,
}

interface Popover extends Component, PopoverExtensions, Component.StyleHost<typeof PopoverStyleTargets> { }

const Popover = Object.assign(
	Component((component): Popover => {
		let mousePadding: number | undefined
		let delay = 0
		let unbind: State.Unsubscribe | undefined
		const visible = State(false)
		let shouldCloseOnInput = true
		const hoverable = State(true)
		let inputFilter: ((event: InputEvent) => boolean) | undefined
		// let normalStacking = false
		const popover = component
			.style.setProperties({
				position: 'fixed',
				margin: 0,
				overflow: 'visible',
				transitionBehavior: 'allow-discrete',
			})
			.tabIndex('programmatic')
			.attributes.set('popover', 'manual')
			.extend<PopoverExtensions>(popover => ({
				lastStateChangeTime: 0,
				visible,
				popoverChildren: State([]),
				popoverParent: State(undefined),
				popoverHasFocus: FocusListener.focused.map(popover, focused =>
					!focused ? 'no-focus'
						: (visible.value && containsPopoverDescendant(focused)) ? 'focused'
							: undefined
				),
				isHoverable: hoverable,

				setCloseOnInput (closeOnInput = true) {
					shouldCloseOnInput = closeOnInput
					return popover
				},
				setCloseDueToMouseInputFilter (filter) {
					inputFilter = filter
					return popover
				},
				setMousePadding: padding => {
					mousePadding = padding
					return popover
				},
				notHoverable () {
					hoverable.value = false
					return popover
				},
				setDelay (ms) {
					delay = ms
					return popover
				},
				getDelay () {
					return delay
				},
				// setNormalStacking () {
				// 	Viewport.tablet.use(popover, isTablet => {
				// 		const tablet = isTablet()
				// 		popover.style.toggle(!tablet, 'popover--normal-stacking')
				// 		popover.attributes.toggle(tablet, 'popover', 'manual')
				// 		normalStacking = !tablet
				// 		togglePopover(visible.value)
				// 	})

				// 	return popover
				// },

				isMouseWithin: (checkDescendants: boolean = false) => {
					const padding = mousePadding ?? 100
					const x = popover.rect.value.x - padding
					const y = popover.rect.value.y - padding
					const width = popover.rect.value.width + padding * 2
					const height = popover.rect.value.height + padding * 2
					const mouseX = Mouse.state.value.x
					const mouseY = Mouse.state.value.y
					const intersects = (mouseX >= x && mouseX <= x + width) && (mouseY >= y && mouseY <= y + height)
					if (intersects)
						return true

					if (checkDescendants)
						for (const child of popover.popoverChildren.value)
							if (child.isMouseWithin(true))
								return true

					return false
				},
				containsPopoverDescendant,

				show: () => {
					unbind?.()
					togglePopover(true)
					popover.visible.asMutable?.setValue(true)
					return popover
				},
				hide: () => {
					unbind?.()
					togglePopover(false)
					popover.visible.asMutable?.setValue(false)
					return popover
				},
				toggle: shown => {
					unbind?.()
					togglePopover(shown)
					popover.visible.asMutable?.setValue(shown ?? !popover.visible.value)
					return popover
				},
				bind: state => {
					unbind?.()
					unbind = state.use(popover, shown => {
						togglePopover(shown)
						popover.visible.asMutable?.setValue(shown)
					})
					return popover
				},
				unbind: () => {
					unbind?.()
					return popover
				},
			}))
			.addStyleTargets(PopoverStyleTargets)

		const style = popover.styleTargets
		popover.style(style.Popover)

		popover.event.subscribe('toggle', event => {
			popover.visible.asMutable?.setValue(event.newState === 'open')
		})

		popover.onRooted(() => {
			InputBus.event.subscribe('Down', onInputDown)
			popover.removed.matchManual(true, () => InputBus.event.unsubscribe('Down', onInputDown))
		})

		return popover

		function togglePopover (shown?: boolean) {
			if (!popover.hasContent())
				shown = false

			// if (normalStacking && !Viewport.tablet.value)
			// 	popover.style.toggle(!shown, 'popover--normal-stacking--hidden')
			// else
			if (Viewport.tablet.value || popover.rooted.value)
				popover
					// .style.remove('popover--normal-stacking--hidden')
					.attributes.set('popover', 'manual')
					.element.togglePopover(shown)

			mutable(popover).lastStateChangeTime = Date.now()
		}

		function onInputDown (_: any, event: InputEvent) {
			if (!popover.visible.value || !shouldCloseOnInput)
				return

			if (!event.key.startsWith('Mouse') || popover.containsPopoverDescendant(HoverListener.hovered()))
				return

			if (inputFilter && !inputFilter(event))
				return

			if (popover.rooted.value)
				popover
					.attributes.set('popover', 'manual')
					.element.togglePopover(false)

			popover.visible.asMutable?.setValue(false)

			mutable(popover).lastStateChangeTime = Date.now()
		}

		function containsPopoverDescendant (descendant?: Node | Component) {
			if (!descendant)
				return false

			const node = Component.is(descendant) ? descendant.element : descendant
			if (popover.element.contains(node))
				return true

			for (const child of popover.popoverChildren.value)
				if (child === descendant)
					return true
				else if (child.containsPopoverDescendant(descendant))
					return true

			return false
		}
	}),
	{
		forceCloseAll () {
			for (const popoverHost of Component.findAll(PopoverHost)) {
				const host = popoverHost as Component & PopoverComponentRegisteredExtensions & InternalPopoverExtensions
				host.clickState = false
				host.popover.hide()
			}
		},
	},
)

export default Popover
