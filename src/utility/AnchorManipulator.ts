import type Component from 'Component'
import Mouse from 'utility/Mouse'
import type { PartialRecord } from 'utility/Objects'
import State from 'utility/State'
import Time from 'utility/Time'
import Viewport from 'utility/Viewport'

////////////////////////////////////
//#region Anchor Strings

export const ANCHOR_TYPES = ['off', 'aligned'] as const
export type AnchorType = (typeof ANCHOR_TYPES)[number]

export const ANCHOR_SIDE_HORIZONTAL = ['left', 'right'] as const
export type AnchorSideHorizontal = (typeof ANCHOR_SIDE_HORIZONTAL)[number]

export const ANCHOR_SIDE_VERTICAL = ['top', 'bottom'] as const
export type AnchorSideVertical = (typeof ANCHOR_SIDE_VERTICAL)[number]

export type AnchorOffset = `+${number}` | `-${number}`
export type AnchorStringHorizontalSimple = `${AnchorType} ${AnchorSideHorizontal}` | 'centre'
export type AnchorStringHorizontal = `${'sticky ' | ''}${AnchorStringHorizontalSimple}${'' | ` ${AnchorOffset}`}`
export type AnchorStringVerticalSimple = `${AnchorType} ${AnchorSideVertical}` | 'centre'
export type AnchorStringVertical = `${'sticky ' | ''}${AnchorStringVerticalSimple}${'' | ` ${AnchorOffset}`}`
export type AnchorStringSimple = AnchorStringHorizontalSimple | AnchorStringVerticalSimple
export type AnchorString = AnchorStringHorizontal | AnchorStringVertical

const anchorStrings = new Set<AnchorString>(ANCHOR_TYPES
	.flatMap(type => [ANCHOR_SIDE_HORIZONTAL, ANCHOR_SIDE_VERTICAL]
		.flatMap(sides => sides
			.map(side => `${type} ${side}` as const)))
	.flatMap(type => [type, `sticky ${type}` as const]))

anchorStrings.add('centre')
anchorStrings.add('sticky centre')

function isAnchorString (value: unknown): value is AnchorString {
	if (anchorStrings.has(value as AnchorString)) {
		return true
	}

	if (typeof value !== 'string') {
		return false
	}

	const lastSpace = value.lastIndexOf(' ')
	if (lastSpace === -1) {
		return false
	}

	const simpleAnchorString = value.slice(0, lastSpace)
	if (!anchorStrings.has(simpleAnchorString as AnchorString)) {
		return false
	}

	const offsetString = value.slice(lastSpace + 1)
	return !isNaN(+offsetString)
}

function parseAnchor (anchor: AnchorStringHorizontal): AnchorLocationHorizontal
function parseAnchor (anchor: AnchorStringVertical): AnchorLocationVertical
function parseAnchor (anchor: AnchorString): AnchorLocationHorizontal | AnchorLocationVertical {
	const sticky = anchor.startsWith('sticky')
	if (sticky) {
		anchor = anchor.slice(7) as AnchorStringSimple
	}

	const simpleAnchor = anchor as AnchorStringSimple
	if (simpleAnchor === 'centre') {
		return { sticky, type: 'centre', side: 'centre', offset: 0 }
	}

	const [type, side, offset] = simpleAnchor.split(' ') as [AnchorType, AnchorSideHorizontal | AnchorSideVertical, AnchorOffset?]
	return {
		sticky,
		type,
		side,
		offset: offset ? +offset : 0,
	}
}

//#endregion
////////////////////////////////////

////////////////////////////////////
//#region Anchor Location

export interface AnchorLocationPreference {
	xAnchor: AnchorLocationHorizontal
	xRefSelector: string
	yAnchor: AnchorLocationVertical
	yRefSelector: string
	options?: AnchorLocationPreferenceOptions
}

export interface AnchorLocationPreferenceOptions {
	allowXOffscreen?: true
	allowYOffscreen?: true
	xValid?(x: number, hostBox: DOMRect | undefined, anchoredBox: DOMRect): boolean
	yValid?(y: number, hostBox: DOMRect | undefined, anchoredBox: DOMRect): boolean
}

export interface AnchorLocationHorizontal {
	type: AnchorType | 'centre'
	side: AnchorSideHorizontal | 'centre'
	sticky: boolean
	offset: number
}

export interface AnchorLocationVertical {
	type: AnchorType | 'centre'
	side: AnchorSideVertical | 'centre'
	sticky: boolean
	offset: number
}

export const ANCHOR_LOCATION_ALIGNMENTS = ['left', 'centre', 'right'] as const
export type AnchorLocationAlignment = (typeof ANCHOR_LOCATION_ALIGNMENTS)[number]

export interface AnchorLocation {
	x: number
	y: number
	mouse: boolean
	padX: boolean
	xPosSide: 'left' | 'right'
	yPosSide: 'top' | 'bottom'
	alignment?: AnchorLocationAlignment

	xRefBox?: DOMRect
	yRefBox?: DOMRect

	preference?: AnchorLocationPreference
}

//#endregion
////////////////////////////////////

////////////////////////////////////
//#region Implementation

export const AllowYOffscreen: AnchorLocationPreferenceOptions = { allowYOffscreen: true }
export const AllowXOffscreen: AnchorLocationPreferenceOptions = { allowXOffscreen: true }

interface AnchorManipulator<HOST> {
	readonly state: State<AnchorLocation | undefined>
	isMouse (): boolean
	/** Reset the location preference for this anchor */
	reset (): HOST
	from (component: Component): HOST
	/**
	 * Add a location fallback by defining an x and y anchor on the source component.
	 */
	add (xAnchor: AnchorStringHorizontal, yAnchor: AnchorStringVertical, options?: AnchorLocationPreferenceOptions): HOST
	/**
	 * Add a location fallback by defining an x anchor on a selected ancestor component (or descendant when prefixed with `>>`), and a y anchor on the source component.
	 */
	add (xAnchor: AnchorStringHorizontal, xRefSelector: string, yAnchor: AnchorStringVertical, options?: AnchorLocationPreferenceOptions): HOST
	/**
	 * Add a location fallback by defining an x anchor on the source component, and a y anchor on a selected ancestor component (or descendant when prefixed with `>>`)
	 */
	add (xAnchor: AnchorStringHorizontal, yAnchor: AnchorStringVertical, yRefSelector: string, options?: AnchorLocationPreferenceOptions): HOST
	/**
	 * Add a location fallback by defining x and y anchors on selected ancestor components (or descendants when prefixed with `>>`)
	 */
	add (xAnchor: AnchorStringHorizontal, xRefSelector: string, yAnchor: AnchorStringVertical, yRefSelector: string, options?: AnchorLocationPreferenceOptions): HOST
	/** Rather than anchoring on the mouse when all other fallbacks are invalid, hides the anchored element entirely */
	orElseHide (): HOST

	/**
	 * Marks the anchor positioning "dirty", causing it to be recalculated from scratch on next poll
	 */
	markDirty (): HOST
	get (): AnchorLocation
	apply (): HOST
}

function AnchorManipulator<HOST extends Component> (host: HOST): AnchorManipulator<HOST> {
	let locationPreference: (AnchorLocationPreference | false)[] | undefined
	let refCache: PartialRecord<string, WeakRef<Component>> | undefined
	const location = State<AnchorLocation | undefined>(undefined)
	let currentAlignment: AnchorLocationAlignment | undefined

	let from: Component | undefined

	let lastRender = 0
	let rerenderTimeout: number | undefined
	const subscribed: State.Unsubscribe[] = []
	const addSubscription = (use?: State.Unsubscribe) => use && subscribed.push(use)

	let unuseFrom: State.Unsubscribe | undefined

	let applyOwner: State.Owner.Removable | undefined
	let renderId = 0
	let rendered = false
	const result: AnchorManipulator<HOST> = {
		state: location,
		isMouse: () => !locationPreference?.length,
		from: component => {
			unuseFrom?.()
			from = component
			refCache = undefined
			result.markDirty()
			unuseFrom = from?.removed.useManual(removed => {
				if (removed) {
					from = undefined
					unuseFrom?.()
					unuseFrom = undefined
				}
			})
			return host
		},
		reset: () => {
			locationPreference = undefined
			result.markDirty()
			return host
		},
		add: (...config: (string | AnchorLocationPreferenceOptions | undefined)[]) => {
			const options = typeof config[config.length - 1] === 'string' ? undefined
				: config.pop() as AnchorLocationPreferenceOptions

			let [xAnchor, xRefSelector, yAnchor, yRefSelector] = config as string[]
			if (isAnchorString(xRefSelector)) {
				yRefSelector = yAnchor
				yAnchor = xRefSelector
				xRefSelector = '*'
			}

			yRefSelector ??= '*'

			locationPreference ??= []
			locationPreference.push({
				xAnchor: parseAnchor(xAnchor as AnchorStringHorizontal),
				xRefSelector,
				yAnchor: parseAnchor(yAnchor as AnchorStringVertical),
				yRefSelector,
				options,
			})

			result.markDirty()
			return host
		},
		orElseHide: () => {
			locationPreference?.push(false)
			return host
		},
		markDirty: () => {
			const anchoredBox = host.rect.value
			if (!anchoredBox.width || !anchoredBox.height)
				return host

			location.value = undefined

			if (lastRender) {
				const timeSinceLastRender = Date.now() - lastRender
				if (timeSinceLastRender > Time.frame)
					result.apply()
				else if (rerenderTimeout === undefined)
					rerenderTimeout = window.setTimeout(result.apply, Time.frame - timeSinceLastRender)
			}

			return host
		},
		get: () => {
			if (location.value)
				return location.value

			for (const unuse of subscribed)
				unuse()

			subscribed.length = 0

			const anchoredBox = host.rect.value
			if (!anchoredBox.width || !anchoredBox.height) {
				location.value = undefined
				return { x: 0, y: 0, mouse: false } as AnchorLocation
			}

			if (anchoredBox && locationPreference && from) {
				for (const preference of locationPreference) {
					if (!preference)
						return location.value ??= { mouse: false, x: -10000, y: -10000, padX: false, xPosSide: 'left', yPosSide: 'top' }

					let alignment: AnchorLocationAlignment = 'left'

					const xConf = preference.xAnchor
					const xRef = resolveAnchorRef(preference.xRefSelector)
					if (preference.xRefSelector !== '*' && !xRef)
						continue

					const xBox = xRef?.rect.value
					addSubscription(xRef?.rect.subscribe(host, result.markDirty))

					const xRefCentre = (xBox?.left ?? 0) + (xBox?.width ?? Viewport.size.value.w) / 2
					const xRefLeft = xBox?.left ?? xRefCentre
					const xRefRight = xBox?.right ?? xRefCentre

					let boxLeft: number, boxRight: number
					switch (xConf.type) {
						case 'aligned':
							alignment = xConf.side
							if (xConf.side === 'left') {
								// this.left = anchor.left
								boxLeft = xRefLeft + xConf.offset
								boxRight = boxLeft + anchoredBox.width
							}
							else {
								// this.right = anchor.right
								boxRight = xRefRight - xConf.offset
								boxLeft = boxRight - anchoredBox.width
							}
							break
						case 'off':
							alignment = xConf.side === 'left' ? 'right' : 'left'
							if (xConf.side === 'left') {
								// this.right = anchor.left
								boxRight = xRefLeft - xConf.offset
								boxLeft = boxRight - anchoredBox.width
							}
							else {
								// this.left = anchor.right
								boxLeft = xRefRight + xConf.offset
								boxRight = boxLeft + anchoredBox.width
							}
							break
						case 'centre':
							boxLeft = xRefCentre - anchoredBox.width / 2
							boxRight = boxLeft + anchoredBox.width
							alignment = 'centre'
							break
					}

					if (preference.options?.xValid?.(boxLeft, xBox, anchoredBox) === false)
						continue

					if (anchoredBox.width < Viewport.size.value.w && !preference.options?.allowXOffscreen) {
						const isXOffScreen = boxLeft < 0 || boxRight > Viewport.size.value.w
						if (isXOffScreen && !xConf.sticky)
							continue

						if (boxLeft < 0) {
							boxLeft = 0
							boxRight = anchoredBox.width
						}
						else if (boxRight > Viewport.size.value.w) {
							boxRight = Viewport.size.value.w
							boxLeft = boxRight - anchoredBox.width
						}
					}

					const yConf = preference.yAnchor
					const yRef = resolveAnchorRef(preference.yRefSelector)
					if (preference.yRefSelector !== '*' && !yRef)
						continue

					const yBox = yRef?.rect.value
					addSubscription(yRef?.rect.subscribe(host, result.markDirty))

					const yRefCentre = (yBox?.top ?? 0) + (yBox?.height ?? Viewport.size.value.h) / 2
					const yRefTop = yBox?.top ?? yRefCentre
					const yRefBottom = yBox?.bottom ?? yRefCentre

					let boxTop: number, boxBottom: number
					switch (yConf.type) {
						case 'aligned':
							if (yConf.side === 'top') {
								// this.top = anchor.top
								boxTop = yRefTop + yConf.offset
								boxBottom = boxTop + anchoredBox.height
							}
							else {
								// this.bottom = anchor.bottom
								boxBottom = yRefBottom - yConf.offset
								boxTop = boxBottom - anchoredBox.height
							}
							break
						case 'off':
							if (yConf.side === 'top') {
								// this.bottom = anchor.top
								boxBottom = yRefTop - yConf.offset
								boxTop = boxBottom - anchoredBox.height
							}
							else {
								// this.top = anchor.bottom
								boxTop = yRefBottom + yConf.offset
								boxBottom = boxTop + anchoredBox.height
							}
							break
						case 'centre':
							boxTop = yRefCentre - anchoredBox.height / 2
							boxBottom = boxTop + anchoredBox.height
							break
					}

					if (preference.options?.yValid?.(boxTop, yBox, anchoredBox) === false)
						continue

					if (anchoredBox.height < Viewport.size.value.h && !preference.options?.allowYOffscreen) {
						const isYOffScreen = boxTop < 0 || boxBottom > Viewport.size.value.h
						if (isYOffScreen && !yConf.sticky)
							continue

						if (boxTop < 0) {
							boxTop = 0
							boxBottom = anchoredBox.height
						}
						else if (boxBottom > Viewport.size.value.h) {
							boxBottom = Viewport.size.value.h
							boxTop = boxBottom - anchoredBox.height
						}
					}

					let finalX: number, finalY: number, xPosSide: 'left' | 'right', yPosSide: 'top' | 'bottom'

					if ((xConf.type === 'aligned' && xConf.side === 'right') || (xConf.type === 'off' && xConf.side === 'left')) {
						xPosSide = 'right'
						finalX = Viewport.sizeExcludingScrollbars.value.w - boxRight
					}
					else {
						xPosSide = 'left'
						finalX = boxLeft
					}

					if ((yConf.type === 'aligned' && yConf.side === 'bottom') || (yConf.type === 'off' && yConf.side === 'top')) {
						yPosSide = 'bottom'
						finalY = Viewport.sizeExcludingScrollbars.value.h - boxBottom
					}
					else {
						yPosSide = 'top'
						finalY = boxTop
					}

					return (location.value ??= {
						mouse: false,
						padX: xConf.type === 'off',
						alignment,
						x: finalX,
						y: finalY,
						xPosSide,
						yPosSide,
						yRefBox: yBox,
						xRefBox: xBox,
						preference,
					})
				}
			}

			return location.value ??= { mouse: true, padX: true, ...Mouse.state.value, xPosSide: 'left', yPosSide: 'top' }
		},
		apply: () => {
			applyOwner?.remove(); applyOwner = State.Owner.create()

			const location = result.get()
			let alignment = location.alignment ?? currentAlignment
			if (location.mouse) {
				const shouldFlip = currentAlignment === 'centre' || (currentAlignment === 'right' ? location.x < Viewport.size.value.w / 2 - 200 : location.x > Viewport.size.value.w / 2 + 200)
				if (shouldFlip) {
					alignment = currentAlignment === 'left' ? 'right' : 'left'
				}

				Mouse.onMove(result.markDirty)
				applyOwner.removed.subscribeManual(removed => removed && Mouse.offMove(result.markDirty))
			}

			if (currentAlignment !== alignment) {
				currentAlignment = alignment
				// this.surface.classes.removeStartingWith("aligned-")
				// this.surface.classes.add(`aligned-${this.currentAlignment}`)
			}

			// this.surface.classes.toggle(location.padX, "pad-x")
			host.element.style.left = location.xPosSide === 'left' ? `${location.x}px` : 'auto'
			host.element.style.right = location.xPosSide === 'right' ? `${location.x}px` : 'auto'
			host.element.style.top = location.yPosSide === 'top' ? `${location.y}px` : 'auto'
			host.element.style.bottom = location.yPosSide === 'bottom' ? `${location.y}px` : 'auto'
			host.rect.markDirty()
			if (!rendered) {
				const id = ++renderId
				host.style.setProperty('display', 'none')
				host.style.setProperty('transition-duration', '0s')
				void new Promise(resolve => setTimeout(resolve, 50)).then(() => {
					if (renderId !== id)
						return

					host.style.removeProperties('display', 'transition-duration')
					rendered = true
				})
			}

			rerenderTimeout = undefined
			lastRender = Date.now()

			return host
		},
	}

	return result

	function resolveAnchorRef (selector: string): Component | undefined {
		const refRef = refCache?.[selector]

		let ref: Component | undefined
		if (refRef) {
			ref = refRef.deref()
		}
		else {
			ref = selector.startsWith('>>')
				? from?.element.querySelector(selector.slice(2))?.component
				: from?.element.closest(selector)?.component

			if (ref) {
				if (getComputedStyle(ref.element).display === 'contents') {
					const children = ref.element.children
					if (!children.length)
						console.warn('Anchor ref has display: contents and no children')
					else {
						ref = children[0].component ?? ref
						if (children.length > 1)
							console.warn('Anchor ref has display: contents and multiple children')
					}
				}

				refCache ??= {}
				refCache[selector] = new WeakRef(ref)
			}
		}

		return ref
	}
}

export default AnchorManipulator

//#endregion
////////////////////////////////////
