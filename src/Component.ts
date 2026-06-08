import type Label from 'component/Label'
import AnchorManipulator from 'utility/AnchorManipulator'
import { Truthy } from 'utility/Arrays'
import AttributeManipulator from 'utility/AttributeManipulator'
import ClassManipulator from 'utility/ClassManipulator'
import type { NativeEvents } from 'utility/EventManipulator'
import EventManipulator from 'utility/EventManipulator'
import FocusListener from 'utility/FocusListener'
import type { AnyFunction } from 'utility/Functions'
import Maps from 'utility/Maps'
import type { Mutable } from 'utility/Objects'
import { DefineMagic, DefineProperty, mutable } from 'utility/Objects'
import State from 'utility/State'
import StringApplicator from 'utility/StringApplicator'
import Strings from 'utility/Strings'
import type { ComponentName } from 'utility/StyleManipulator'
import StyleManipulator from 'utility/StyleManipulator'
import TextManipulator from 'utility/TextManipulator'
import type { Falsy } from 'utility/Type'
import Viewport from 'utility/Viewport'

const selfScript = State<string | undefined>(undefined)

const SYMBOL_COMPONENT_BRAND = Symbol('COMPONENT_BRAND')

type MoveBeforeParent = Element & {
	moveBefore?: (node: Node, child: Node | null) => void
}

function moveOrInsertBefore (parent: Element, node: Node, child: Node | null) {
	const moveBefore = (parent as MoveBeforeParent).moveBefore
	if (moveBefore && node.parentNode && node.isConnected && parent.isConnected && node.getRootNode() === parent.getRootNode())
		moveBefore.call(parent, node, child)
	else
		parent.insertBefore(node, child)
}

function appendNodes (parent: Element, nodes: Node[]) {
	for (const node of nodes)
		moveOrInsertBefore(parent, node, null)
}

function prependNodes (parent: Element, nodes: Node[]) {
	for (let i = nodes.length - 1; i >= 0; i--)
		moveOrInsertBefore(parent, nodes[i], parent.firstChild)
}
export interface ComponentBrand<TYPE extends string> {
	[SYMBOL_COMPONENT_BRAND]: TYPE
}

type AriaRole =
	| 'button'
	| 'checkbox'
	| 'form'
	| 'main'
	| 'navigation'
	| 'toolbar'
	| 'textbox'
	| 'group'
	| 'radio'
	| 'radiogroup'
	| 'tablist'
	| 'tab'
	| 'tabpanel'

const ELEMENT_TO_COMPONENT_MAP = new WeakMap<Element, Component>()

declare global {
	interface Node {
		component?: Component
	}
}

DefineMagic(Element.prototype, 'component', {
	get (): Component | undefined {
		return ELEMENT_TO_COMPONENT_MAP.get(this)
	},
	set (component): void {
		if (component) {
			ELEMENT_TO_COMPONENT_MAP.set(this, component)
		}
		else {
			ELEMENT_TO_COMPONENT_MAP.delete(this)
		}
	},
})

export interface ComponentInsertionDestination {
	readonly isInsertionDestination: true
	append (...contents: (Component | Node | Falsy)[]): this
	prepend (...contents: (Component | Node | Falsy)[]): this
	insert (direction: 'before' | 'after', sibling: Component | Element | undefined, ...contents: (Component | Node | Falsy)[]): this
}

export namespace ComponentInsertionDestination {
	export function is (value: unknown): value is ComponentInsertionDestination {
		return typeof value === 'object' && !!(value as ComponentInsertionDestination)?.isInsertionDestination
	}
}

export interface ComponentEvents extends NativeEvents {
	insert (): any
	ancestorInsert (): any
	ancestorScroll (): any
	descendantInsert (): any
	descendantRemove (): any
	childrenInsert (nodes: Node[]): any
	ancestorRectDirty (): any
	root (): any
	unroot (): any
}

export interface ComponentExtensions<ELEMENT extends HTMLElement = HTMLElement> { }

interface BaseComponent<ELEMENT extends HTMLElement = HTMLElement> extends ComponentInsertionDestination {
	readonly isComponent: true
	readonly supers: State<any[]>

	readonly classes: ClassManipulator<this>
	readonly attributes: AttributeManipulator<this>
	readonly event: EventManipulator<this, ComponentEvents>
	readonly text: TextManipulator<this>
	readonly style: StyleManipulator<this>
	readonly anchor: AnchorManipulator<this>
	readonly nojit: Partial<this>
	readonly __dom: ComponentDomController

	readonly hovered: State<boolean>
	readonly hoveredTime: State<number | undefined>
	readonly focused: State<boolean>
	readonly focusedTime: State<number | undefined>
	readonly hasFocused: State<boolean>
	readonly hasFocusedTime: State<number | undefined>
	readonly hadFocusedLast: State<boolean>
	readonly hoveredOrFocused: State<boolean>
	readonly hoveredOrFocusedTime: State<number | undefined>
	readonly hoveredOrHasFocused: State<boolean>
	readonly hoveredOrHasFocusedTime: State<number | undefined>
	readonly active: State<boolean>
	readonly activeTime: State<number | undefined>
	readonly rooted: State<boolean>
	readonly removed: State<boolean>
	readonly id: State<string | undefined>
	readonly name: State<string | undefined>
	readonly rect: State.JIT<DOMRect>
	readonly tagName: Uppercase<keyof HTMLElementTagNameMap>
	readonly childCount: number

	readonly element?: ELEMENT

	readonly fullType: string

	/** Causes this element to be removed when its owner is removed */
	setOwner (owner: State.Owner | undefined): this
	hasOwner (): boolean

	setId (id?: string | State<string | undefined>): this
	setRandomId (): this
	setName (name?: string | State<string | undefined>): this

	is<BUILDERS extends Component.BuilderLike[]> (builder: BUILDERS): this is { [INDEX in keyof BUILDERS]: BUILDERS[INDEX] extends infer BUILDER ? (BUILDER extends Component.BuilderLike<any[], infer COMPONENT> ? COMPONENT : never) | undefined : never }[number]
	is<COMPONENT extends Component> (builder: Component.BuilderLike<any[], COMPONENT>): this is COMPONENT
	is<COMPONENT extends Component> (builder?: Component.BuilderLike<any[], COMPONENT>): boolean
	as<COMPONENT extends Component> (builder: Component.BuilderLike<any[], COMPONENT>): COMPONENT | undefined
	as<COMPONENT extends Component> (builder?: Component.BuilderLike<any[], COMPONENT>): COMPONENT | this | undefined
	cast<COMPONENT extends Component> (): this & Partial<COMPONENT>

	/**
	 * **Warning:** Replacing an element will leave any subscribed events on the original element, and not re-subscribe them on the new element.
	 */
	replaceElement<TAG extends keyof HTMLElementTagNameMap> (elementOrType: TAG, keepContent?: true): Component<HTMLElement> extends this ? Component<HTMLElementTagNameMap[TAG]> : this
	replaceElement (elementOrType: HTMLElement | keyof HTMLElementTagNameMap, keepContent?: true): this

	and<PARAMS extends any[], COMPONENT extends Component> (builder: Component.BuilderAsync<PARAMS, COMPONENT>, ...params: NoInfer<PARAMS>): Promise<this & COMPONENT>
	and<PARAMS extends any[], COMPONENT extends Component> (builder: Component.ExtensionAsync<PARAMS, COMPONENT>, ...params: NoInfer<PARAMS>): Promise<this & COMPONENT>
	and<PARAMS extends any[], COMPONENT extends Component> (builder: Component.Builder<PARAMS, COMPONENT>, ...params: NoInfer<PARAMS>): this & COMPONENT
	and<PARAMS extends any[], COMPONENT extends Component> (builder: Component.Extension<PARAMS, COMPONENT>, ...params: NoInfer<PARAMS>): this & COMPONENT
	extend<T> (extensionProvider: (component: this & T) => Omit<T, typeof SYMBOL_COMPONENT_BRAND>): this & T
	extendMagic<K extends Exclude<keyof this, symbol>, O extends this = this> (property: K, magic: (component: this) => { get (): O[K], set?(value: O[K]): void }): this
	extendJIT<K extends Exclude<keyof this, symbol>, O extends this = this> (property: K, supplier: (component: this) => O[K]): this
	override<K extends keyof this> (property: K, provider: (component: this, original: this[K]) => this[K]): this
	tweakJIT<PARAMS extends any[], K extends Exclude<keyof this, symbol>, O extends this = this> (property: K, tweaker: (value: O[K], component: this) => unknown): this
	addStyleTargets<STYLE_TARGETS_ENUM> (styleTargetsEnum: STYLE_TARGETS_ENUM): this & Component.StyleHost<STYLE_TARGETS_ENUM>

	tweak<PARAMS extends any[]> (tweaker?: (component: this, ...params: PARAMS) => unknown, ...params: PARAMS): this

	disableInsertion (): Omit<this, keyof ComponentInsertionDestination>

	appendTo (destination: ComponentInsertionDestination | Element): this
	prependTo (destination: ComponentInsertionDestination | Element): this
	insertTo (destination: ComponentInsertionDestination | Element, direction: 'before' | 'after', sibling?: Component | Element): this

	closest<BUILDERS extends Component.BuilderLike[]> (builder: BUILDERS): { [INDEX in keyof BUILDERS]: BUILDERS[INDEX] extends infer BUILDER ? (BUILDER extends Component.BuilderLike<any[], infer COMPONENT> ? COMPONENT : never) | undefined : never }[number]
	closest<BUILDER extends Component.BuilderLike> (builder: BUILDER): (BUILDER extends Component.BuilderLike<any[], infer COMPONENT> ? COMPONENT : never) | undefined
	closest<COMPONENT extends Component> (builder: Component.Builder<any[], COMPONENT>): COMPONENT | undefined
	closest<COMPONENT extends Component> (builder: Component.Extension<any[], COMPONENT>): COMPONENT | undefined
	getStateForClosest<BUILDERS extends Component.BuilderLike[]> (builder: BUILDERS): State.JIT<{ [INDEX in keyof BUILDERS]: BUILDERS[INDEX] extends infer BUILDER ? (BUILDER extends Component.BuilderLike<any[], infer COMPONENT> ? COMPONENT : never) | undefined : never }[number]>
	getStateForClosest<BUILDER extends Component.BuilderLike> (builder: BUILDER): State.JIT<(BUILDER extends Component.BuilderLike<any[], infer COMPONENT> ? COMPONENT : never) | undefined>
	getStateForClosest<COMPONENT extends Component> (builder: Component.Builder<any[], COMPONENT>): State.JIT<COMPONENT | undefined>
	getStateForClosest<COMPONENT extends Component> (builder: Component.Extension<any[], COMPONENT>): State.JIT<COMPONENT | undefined>

	get parent (): Component | undefined
	/** Gets all ancestors of this component that have an associated component */
	getAncestorComponents (): Generator<Component>
	/** Gets all ancestors of this component that have an associated component of the given type */
	getAncestorComponents<COMPONENT extends Component> (filterBuilder: Component.BuilderLike<any[], COMPONENT>): Generator<COMPONENT>
	get previousSibling (): Component | undefined
	/** Gets the previous sibling component of the given type */
	getPreviousSibling<COMPONENT extends Component> (filterBuilder: Component.BuilderLike<any[], COMPONENT>): COMPONENT | undefined
	get nextSibling (): Component | undefined
	/** Gets the next sibling component of the given type */
	getNextSibling<COMPONENT extends Component> (filterBuilder: Component.BuilderLike<any[], COMPONENT>): COMPONENT | undefined
	/** Iterates through all children that have an associated component */
	getChildren (): Generator<Component>
	/** Iterates through all children that have an associated component of the given type */
	getChildren<COMPONENT extends Component> (filterBuilder: Component.BuilderLike<any[], COMPONENT>): Generator<COMPONENT>
	/** Iterates through all siblings that have an associated component */
	getSiblings (): Generator<Component>
	/** Iterates through all children that have an associated component of the given type */
	getSiblings<COMPONENT extends Component> (filterBuilder: Component.BuilderLike<any[], COMPONENT>): Generator<COMPONENT>
	/** Iterates through all siblings before this component that have an associated component (in actual order) */
	getPreviousSiblings (): Generator<Component>
	/** Iterates through all children that have an associated component of the given type */
	getPreviousSiblings<COMPONENT extends Component> (filterBuilder: Component.BuilderLike<any[], COMPONENT>): Generator<COMPONENT>
	/** Iterates through all siblings after this component that have an associated component */
	getNextSiblings (): Generator<Component>
	/** Iterates through all children that have an associated component of the given type */
	getNextSiblings<COMPONENT extends Component> (filterBuilder: Component.BuilderLike<any[], COMPONENT>): Generator<COMPONENT>
	/** Iterates through all descendants that have an associated component */
	getDescendants (): Generator<Component>
	/** Iterates through all descendants that have an associated component of the given type */
	getDescendants<COMPONENT extends Component> (filterBuilder: Component.BuilderLike<any[], COMPONENT>): Generator<COMPONENT>
	/** Iterates through all descendants that have an associated component */
	getFirstDescendant (): Component | undefined
	/** Iterates through all descendants that have an associated component of the given type */
	getFirstDescendant<COMPONENT extends Component> (filterBuilder: Component.BuilderLike<any[], COMPONENT>): COMPONENT | undefined
	contains (componentOrElement?: Component | Node | null): boolean

	remove (): void
	removeContents (): this

	receiveRootedEvents (): this
	receiveAncestorInsertEvents (): this
	receiveInsertEvents (): this
	receiveDescendantInsertEvents (): this
	receiveDescendantRemoveEvents (): this
	receiveAncestorScrollEvents (): this
	receiveChildrenInsertEvents (): this
	emitInsert (): this
	monitorScrollEvents (): this

	onRooted (callback: (component: this) => unknown): this
	onRealise (callback: (component: this) => unknown): this
	onRemove (owner: Component, callback: (component: this) => unknown): this
	onRemoveManual (callback: (component: this) => unknown): this

	ariaRole (role?: AriaRole): this
	ariaLabel: StringApplicator.Optional<this>
	ariaLabelledBy (component?: Component): this
	ariaHidden (): this
	ariaChecked (state: State<boolean>): this
	ariaControls (component?: Component): this

	tabIndex (index?: 'programmatic' | 'auto' | number): this
	focus (): this
	blur (): this
}

interface Component<ELEMENT extends HTMLElement = HTMLElement> extends BaseComponent<ELEMENT>, ComponentExtensions<ELEMENT> { }

enum Classes {
	ReceiveRootedEvents = '_receive-rooted-events',
	ReceiveAncestorInsertEvents = '_receieve-ancestor-insert-events',
	ReceiveDescendantInsertEvents = '_receieve-descendant-insert-events',
	ReceiveDescendantRemoveEvents = '_receieve-descendant-remove-events',
	ReceiveAncestorRectDirtyEvents = '_receieve-ancestor-rect-dirty-events',
	ReceiveChildrenInsertEvents = '_receive-children-insert-events',
	ReceiveInsertEvents = '_receive-insert-events',
	ReceiveScrollEvents = '_receieve-scroll-events',
	HasRect = '_has-rect',
	HasStatesToMarkDirtyOnInsertions = '_has-states-to-mark-dirty-on-insertions',
}

const SYMBOL_RECT_STATE = Symbol('RECT_STATE')
const SYMBOL_CALLBACKS_ON_INSERTIONS = Symbol('CALLBACKS_ON_INSERTIONS')

export namespace ComponentPerf {
	export interface Rect extends Component {
		[SYMBOL_RECT_STATE]?: State.JIT<DOMRect>
	}
	export function Rect (component?: Component): State.JIT<DOMRect> | undefined {
		return (component as Rect | undefined)?.[SYMBOL_RECT_STATE]
	}

	export namespace Rect {
		export function assign (component: Component, rectState: State.JIT<DOMRect>): void {
			(component as Rect)[SYMBOL_RECT_STATE] = rectState
		}
	}

	export interface CallbacksOnInsertions extends Component {
		[SYMBOL_CALLBACKS_ON_INSERTIONS]?: (() => unknown)[]
	}
	export namespace CallbacksOnInsertions {
		export function add (component: Component, callback: () => unknown): void {
			const states = (component as CallbacksOnInsertions)[SYMBOL_CALLBACKS_ON_INSERTIONS] ??= []
			states.push(callback)
		}
		export function get (component?: Component): (() => unknown)[] {
			return (component as CallbacksOnInsertions | undefined)?.[SYMBOL_CALLBACKS_ON_INSERTIONS] ?? []
		}
	}
}

const componentExtensionsRegistry: ((component: Mutable<Component>) => unknown)[] = []

interface ComponentLeakDetector {
	built: number
	component: Component
}

interface PendingEventListener {
	event: PropertyKey
	handler: EventListener
	options?: AddEventListenerOptions
}

const VOID_ELEMENT_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])

function escapeTextContent (value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
}

function escapeAttributeValue (value: string) {
	return escapeTextContent(value)
		.replaceAll('"', '&quot;')
}

export interface ComponentDomController {
	readonly element: HTMLElement | undefined
	readonly realised: boolean
	readonly sealed: boolean
	readonly tagName: string
	tag: ComponentTagName
	requireElement (reason: string): HTMLElement
	realiseForInsertion (detachVirtualParent?: boolean): HTMLElement
	adoptElement (element: HTMLElement): void
	assertComposable (method: string): void
	setAttribute (attribute: string, value?: string): void
	hasAttribute (attribute: string): boolean
	getAttribute (attribute: string): string | undefined
	removeAttribute (attribute: string): void
	prependAttribute (attribute: string, value?: string): void
	insertAttribute (referenceAttribute: string, direction: 'before' | 'after', attribute: string, value?: string): void
	getAttributes (): [string, string][]
	addClasses (...classes: string[]): void
	removeClasses (...classes: string[]): void
	hasClasses (...classes: string[]): boolean
	someClasses (...classes: string[]): boolean
	getClasses (): string[]
	setStyleProperty (property: string, value?: string | number | null): void
	getStyleProperty (property: string): string | undefined
	removeStyleProperty (property: string): void
	append (...contents: (Component | Node | Falsy)[]): Node[]
	prepend (...contents: (Component | Node | Falsy)[]): Node[]
	insert (direction: 'before' | 'after', sibling: Component | Element | undefined, ...contents: (Component | Node | Falsy)[]): Node[]
	removeContents (): void
	getChildCount (): number
	getChildren (): (Component | Node)[]
	takeChildren (): (Component | Node)[]
	addEventListener (event: PropertyKey, handler: EventListener, options?: AddEventListenerOptions): void
	removeEventListener (event: PropertyKey, handler: EventListener): void
	queueDispatch (callback: () => unknown, bubble: boolean): void
	flushQueuedDispatches (bubble: boolean): void
	onRealise (callback: () => unknown): void
	deferRealisation (): void
	flushDeferredRealisation (): void
	runOrQueueRealisation (callback: () => unknown): boolean
}

interface ComponentDomHost {
	__dom: ComponentDomController
}

type ComponentTagName = keyof HTMLElementTagNameMap | (string & {})

const virtualParentDetach = new WeakMap<Component, () => void>()
const virtualParents = new WeakMap<Component, Component>()
const insertionSubstitutes = new WeakMap<Component, (component: Component) => Node | undefined>()
const insertionSubstituteNodes = new WeakSet<Node>()

function getDom (component: Component): ComponentDomController {
	return (component as Component & ComponentDomHost).__dom
}
function getInsertionSubstitute (component: Component): Node | undefined {
	const substitute = insertionSubstitutes.get(component)?.(component)
	if (substitute)
		insertionSubstituteNodes.add(substitute)
	return substitute
}
let componentLeakDetectors: ComponentLeakDetector[] = []
const timeUntilLeakWarning = 10000
setInterval(() => {
	const now = Date.now()
	const leakedComponents = componentLeakDetectors.filter(detector => true
		&& now - detector.built > timeUntilLeakWarning
		&& !detector.component.rooted.value
		&& !detector.component.removed.value
		&& !detector.component.hasOwner()
		&& !hasOwnedAncestor(detector.component)
		&& (Component.isRealised(detector.component) || State.OwnerMetadata.hasSubscriptions(detector.component))
	)
	if (leakedComponents.length)
		console.warn('Leaked components:', ...leakedComponents.map(detector => detector.component))

	componentLeakDetectors = componentLeakDetectors.filter(detector => now - detector.built <= timeUntilLeakWarning)
}, 100)

function hasOwnedAncestor (component: Component) {
	for (const ancestor of component.getAncestorComponents())
		if (ancestor.hasOwner())
			return true

	return false
}

function Component<TYPE extends keyof HTMLElementTagNameMap> (type: TYPE): Component<HTMLElementTagNameMap[TYPE]>
function Component (): Component<HTMLSpanElement>
function Component (type?: keyof HTMLElementTagNameMap): Component
function Component<PARAMS extends any[], COMPONENT extends Component> (builder: (component: Component, ...params: PARAMS) => COMPONENT): Component.Builder<PARAMS, COMPONENT>
function Component<PARAMS extends any[], COMPONENT extends Component> (builder: (component: Component, ...params: PARAMS) => Promise<COMPONENT>): Component.BuilderAsync<PARAMS, COMPONENT>
function Component<PARAMS extends any[], COMPONENT extends Component> (initial: keyof HTMLElementTagNameMap | (() => Component), builder: (component: Component, ...params: PARAMS) => COMPONENT): Component.Builder<PARAMS, COMPONENT>
function Component<PARAMS extends any[], COMPONENT extends Component> (initial: keyof HTMLElementTagNameMap | (() => Component), builder: (component: Component, ...params: PARAMS) => Promise<COMPONENT>): Component.BuilderAsync<PARAMS, COMPONENT>
function Component<PARAMS extends any[], COMPONENT extends Component | undefined> (builder: (component: Component, ...params: PARAMS) => COMPONENT): Component.Builder<PARAMS, COMPONENT>
function Component<PARAMS extends any[], COMPONENT extends Component | undefined> (builder: (component: Component, ...params: PARAMS) => Promise<COMPONENT>): Component.BuilderAsync<PARAMS, COMPONENT>
function Component<PARAMS extends any[], COMPONENT extends Component | undefined> (initial: keyof HTMLElementTagNameMap | (() => Component), builder: (component: Component, ...params: PARAMS) => COMPONENT): Component.Builder<PARAMS, COMPONENT>
function Component<PARAMS extends any[], COMPONENT extends Component | undefined> (initial: keyof HTMLElementTagNameMap | (() => Component), builder: (component: Component, ...params: PARAMS) => Promise<COMPONENT>): Component.BuilderAsync<PARAMS, COMPONENT>
function Component (type?: keyof HTMLElementTagNameMap | AnyFunction, builder?: (component: Component, ...params: any[]) => Component | Promise<Component>): Component | Component.Builder<any[], any> | Component.BuilderAsync<any[], any> {
	if (typeof type === 'function' || typeof builder === 'function')
		return Component.Builder(type as keyof HTMLElementTagNameMap, builder as AnyFunction)

	type ??= 'span'

	if (!canBuildComponents)
		throw new Error('Components cannot be built yet')

	let unuseIdState: State.Unsubscribe | undefined
	let unuseNameState: State.Unsubscribe | undefined
	let unuseAriaLabelledByIdState: State.Unsubscribe | undefined
	let unuseAriaControlsIdState: State.Unsubscribe | undefined
	let unuseOwnerRemove: State.Unsubscribe | undefined
	let getOuterHTML!: () => string

	let descendantsListeningForScroll: HTMLCollection | undefined
	let descendantRectsListeningForScroll: HTMLCollection | undefined

	const jitTweaks = new Map<string, true | Set<(value: any, component: Component) => unknown>>()
	const nojit: Record<string, any> = {}

	const rooted = State(false)
	const removed = State(false)

	const dom = createDomController()
	let component = ({
		supers: State([]),
		isComponent: true,
		isInsertionDestination: true,
		__dom: dom,
		get outerHTML () {
			return getOuterHTML()
		},
		get element () {
			return dom.element
		},
		get removed () {
			componentLeakDetectors.push({
				built: Date.now(),
				component,
			})
			return DefineProperty(component, 'removed', removed)
		},
		rooted,
		nojit: nojit as Component,

		get tagName () {
			return dom.tagName as Uppercase<keyof HTMLElementTagNameMap>
		},
		get childCount () {
			return dom.getChildCount()
		},

		setOwner: newOwner => {
			unuseOwnerRemove?.(); unuseOwnerRemove = undefined

			if (!newOwner)
				return component

			const removedState = State.Owner.getRemovedState(newOwner)
			unuseOwnerRemove = removedState?.use(component, removed => removed && component.remove())
			if (!removedState)
				component.remove()

			return component
		},
		hasOwner: () => !!unuseOwnerRemove,

		replaceElement: (newElement: HTMLElement | keyof HTMLElementTagNameMap, keepContent?: boolean) => {
			dom.assertComposable('replaceElement')
			if (typeof newElement === 'string' && newElement.toUpperCase() === dom.tagName.toUpperCase())
				return component // already correct tag type

			if (!dom.realised && typeof newElement === 'string') {
				dom.tag = newElement
				return component
			}

			if (typeof newElement === 'string')
				newElement = document.createElement(newElement)

			const oldElement = dom.requireElement('replace element')

			if (!keepContent) {
				Component.removeContents(newElement)
				newElement.replaceChildren(...oldElement.childNodes)
			}

			if (oldElement.parentNode)
				oldElement.replaceWith(newElement)

			dom.adoptElement(newElement)
			type = dom.tagName as keyof HTMLElementTagNameMap

			ELEMENT_TO_COMPONENT_MAP.delete(oldElement)
			ELEMENT_TO_COMPONENT_MAP.set(newElement, component)

			component.attributes.copy(oldElement)
			// component.style.refresh()

			return component
		},
		is: (builder?: Component.BuilderLike | Component.BuilderLike[]): this is any => !builder || (Array.isArray(builder) ? builder : [builder]).some(builder => component.supers.value.includes(builder)),
		as: (builder): any => !builder || component.supers.value.includes(builder) ? component : undefined,
		cast: (): any => component,
		and<PARAMS extends any[], COMPONENT extends Component> (builder: Component.Builder<PARAMS, COMPONENT> | Component.BuilderAsync<PARAMS, COMPONENT> | Component.Extension<PARAMS, COMPONENT> | Component.ExtensionAsync<PARAMS, COMPONENT>, ...params: PARAMS) {
			dom.assertComposable('and')
			if (component.is(builder as never))
				return component

			const result = builder.from(component, ...params)
			if (result instanceof Promise)
				return result.then(result => {
					component = result
					component.supers.value.push(builder)
					component.supers.emit()
					if (builder.name)
						component.attributes.prepend(`:${builder.name.kebabcase}`)
					return component
				})

			component = result
			component.supers.value.push(builder)
			component.supers.emit()
			if (builder.name)
				component.attributes.prepend(`:${builder.name.kebabcase}`)
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			return component as any
		},
		extend: extension => {
			return Object.assign(component, extension(component as never)) as never
		},
		override: (property, provider) => {
			const original = component[property]
			component[property] = provider(component, original)
			return component
		},
		extendMagic: (property, magic) => {
			DefineMagic(component, property, magic(component))
			return component
		},
		extendJIT: (property, supplier) => {
			DefineMagic(component, property, {
				get: () => {
					const value = supplier(component)
					DefineProperty(component, property, value)
					const tweaks = jitTweaks.get(property)
					if (tweaks && tweaks !== true)
						for (const tweaker of tweaks)
							tweaker(value, component)
					jitTweaks.set(property, true)
					return value
				},
				set: value => {
					DefineProperty(component, property, value)
					nojit[property] = value
				},
			})
			return component
		},

		tweakJIT: (property, tweaker) => {
			const tweaks = Maps.compute(jitTweaks, property, () => new Set())
			if (tweaks === true)
				tweaker(component[property] as never, component)
			else
				tweaks.add(tweaker)

			return component
		},

		tweak: (tweaker: (component: Component, ...params: any[]) => unknown, ...params: any[]) => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			tweaker?.(component, ...params)
			return component
		},

		addStyleTargets (styleEnum) {
			const keys = Object.keys(styleEnum as never).filter(key => isNaN(+key))
			for (const key of keys)
				(component as Component & Component.StyleHost<Record<string, true>>).styleTargets[key] = State(undefined)
			return component as never
		},
		...{
			// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
			styleTargets (style: Record<string, ComponentName | null>) {
				for (const [key, name] of Object.entries(style))
					// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-redundant-type-constituents
					(component as Component & Component.StyleHost<Record<string, true>>).styleTargets[key].asMutable?.setValue(name as ComponentName | null ?? undefined)
				return component
			},
		},

		get style () {
			return DefineProperty(component, 'style', StyleManipulator(component))
		},
		get classes () {
			return DefineProperty(component, 'classes', ClassManipulator(component))
		},
		get attributes () {
			return DefineProperty(component, 'attributes', AttributeManipulator(component))
		},
		get event () {
			return DefineProperty(component, 'event', EventManipulator(component))
		},
		get text () {
			return DefineProperty(component, 'text', TextManipulator(component))
		},
		get anchor () {
			return DefineProperty(component, 'anchor', AnchorManipulator(component))
		},

		get hovered (): State<boolean> {
			return DefineProperty(component, 'hovered', component.hoveredTime.mapManual(time => !!time))
		},
		get hoveredTime (): State<number | undefined> {
			return DefineProperty(component, 'hoveredTime', State(undefined))
		},
		get focused (): State<boolean> {
			return DefineProperty(component, 'focused', component.focusedTime.mapManual(time => !!time))
		},
		get focusedTime (): State<number | undefined> {
			return DefineProperty(component, 'focusedTime', State(undefined))
		},
		get hasFocused (): State<boolean> {
			return DefineProperty(component, 'hasFocused', component.hasFocusedTime.mapManual(time => !!time))
		},
		get hasFocusedTime (): State<number | undefined> {
			return DefineProperty(component, 'hasFocusedTime', State(undefined))
		},
		get hadFocusedLast (): State<boolean> {
			return DefineProperty(component, 'hadFocusedLast', State(false))
		},
		get hoveredOrFocused (): State<boolean> {
			return DefineProperty(component, 'hoveredOrFocused', component.hoveredOrFocusedTime.mapManual(time => !!time))
		},
		get hoveredOrFocusedTime (): State<number | undefined> {
			return DefineProperty(component, 'hoveredOrFocusedTime',
				State.Generator(() => Math.max(component.hoveredTime.value ?? 0, component.focusedTime.value ?? 0) || undefined)
					.observe(component, component.hoveredTime, component.focusedTime))
		},
		get hoveredOrHasFocused (): State<boolean> {
			return DefineProperty(component, 'hoveredOrHasFocused', component.hoveredOrHasFocusedTime.mapManual(time => !!time))
		},
		get hoveredOrHasFocusedTime (): State<number | undefined> {
			return DefineProperty(component, 'hoveredOrHasFocusedTime',
				State.Generator(() => Math.max(component.hoveredTime.value ?? 0, component.hasFocusedTime.value ?? 0) || undefined)
					.observe(component, component.hoveredTime, component.hasFocusedTime))
		},
		get active (): State<boolean> {
			return DefineProperty(component, 'active', component.activeTime.mapManual(time => !!time))
		},
		get activeTime (): State<number | undefined> {
			return DefineProperty(component, 'activeTime', State(undefined))
		},
		get id (): State<string | undefined> {
			return DefineProperty(component, 'id', State(undefined))
		},
		get name (): State<string | undefined> {
			return DefineProperty(component, 'name', State(undefined))
		},
		...{
			[SYMBOL_RECT_STATE]: undefined as State.JIT<DOMRect> | undefined,
		},
		get rect (): State.JIT<DOMRect> {
			const rectState = State.JIT(() => dom.element?.getBoundingClientRect() ?? new DOMRect())
			ComponentPerf.Rect.assign(component, rectState)

			const oldMarkDirty = rectState.markDirty
			rectState.markDirty = () => {
				oldMarkDirty()
				const element = dom.element
				if (!element)
					return rectState

				for (const descendant of element.getElementsByClassName(Classes.HasRect))
					ComponentPerf.Rect(descendant.component)?.markDirty()
				for (const descendant of element.getElementsByClassName(Classes.ReceiveAncestorRectDirtyEvents))
					descendant.component?.event.emit('ancestorRectDirty')
				return rectState
			}
			// this.receiveInsertEvents()
			// this.receiveAncestorInsertEvents()
			// this.receiveAncestorScrollEvents()
			this.classes.add(
				// Classes.ReceiveAncestorRectDirtyEvents,
				Classes.HasRect,
			)
			// this.event.subscribe(['insert', 'ancestorInsert', 'ancestorScroll', 'ancestorRectDirty'], rectState.markDirty)
			Viewport.size.subscribe(component, rectState.markDirty)
			return DefineProperty(component, 'rect', rectState)
		},
		get fullType () {
			return ''
				+ (component.tagName.startsWith(':') ? '' : `<${component.tagName}> `)
				+ (!component.supers.value.length ? ''
					: ':' + component.supers.value.map((t: Component.BuilderLike) => t.name.kebabcase).join(' :')
				)
		},

		setId: id => {
			unuseIdState?.(); unuseIdState = undefined

			if (id && typeof id !== 'string')
				unuseIdState = id.use(component, setId)
			else
				setId(id)

			return component

			function setId (id?: string) {
				if (id) {
					dom.setAttribute('id', id)
					component.id.asMutable?.setValue(id)
				}
				else {
					dom.removeAttribute('id')
					component.id.asMutable?.setValue(undefined)
				}
			}
		},
		setRandomId: () => {
			component.setId(Strings.uid())
			return component
		},
		setName: name => {
			unuseNameState?.(); unuseNameState = undefined

			if (name && typeof name !== 'string')
				unuseNameState = name.use(component, setName)
			else
				setName(name)

			return component

			function setName (name?: string) {
				if (name) {
					name = name.replace(/[^\w-]+/g, '-').toLowerCase()
					dom.setAttribute('name', name)
					component.name.asMutable?.setValue(name)
				}
				else {
					dom.removeAttribute('name')
					component.name.asMutable?.setValue(undefined)
				}
			}
		},

		disableInsertion () {
			return component
		},

		remove () {
			virtualParentDetach.get(component)?.()
			virtualParents.delete(component)
			component.removeContents()

			component.removed.asMutable?.setValue(true)
			component.rooted.asMutable?.setValue(false)

			if (dom.element) {
				dom.element.component = undefined
				dom.element.remove()
			}

			emitRemove(component)
			if (component.classes.has(Classes.ReceiveRootedEvents))
				component.event.emit('unroot')
			unuseOwnerRemove?.(); unuseOwnerRemove = undefined
			unuseAriaControlsIdState?.(); unuseAriaControlsIdState = undefined
			unuseAriaLabelledByIdState?.(); unuseAriaLabelledByIdState = undefined
			unuseIdState?.(); unuseIdState = undefined
			unuseNameState?.(); unuseNameState = undefined
		},
		appendTo (destination) {
			if (ComponentInsertionDestination.is(destination)) {
				destination.append(component)
				return component
			}
			if (dom.runOrQueueRealisation(() => component.appendTo(destination)))
				return component

			const substitute = getInsertionSubstitute(component)
			const node = substitute ?? dom.realiseForInsertion()
			moveOrInsertBefore(destination, node, null)
			if (!substitute)
				component.emitInsert()
			return component
		},
		prependTo (destination) {
			if (ComponentInsertionDestination.is(destination)) {
				destination.prepend(component)
				return component
			}
			if (dom.runOrQueueRealisation(() => component.prependTo(destination)))
				return component

			const substitute = getInsertionSubstitute(component)
			const node = substitute ?? dom.realiseForInsertion()
			moveOrInsertBefore(destination, node, destination.firstChild)
			if (!substitute)
				component.emitInsert()
			return component
		},
		insertTo (destination, direction, sibling) {
			if (ComponentInsertionDestination.is(destination)) {
				destination.insert(direction, sibling, component)
				if (!Component.is(destination))
					component.emitInsert()
				return component
			}

			if (dom.runOrQueueRealisation(() => component.insertTo(destination, direction, sibling)))
				return component

			const siblingElement = sibling ? Component.requireElement(sibling, 'insert relative to sibling') : null
			const substitute = getInsertionSubstitute(component)
			const node = substitute ?? dom.realiseForInsertion()
			if (direction === 'before')
				moveOrInsertBefore(destination, node, siblingElement)
			else
				moveOrInsertBefore(destination, node, !siblingElement ? destination.firstChild : siblingElement?.nextSibling)

			if (!substitute)
				component.emitInsert()
			return component
		},
		append (...contents) {
			if (component.removed.value) {
				for (let content of contents) {
					content = Component.get(content) ?? content
					if (Component.is(content))
						content.remove()
				}

				return component
			}

			const elements = dom.append(...contents)
			const insertedElements = elements.filter(element => !insertionSubstituteNodes.has(element))

			for (const element of insertedElements)
				(element as Element).component?.emitInsert()

			if (insertedElements.length && component.classes.has(Classes.ReceiveChildrenInsertEvents))
				component.event.emit('childrenInsert', insertedElements)
			return component
		},
		prepend (...contents) {
			if (component.removed.value) {
				for (let content of contents) {
					content = Component.get(content) ?? content
					if (Component.is(content))
						content.remove()
				}

				return component
			}

			const elements = dom.prepend(...contents)
			const insertedElements = elements.filter(element => !insertionSubstituteNodes.has(element))

			for (const element of insertedElements)
				(element as Element).component?.emitInsert()

			if (insertedElements.length && component.classes.has(Classes.ReceiveChildrenInsertEvents))
				component.event.emit('childrenInsert', insertedElements)
			return component
		},
		insert (direction, sibling, ...contents) {
			if (component.removed.value) {
				for (let content of contents) {
					content = Component.get(content) ?? content
					if (Component.is(content))
						content.remove()
				}

				return component
			}

			const elements = dom.insert(direction, sibling, ...contents)
			const insertedElements = elements.filter(element => !insertionSubstituteNodes.has(element))

			for (const element of insertedElements)
				(element as Element).component?.emitInsert()

			if (insertedElements.length && component.classes.has(Classes.ReceiveChildrenInsertEvents))
				component.event.emit('childrenInsert', insertedElements)
			return component
		},
		removeContents () {
			dom.removeContents()
			return component
		},

		closest (builder: any) {
			return Component.closest(builder, component)
		},
		getStateForClosest (builders: any): any {
			const state = State.JIT(() => component.closest(builders))
			ComponentPerf.CallbacksOnInsertions.add(component, state.markDirty)
			component.classes.add(Classes.HasStatesToMarkDirtyOnInsertions)
			// component.receiveAncestorInsertEvents()
			// component.onRooted(() => {
			// 	state.markDirty()
			// component.receiveInsertEvents()
			// component.event.subscribe(['insert', 'ancestorInsert'], () => state.markDirty())
			// })
			return state
		},

		get parent () {
			return dom.element?.parentElement?.component ?? virtualParents.get(component)
		},
		get previousSibling () {
			return dom.element?.previousElementSibling?.component
		},
		getPreviousSibling (builder) {
			const [sibling] = component.getPreviousSiblings(builder)
			return sibling
		},
		get nextSibling () {
			return dom.element?.nextElementSibling?.component
		},
		getNextSibling (builder) {
			const [sibling] = component.getNextSiblings(builder)
			return sibling
		},
		* getAncestorComponents (builder?: Component.BuilderLike) {
			let cursor = component.parent
			while (cursor) {
				if (cursor.is(builder))
					yield cursor

				cursor = cursor.parent
			}
		},
		* getChildren (builder?: Component.BuilderLike) {
			for (const child of dom.element?.children ?? []) {
				const component = child.component
				if (component?.is(builder))
					yield component
			}
		},
		* getSiblings (builder?: Component.BuilderLike) {
			const element = dom.element
			const parent = element?.parentElement
			for (const child of parent?.children ?? [])
				if (child !== element) {
					const component = child.component
					if (component?.is(builder))
						yield component
				}
		},
		* getPreviousSiblings (builder?: Component.BuilderLike) {
			const element = dom.element
			const parent = element?.parentElement
			for (const child of parent?.children ?? []) {
				if (child === element)
					break

				const childComponent = child.component
				if (childComponent?.is(builder))
					yield childComponent
			}
		},
		* getNextSiblings (builder?: Component.BuilderLike) {
			let cursor: Element | null | undefined = dom.element
			while ((cursor = cursor?.nextElementSibling)) {
				const component = cursor.component
				if (component?.is(builder))
					yield component
			}
		},
		* getDescendants (builder?: Component.BuilderLike) {
			if (!dom.element)
				return

			const walker = document.createTreeWalker(dom.element, NodeFilter.SHOW_ELEMENT)
			let node: Node | null
			while ((node = walker.nextNode())) {
				const component = node.component
				if (component?.is(builder))
					yield component
			}
		},
		getFirstDescendant (builder?: Component.BuilderLike) {
			const [first] = component.getDescendants(builder!)
			return first
		},
		contains (elementOrComponent) {
			const descendant = Component.is(elementOrComponent) ? elementOrComponent.element : elementOrComponent
			return descendant === undefined || descendant === null ? false : !!dom.element?.contains(descendant)
		},

		receiveRootedEvents () {
			dom.addClasses(Classes.ReceiveRootedEvents)
			return component
		},
		receiveAncestorInsertEvents: () => {
			dom.addClasses(Classes.ReceiveAncestorInsertEvents)
			return component
		},
		receiveDescendantInsertEvents: () => {
			dom.addClasses(Classes.ReceiveDescendantInsertEvents)
			return component
		},
		receiveDescendantRemoveEvents: () => {
			dom.addClasses(Classes.ReceiveDescendantRemoveEvents)
			return component
		},
		receiveAncestorScrollEvents () {
			dom.addClasses(Classes.ReceiveScrollEvents)
			return component
		},
		receiveChildrenInsertEvents () {
			dom.addClasses(Classes.ReceiveChildrenInsertEvents)
			return component
		},
		receiveInsertEvents () {
			dom.addClasses(Classes.ReceiveInsertEvents)
			return component
		},
		emitInsert: () => {
			updateRooted(component)
			emitInsert(component)
			return component
		},
		monitorScrollEvents () {
			const element = dom.element
			if (!element) {
				dom.onRealise(() => component.monitorScrollEvents())
				return component
			}

			if (descendantsListeningForScroll)
				// already monitoring
				return component

			descendantsListeningForScroll ??= (element === window as any ? document.documentElement : element).getElementsByClassName(Classes.ReceiveScrollEvents)
			descendantRectsListeningForScroll ??= (element === window as any ? document.documentElement : element).getElementsByClassName(Classes.HasRect)
			component.event.subscribe('scroll', () => {
				for (const descendant of [...descendantsListeningForScroll!])
					descendant.component?.event.emit('ancestorScroll')
				for (const descendant of [...descendantRectsListeningForScroll!])
					ComponentPerf.Rect(descendant.component)?.markDirty()
			})
			return component
		},
		onRooted (callback) {
			component.rooted.matchManual(true, () => callback(component))
			return component
		},
		onRealise (callback) {
			dom.onRealise(() => callback(component))
			return component
		},
		onRemove (owner, callback) {
			component.removed.match(owner, true, () => callback(component))
			return component
		},
		onRemoveManual (callback) {
			component.removed.matchManual(true, () => callback(component))
			return component
		},

		ariaRole: (role?: string) => {
			if (!role)
				return component.attributes.remove('role')

			return component.attributes.set('role', role)
		},
		get ariaLabel () {
			return DefineProperty(component, 'ariaLabel', StringApplicator(component as Component, value => component.attributes.set('aria-label', value)))
		},
		ariaLabelledBy: labelledBy => {
			unuseAriaLabelledByIdState?.(); unuseAriaLabelledByIdState = undefined
			if (labelledBy) {
				const state = State.Generator(() => labelledBy.id.value ?? labelledBy.attributes.get('for'))
					.observe(component, labelledBy.id, labelledBy.cast<Label>()?.for)
				unuseAriaLabelledByIdState = state.use(component, id =>
					component.attributes.set('aria-labelledby', id))
			}
			return component
		},
		ariaHidden: () => component.attributes.set('aria-hidden', 'true'),
		ariaChecked: state => {
			state.use(component, state =>
				component.attributes.set('aria-checked', `${state}`))
			return component
		},
		ariaControls: target => {
			unuseAriaControlsIdState?.()
			unuseAriaControlsIdState = target?.id.use(component, id =>
				component.attributes.set('aria-controls', id))
			return component
		},

		tabIndex: index => {
			if (index === undefined)
				dom.removeAttribute('tabindex')
			else if (index === 'programmatic')
				dom.setAttribute('tabindex', '-1')
			else if (index === 'auto')
				dom.setAttribute('tabindex', '0')
			else
				dom.setAttribute('tabindex', `${index}`)

			return component
		},
		focus: () => {
			if (dom.element)
				FocusListener.focus(dom.element)
			return component
		},
		blur: () => {
			if (dom.element)
				FocusListener.blur(dom.element)
			return component
		},
	} satisfies Pick<Component, keyof BaseComponent> & { readonly outerHTML: string }) as any as Mutable<Component>

	// WeavingArg.setRenderable(component, () => component.element.textContent ?? '')
	// Objects.stringify.disable(component)

	for (const extension of componentExtensionsRegistry)
		extension(component)

	if (!Component.is(component))
		throw new Error('This should never happen')

	return component

	function createDomController (): ComponentDomController {
		let element: HTMLElement | undefined
		let realised = false
		let sealed = false
		let tag = type as ComponentTagName
		let attributes: Map<string, string> | undefined = new Map()
		let attributeOrder: string[] | undefined = []
		let classes: Set<string> | undefined = new Set()
		let styles: Map<string, string> | undefined = new Map()
		const children: (Component | Node)[] = []
		const listeners: PendingEventListener[] = []
		const queuedEmits: (() => unknown)[] = []
		const queuedBubbles: (() => unknown)[] = []
		const onRealiseCallbacks: (() => unknown)[] = []
		const queuedRealisations: (() => unknown)[] = []
		let deferringRealisation = false

		const controller: ComponentDomController = {
			get element () { return element },
			get realised () { return realised },
			get sealed () { return sealed },
			get tagName () { return (element?.tagName ?? tag.toString()).toUpperCase() },
			get tag () { return tag },
			set tag (value) {
				this.assertComposable('change element type')
				if (realised)
					throw new Error('Cannot change a realised component tag')
				tag = value
			},
			requireElement (reason) {
				if (!element)
					throw new Error(`Component has no realised element${reason ? `: ${reason}` : ''}`)
				return element
			},
			realiseForInsertion (detachVirtualParent = true) {
				if (detachVirtualParent)
					virtualParentDetach.get(component)?.()
				if (element) {
					sealed = true
					return element
				}

				element = document.createElement(tag)
				realised = true
				element.component = component

				for (const attribute of attributeOrder ?? []) {
					const value = attributes?.get(attribute)
					if (value !== undefined)
						element.setAttribute(attribute, value)
				}
				element.classList.add(...classes ?? [])
				for (const [property, value] of styles ?? [])
					element.style.setProperty(property, value)
				attributes = undefined
				attributeOrder = undefined
				classes = undefined
				styles = undefined
				for (const listener of listeners)
					element.addEventListener(listener.event as keyof HTMLElementEventMap, listener.handler, listener.options)
				for (const callback of onRealiseCallbacks.splice(0, Infinity))
					callback()

				const pendingChildren = children.splice(0, Infinity)
				const childNodes = pendingChildren.map(nodeForInsertion)
				element.append(...childNodes)
				for (const child of pendingChildren)
					if (Component.is(child))
						child.emitInsert()

				this.flushQueuedDispatches(false)
				sealed = true
				return element
			},
			adoptElement (newElement) {
				element = newElement
				realised = true
				tag = newElement.tagName?.toLowerCase() ?? 'window'
				element.component = component
				attributes = undefined
				attributeOrder = undefined
				classes = undefined
				styles = undefined
				for (const listener of listeners)
					element.addEventListener(listener.event as keyof HTMLElementEventMap, listener.handler, listener.options)
			},
			assertComposable (method) {
				if (sealed)
					throw new Error(`Cannot ${method} after a component has been appended`)
			},
			setAttribute (attribute, value = '') {
				if (value === undefined) {
					this.removeAttribute(attribute)
					return
				}
				if (element)
					element.setAttribute(attribute, value)
				else {
					ensureAttributeOrder(attribute)
					attributes!.set(attribute, value)
				}
			},
			hasAttribute (attribute) {
				return element?.hasAttribute(attribute) ?? attributes!.has(attribute)
			},
			getAttribute (attribute) {
				return element ? element.getAttribute(attribute) ?? undefined : attributes!.get(attribute)
			},
			removeAttribute (attribute) {
				if (element)
					element.removeAttribute(attribute)
				else {
					attributes!.delete(attribute)
					removeAttributeOrder(attribute)
				}
			},
			prependAttribute (attribute, value = '') {
				if (element) {
					reorderElementAttribute(attribute, value, undefined, 'before')
					return
				}

				removeAttributeOrder(attribute)
				attributeOrder!.unshift(attribute)
				attributes!.set(attribute, value)
			},
			insertAttribute (referenceAttribute, direction, attribute, value = '') {
				if (element) {
					reorderElementAttribute(attribute, value, referenceAttribute, direction)
					return
				}

				removeAttributeOrder(attribute)
				const index = attributeOrder!.indexOf(referenceAttribute)
				attributeOrder!.splice(index === -1 ? direction === 'before' ? 0 : attributeOrder!.length : index + (direction === 'after' ? 1 : 0), 0, attribute)
				attributes!.set(attribute, value)
			},
			getAttributes () {
				if (element)
					return [...element.attributes].map(attribute => [attribute.name, attribute.value])

				return attributeOrder!
					.map(attribute => [attribute, attributes!.get(attribute)] as [string, string | undefined])
					.filter((entry): entry is [string, string] => entry[1] !== undefined)
			},
			addClasses (...classNames) {
				if (element)
					element.classList.add(...classNames)
				else
					for (const className of classNames)
						classes!.add(className)
			},
			removeClasses (...classNames) {
				if (element)
					element.classList.remove(...classNames)
				else
					for (const className of classNames)
						classes!.delete(className)
			},
			hasClasses (...classNames) {
				return classNames.every(className => element?.classList.contains(className) ?? classes!.has(className))
			},
			someClasses (...classNames) {
				return classNames.some(className => element?.classList.contains(className) ?? classes!.has(className))
			},
			getClasses () {
				return element ? [...element.classList] : [...classes!]
			},
			setStyleProperty (property, value) {
				if (value === undefined || value === null) {
					this.removeStyleProperty(property)
					return
				}
				const stringValue = `${value}`
				if (element)
					element.style.setProperty(property, stringValue)
				else
					styles!.set(property, stringValue)
			},
			getStyleProperty (property) {
				return element ? element.style.getPropertyValue(property) || undefined : styles!.get(property)
			},
			removeStyleProperty (property) {
				if (element)
					element.style.removeProperty(property)
				else
					styles!.delete(property)
			},
			append (...contents) {
				if (!element) {
					children.push(...prepareVirtualChildren(contents))
					return []
				}

				const nodes = contents.filter(Truthy).map(nodeForInsertion)
				appendNodes(element, nodes)
				return nodes
			},
			prepend (...contents) {
				if (!element) {
					children.unshift(...prepareVirtualChildren(contents))
					return []
				}

				const nodes = contents.filter(Truthy).map(nodeForInsertion)
				prependNodes(element, nodes)
				return nodes
			},
			insert (direction, sibling, ...contents) {
				if (!element) {
					const siblingIndex = indexOfVirtualChild(sibling)
					const index = siblingIndex === -1 ? direction === 'before' ? 0 : children.length : siblingIndex + (direction === 'after' ? 1 : 0)
					children.splice(index, 0, ...prepareVirtualChildren(contents))
					return []
				}

				const nodes = contents.filter(Truthy).map(nodeForInsertion)
				const siblingElement = sibling ? Component.requireElement(sibling, 'insert child relative to sibling') : null
				if (direction === 'before')
					for (let i = nodes.length - 1; i >= 0; i--)
						moveOrInsertBefore(element, nodes[i], siblingElement)
				else {
					let previousNode: Node | null = siblingElement
					for (const node of nodes) {
						moveOrInsertBefore(element, node, !previousNode ? element.firstChild : previousNode.nextSibling)
						previousNode = node
					}
				}
				return nodes
			},
			removeContents () {
				if (element) {
					Component.removeContents(element)
					return
				}

				for (const child of [...children])
					if (Component.is(child))
						child.remove()
				children.splice(0, Infinity)
			},
			getChildCount () {
				return element?.childNodes.length ?? children.length
			},
			getChildren () {
				return element ? [...element.childNodes] : [...children]
			},
			takeChildren () {
				if (element)
					return [...element.childNodes]

				const transferred = children.splice(0, Infinity)
				for (const child of transferred)
					if (Component.is(child)) {
						virtualParentDetach.delete(child)
						virtualParents.delete(child)
					}
				return transferred
			},
			addEventListener (event, handler, options) {
				listeners.push({ event, handler, options })
				element?.addEventListener(event as keyof HTMLElementEventMap, handler, options)
			},
			removeEventListener (event, handler) {
				for (let i = listeners.length - 1; i >= 0; i--)
					if (listeners[i].event === event && listeners[i].handler === handler)
						listeners.splice(i, 1)
				element?.removeEventListener(event as keyof HTMLElementEventMap, handler)
			},
			queueDispatch (callback, bubble) {
				; (bubble ? queuedBubbles : queuedEmits).push(callback)
			},
			flushQueuedDispatches (bubble) {
				const queue = bubble ? queuedBubbles : queuedEmits
				for (const callback of queue.splice(0, Infinity))
					callback()
			},
			onRealise (callback) {
				if (element)
					callback()
				else
					onRealiseCallbacks.push(callback)
			},
			deferRealisation () {
				deferringRealisation = true
			},
			flushDeferredRealisation () {
				deferringRealisation = false
				for (const callback of queuedRealisations.splice(0, Infinity))
					callback()
			},
			runOrQueueRealisation (callback) {
				if (!deferringRealisation)
					return false

				queuedRealisations.push(callback)
				return true
			},
		}
		getOuterHTML = () => {
			if (element)
				return element.outerHTML

			const tagName = tag.toString().toLowerCase()
			const attributeText = getOuterHTMLAttributes()
			if (VOID_ELEMENT_TAGS.has(tagName))
				return `<${tagName}${attributeText}>`

			return `<${tagName}${attributeText}>${children.map(contentOuterHTML).join('')}</${tagName}>`
		}
		return controller

		function getOuterHTMLAttributes () {
			const outerAttributes = new Map(controller.getAttributes())
			const classNames = controller.getClasses()
			if (classNames.length)
				outerAttributes.set('class', [outerAttributes.get('class'), ...classNames].filter(Truthy).join(' '))

			const styleText = [...styles!]
				.map(([property, value]) => `${property}: ${value};`)
				.join(' ')
			if (styleText)
				outerAttributes.set('style', [outerAttributes.get('style'), styleText].filter(Truthy).join(' '))

			let result = ''
			for (const [attribute, value] of outerAttributes)
				result += value === '' ? ` ${attribute}` : ` ${attribute}="${escapeAttributeValue(value)}"`

			return result
		}

		function contentOuterHTML (content: Component | Node): string {
			if (Component.is(content))
				return (content as Component & { outerHTML: string }).outerHTML

			if (content instanceof Element)
				return content.outerHTML

			if (content instanceof Text)
				return escapeTextContent(content.data)

			if (content instanceof Comment)
				return `<!--${content.data.replaceAll('-->', '--&gt;')}-->`

			return escapeTextContent(content.textContent ?? '')
		}

		function ensureAttributeOrder (attribute: string) {
			if (!attributeOrder!.includes(attribute))
				attributeOrder!.push(attribute)
		}
		function removeAttributeOrder (attribute: string) {
			const index = attributeOrder!.indexOf(attribute)
			if (index !== -1)
				attributeOrder!.splice(index, 1)
		}
		function reorderElementAttribute (attribute: string, value: string, referenceAttribute: string | undefined, direction: 'before' | 'after') {
			const entries = [...element!.attributes]
				.map(attribute => [attribute.name, attribute.value] as const)
				.filter(entry => entry[0] !== attribute)
			const index = referenceAttribute === undefined ? -1 : entries.findIndex(entry => entry[0] === referenceAttribute)
			entries.splice(index === -1 ? direction === 'before' ? 0 : entries.length : index + (direction === 'after' ? 1 : 0), 0, [attribute, value])

			for (const attribute of [...element!.attributes])
				element!.removeAttribute(attribute.name)
			for (const [attribute, value] of entries)
				element!.setAttribute(attribute, value)
		}
		function indexOfVirtualChild (sibling: Component | Element | undefined) {
			if (!sibling)
				return -1

			const siblingComponent = Component.get(sibling)
			return children.findIndex(child => true
				&& (child === sibling
					|| child === siblingComponent
					|| (Component.is(child) && child.element === sibling)))
		}
		function nodeForInsertion (content: Component | Node): Node {
			if (Component.is(content)) {
				const substitute = getInsertionSubstitute(content)
				if (substitute)
					return substitute
				virtualParentDetach.get(content)?.()
				return getDom(content).realiseForInsertion()
			}
			return content
		}
		function prepareVirtualChildren (contents: (Component | Node | Falsy)[]): (Component | Node)[] {
			return contents.filter(Truthy).map(content => {
				if (Component.is(content)) {
					virtualParentDetach.get(content)?.()
					content.element?.remove()
					virtualParents.set(content, component)
					virtualParentDetach.set(content, () => {
						const index = children.indexOf(content)
						if (index !== -1)
							children.splice(index, 1)
						virtualParentDetach.delete(content)
						virtualParents.delete(content)
					})
				}
				else {
					content.parentNode?.removeChild(content)
				}

				return content
			})
		}
	}
}

function emitInsert (component: Component | undefined) {
	if (!component)
		return

	getDom(component).flushQueuedDispatches(true)
	const element = component.element
	if (!element)
		return

	ComponentPerf.Rect(component)?.markDirty()
	for (const callback of ComponentPerf.CallbacksOnInsertions.get(component))
		callback()
	if (component.classes.has(Classes.ReceiveInsertEvents))
		component.event.emit('insert')

	const descendantsListeningForEvent = element.getElementsByClassName(Classes.ReceiveAncestorInsertEvents)
	for (const descendant of descendantsListeningForEvent)
		descendant.component?.event.emit('ancestorInsert')
	for (const descendant of element.getElementsByClassName(Classes.HasRect))
		ComponentPerf.Rect(descendant.component)?.markDirty()
	for (const descendant of element.getElementsByClassName(Classes.HasStatesToMarkDirtyOnInsertions))
		for (const callback of ComponentPerf.CallbacksOnInsertions.get(descendant.component))
			callback()

	let cursor = element.parentElement
	while (cursor) {
		if (cursor.classList.contains(Classes.ReceiveDescendantInsertEvents))
			cursor.component?.event.emit('descendantInsert')

		cursor = cursor.parentElement
	}
}

function updateRooted (component: Component | undefined) {
	if (component) {
		const element = component.element
		if (!element)
			return

		const rooted = document.documentElement.contains(element)
		if (component.rooted.value === rooted)
			return

		component.rooted.asMutable?.setValue(rooted)
		if (component.classes.has(Classes.ReceiveRootedEvents))
			component.event.emit(rooted ? 'root' : 'unroot')

		for (const descendant of element.querySelectorAll<Element>('*')) {
			const component = descendant.component
			if (component) {
				component.rooted.asMutable?.setValue(rooted)
				if (component.classes.has(Classes.ReceiveRootedEvents))
					component.event.emit(rooted ? 'root' : 'unroot')
			}
		}
	}
}

function emitRemove (component: Component | undefined) {
	if (!component)
		return

	let cursor = component.element?.parentElement
	while (cursor) {
		if (cursor.classList.contains(Classes.ReceiveDescendantRemoveEvents))
			cursor.component?.event.emit('descendantRemove')

		cursor = cursor.parentElement
	}
}

let canBuildComponents = false
namespace Component {

	export interface StyleHost<STYLE> {
		// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
		styleTargets: StyleTargets<this, STYLE> & { [KEY in keyof STYLE]: State<ComponentName | undefined> }
	}

	export type PartialStyleTargets<HOST, PARENT> =
		HOST extends { styleTargets: StyleTargets<any, infer STYLE> } ?
		PARENT extends { styleTargets: StyleTargets<any, infer PARENT_STYLE> } ?
		Omit<STYLE, keyof PARENT_STYLE>
		: never
		: never

	export interface StyleTargets<HOST, STYLE> {
		// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
		(style: { [KEY in keyof STYLE]: ComponentName | null }): HOST
	}

	let bodyComponent: Component | undefined, documentComponent: Component | undefined, windowComponent: Component | undefined
	export const getBody = () => bodyComponent ??= wrap(document.body)
	export const getDocument = () => documentComponent ??= wrap(document.documentElement)
	export const getWindow = () => windowComponent ??= wrap(window as any as HTMLElement)

	export function setComponentLibrarySource (source?: string) {
		selfScript.value = source
	}

	let stackSupplier: (() => string) | undefined
	export function setStackSupplier (_stackSupplier: () => string) {
		stackSupplier = _stackSupplier
	}

	export function allowBuilding () {
		canBuildComponents = true
	}

	export function is (value: unknown): value is Component {
		return typeof value === 'object' && !!(value as Component)?.isComponent
	}

	export function element<NODE extends Node> (from: Component | NODE): NODE | undefined {
		return is(from) ? from.element as Node as NODE | undefined : from
	}

	export function realise<NODE extends Node> (from: Component | NODE): NODE {
		return is(from) ? getDom(from).realiseForInsertion(false) as Node as NODE : from
	}

	export function requireElement<NODE extends Node> (from: Component | NODE, reason = 'element required'): NODE {
		if (!is(from))
			return from

		return getDom(from).requireElement(reason) as Node as NODE
	}

	export function hasElement (component: Component): boolean {
		return !!getDom(component).element
	}

	export function isRealised (component: Component): boolean {
		return getDom(component).realised
	}

	export const isRealized = isRealised

	export function getDomController (component: Component): ComponentDomController {
		return getDom(component)
	}

	export function substituteInsertion (component: Component, provider: (component: Component) => Node | undefined): State.Unsubscribe {
		insertionSubstitutes.set(component, provider)
		return () => insertionSubstitutes.delete(component)
	}

	export function moveBefore (parent: Element, node: Node, child: Node | null): void {
		moveOrInsertBefore(parent, node, child)
	}

	export function wrap (element: HTMLElement): Component {
		const component = Component()
		getDom(component).adoptElement(element)
		component.rooted.asMutable?.setValue(element === window as never || element === document as never || document.contains(element))
		return component
	}

	export const SYMBOL_COMPONENT_TYPE_BRAND = Symbol('COMPONENT_TYPE_BRAND')

	export type BuilderLike<PARAMS extends any[] = any[], COMPONENT extends Component = Component> = Builder<PARAMS, COMPONENT> | Extension<PARAMS, COMPONENT>

	export interface BuilderExtensions<PARAMS extends any[], BUILD_COMPONENT extends Component | undefined> extends Omit<Extension<PARAMS, Exclude<BUILD_COMPONENT, undefined>>, 'setName' | 'builderType' | 'extend' | typeof SYMBOL_COMPONENT_TYPE_BRAND> {
		readonly builderType: 'builder'
		readonly [SYMBOL_COMPONENT_TYPE_BRAND]: BUILD_COMPONENT
		setName (name: string): this
		extend<T> (extensionProvider: (component: BUILD_COMPONENT & T) => Omit<T, typeof SYMBOL_COMPONENT_BRAND>): BUILD_COMPONENT & T
	}

	export interface Builder<PARAMS extends any[], BUILD_COMPONENT extends Component | undefined> extends BuilderExtensions<PARAMS, BUILD_COMPONENT> {
		(...params: PARAMS): BUILD_COMPONENT
	}

	export interface BuilderAsync<PARAMS extends any[], BUILD_COMPONENT extends Component | undefined> extends Omit<ExtensionAsync<PARAMS, Exclude<BUILD_COMPONENT, undefined>>, 'setName' | 'builderType' | 'extend' | typeof SYMBOL_COMPONENT_TYPE_BRAND> {
		readonly builderType: 'builder'
		readonly [SYMBOL_COMPONENT_TYPE_BRAND]: BUILD_COMPONENT
		(...params: PARAMS): Promise<BUILD_COMPONENT>
		setName (name: string): this
		extend<T> (extensionProvider: (component: BUILD_COMPONENT & T) => Omit<T, typeof SYMBOL_COMPONENT_BRAND>): BUILD_COMPONENT & T
	}

	const SYMBOL_EXTENSIONS_APPLIED = Symbol('EXTENSIONS_APPLIED')

	const defaultBuilder = (type?: keyof HTMLElementTagNameMap) => Component(type)
	export function Builder<PARAMS extends any[], COMPONENT extends Component> (builder: (component: Component, ...params: PARAMS) => COMPONENT): Builder<PARAMS, COMPONENT>
	export function Builder<PARAMS extends any[], COMPONENT extends Component> (builder: (component: Component, ...params: PARAMS) => Promise<COMPONENT>): BuilderAsync<PARAMS, COMPONENT>
	export function Builder<PARAMS extends any[], COMPONENT extends Component> (initial: keyof HTMLElementTagNameMap | (() => Component), builder: (component: Component, ...params: PARAMS) => COMPONENT): Builder<PARAMS, COMPONENT>
	export function Builder<PARAMS extends any[], COMPONENT extends Component> (initial: keyof HTMLElementTagNameMap | (() => Component), builder: (component: Component, ...params: PARAMS) => Promise<COMPONENT>): BuilderAsync<PARAMS, COMPONENT>
	export function Builder<PARAMS extends any[], COMPONENT extends Component | undefined> (builder: (component: Component, ...params: PARAMS) => COMPONENT): Builder<PARAMS, COMPONENT>
	export function Builder<PARAMS extends any[], COMPONENT extends Component | undefined> (builder: (component: Component, ...params: PARAMS) => Promise<COMPONENT>): BuilderAsync<PARAMS, COMPONENT>
	export function Builder<PARAMS extends any[], COMPONENT extends Component | undefined> (initial: keyof HTMLElementTagNameMap | (() => Component), builder: (component: Component, ...params: PARAMS) => COMPONENT): Builder<PARAMS, COMPONENT>
	export function Builder<PARAMS extends any[], COMPONENT extends Component | undefined> (initial: keyof HTMLElementTagNameMap | (() => Component), builder: (component: Component, ...params: PARAMS) => Promise<COMPONENT>): BuilderAsync<PARAMS, COMPONENT>
	export function Builder (initialOrBuilder: keyof HTMLElementTagNameMap | AnyFunction, builder?: (component: Component, ...params: any[]) => Component | Promise<Component>): (component?: Component, ...params: any[]) => Component | Promise<Component> {
		let name = getBuilderName()

		const type = typeof initialOrBuilder === 'string' ? initialOrBuilder : undefined
		const initialBuilder: (type?: keyof HTMLElementTagNameMap) => Component = !builder || typeof initialOrBuilder === 'string' ? defaultBuilder : initialOrBuilder
		builder ??= initialOrBuilder as AnyFunction

		const realBuilder = (component = initialBuilder(type), ...params: any[]) => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			const result = builder(component, ...params)
			if (result instanceof Promise)
				return result.then(result => {
					if (result !== component)
						void ensureOriginalComponentNotSubscriptionOwner(component)
					return applyExtensions(result)
				})

			if (result !== component)
				void ensureOriginalComponentNotSubscriptionOwner(component)
			return applyExtensions(result)
		}
		const simpleBuilder = (...params: any[]) => {
			const initialComponent = initialBuilder(type)
			getDom(initialComponent).deferRealisation()
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			const component = realBuilder(initialComponent, ...params)
			if (component instanceof Promise)
				return component.then(applyExtensions).then(component => completeComponent(component, initialComponent))

			return completeComponent(applyExtensions(component), initialComponent)
		}

		Object.defineProperty(builder, 'name', { value: name, configurable: true })
		Object.defineProperty(builder, Symbol.toStringTag, { value: name, configurable: true })
		Object.defineProperty(realBuilder, 'name', { value: name, configurable: true })
		Object.defineProperty(realBuilder, Symbol.toStringTag, { value: name, configurable: true })
		Object.defineProperty(simpleBuilder, 'name', { value: name, configurable: true })
		Object.defineProperty(simpleBuilder, Symbol.toStringTag, { value: name, configurable: true })

		const extensions: ((component: Component) => unknown)[] = []

		// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
		const styleTargets = (style: Record<string, ComponentName | null>) => {
			extensions.push(component => {
				(component as Component & StyleHost<Record<string, true>>).styleTargets(style)
			})
			return resultBuilder
		}

		const resultBuilder = Object.assign(simpleBuilder, {
			from: realBuilder,
			setName (newName: string) {
				name = addKebabCase(newName)
				Object.defineProperty(simpleBuilder, 'name', { value: name })
				return resultBuilder
			},
			extend (extensionProvider: (component: Component) => unknown) {
				extensions.push(extensionProvider)
				return resultBuilder
			},
			styleTargets: styleTargets,
			styleTargetsPartial: styleTargets,
		})
		return resultBuilder

		function applyExtensions (component: Component) {
			if (!component)
				return component

			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const editableComponent = component as any
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			let extensionsApplied = editableComponent[SYMBOL_EXTENSIONS_APPLIED] as unknown[] | undefined
			if (extensionsApplied?.includes(realBuilder))
				return component

			for (const extension of extensions)
				Object.assign(component, extension(component))

			if (!extensionsApplied)
				Object.defineProperty(component, SYMBOL_EXTENSIONS_APPLIED, { value: extensionsApplied = [] })

			// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			editableComponent[SYMBOL_EXTENSIONS_APPLIED].push(realBuilder)
			return component
		}

		function completeComponent (component: Component, initialComponent?: Component) {
			if (!component)
				return component

			if (name) {
				(component as Component & { [Symbol.toStringTag]?: string })[Symbol.toStringTag] ??= name.toString()
				const tagName = `:${name.kebabcase}`
				if (getDom(component).tagName === 'SPAN') {
					component.replaceElement(tagName as keyof HTMLElementTagNameMap)
				}
				else {
					component.attributes.prepend(tagName)
				}
			}

			component.supers.value.push(simpleBuilder)
			component.supers.emit()
			if (initialComponent && initialComponent !== component)
				getDom(initialComponent).flushDeferredRealisation()
			getDom(component).flushDeferredRealisation()
			return component
		}

		async function ensureOriginalComponentNotSubscriptionOwner (original?: Component) {
			if (!original || !State.OwnerMetadata.hasSubscriptions(original))
				return

			const originalRef = new WeakRef(original)
			original = undefined
			await new Promise<void>(resolve => setTimeout(resolve, 1000))

			original = originalRef.deref()
			if (!original || original.rooted.value || original.removed.value)
				return

			console.error(`${String(name ?? 'Component')} builder returned a replacement component, but the original component was used as a subscription owner and is not in the tree!`)
		}
	}

	export interface Extension<PARAMS extends any[], EXT_COMPONENT extends Component> {
		readonly builderType: 'extension'
		readonly [SYMBOL_COMPONENT_TYPE_BRAND]: EXT_COMPONENT
		readonly name: BuilderName
		from<COMPONENT extends Component> (component?: COMPONENT, ...params: PARAMS): COMPONENT & EXT_COMPONENT
		setName (name: string): this
		extend<T> (extensionProvider: (component: EXT_COMPONENT & T) => Omit<T, typeof SYMBOL_COMPONENT_BRAND>): EXT_COMPONENT & T
		// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
		styleTargets (style: EXT_COMPONENT extends StyleHost<infer STYLE> ? { [KEY in keyof STYLE]: ComponentName | null } : never): this
		// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
		styleTargetsPartial<STYLE> (style: EXT_COMPONENT extends StyleHost<infer FULL_STYLE> ? keyof STYLE extends keyof FULL_STYLE ? { [KEY in keyof STYLE]: ComponentName | null } : never : never): EXT_COMPONENT & StyleHost<STYLE>
	}

	export interface ExtensionAsync<PARAMS extends any[], EXT_COMPONENT extends Component> {
		readonly builderType: 'extension'
		readonly [SYMBOL_COMPONENT_TYPE_BRAND]: EXT_COMPONENT
		readonly name: BuilderName
		from<COMPONENT extends Component> (component?: COMPONENT, ...params: PARAMS): Promise<COMPONENT & EXT_COMPONENT>
		setName (name: string): this
		extend<T> (extensionProvider: (component: EXT_COMPONENT & T) => Omit<T, typeof SYMBOL_COMPONENT_BRAND>): EXT_COMPONENT & T
		// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
		styleTargets (style: EXT_COMPONENT extends StyleHost<infer STYLE> ? { [KEY in keyof STYLE]: ComponentName | null } : never): this
		// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
		styleTargetsPartial<STYLE> (style: EXT_COMPONENT extends StyleHost<infer FULL_STYLE> ? keyof STYLE extends keyof FULL_STYLE ? { [KEY in keyof STYLE]: ComponentName | null } : never : never): EXT_COMPONENT & StyleHost<STYLE>
	}

	export function Extension<PARAMS extends any[], COMPONENT extends Component> (builder: (component: Component, ...params: PARAMS) => COMPONENT): Extension<PARAMS, COMPONENT>
	export function Extension<PARAMS extends any[], COMPONENT extends Component> (builder: (component: Component, ...params: PARAMS) => Promise<COMPONENT>): ExtensionAsync<PARAMS, COMPONENT>
	export function Extension (builder: (component: Component, ...params: any[]) => Component | Promise<Component>) {
		return {
			name: getBuilderName(),
			from: builder,
			setName (newName: string) {
				mutable(this).name = addKebabCase(newName)
				return this
			},
		} as Extension<any[], Component> | ExtensionAsync<any[], Component>
	}

	export function Tag () {
		return Extension(component => component)
	}

	export function extend (extension: (component: Mutable<Component>) => unknown) {
		componentExtensionsRegistry.push(extension as (component: Mutable<Component>) => unknown)
	}

	/**
	 * Returns the component for the given element, if it exists
	 */
	export function get (element?: unknown): Component | undefined {
		if (!element || (typeof element !== 'object' && typeof element !== 'function'))
			return undefined

		return is(element) ? element : ELEMENT_TO_COMPONENT_MAP.get(element as Element)
	}

	// const STACK_FILE_NAME_REGEX = /\(http.*?(\w+)\.ts:\d+:\d+\)/
	const STACK_FILE_LINE_REGEX = /\(http.*?\w+\.[tj]s:(\d+):\d+\)|@http.*?\w+\.[tj]s:(\d+):\d+/
	const VARIABLE_NAME_REGEX = /\s*(?:const |exports\.(?!default))(\w+) = /
	const LAST_MODULE_DEF_REGEX = /.*\bdefine\("(?:[^"]+\/)*(\w+)", /s
	const PASCAL_CASE_WORD_START = /(?<=[a-z0-9_-])(?=[A-Z])/g

	interface BuilderName extends String {
		kebabcase: string
	}

	function addKebabCase (name: string): BuilderName {
		return Object.assign(String(name), {
			kebabcase: name.replaceAll(PASCAL_CASE_WORD_START, '-').toLowerCase(),
		})
	}

	// let logNode: HTMLElement | undefined
	let indexjsText!: string | undefined
	let lines: string[] | undefined
	function getBuilderName (): BuilderName | undefined {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		let moduleName = '__moduleName' in self ? (self as any).__moduleName as string | undefined : undefined
		if (moduleName)
			return addKebabCase(moduleName.slice(moduleName.lastIndexOf('/') + 1))

		if (!lines) {
			indexjsText ??= (document.currentScript as HTMLScriptElement)?.text ?? selfScript.value
			if (!indexjsText)
				return undefined

			lines = indexjsText.split('\n')
		}

		// if (!logNode) {
		// 	logNode = document.createElement('div')
		// 	document.body.prepend(logNode)
		// }
		const rawStack = stackSupplier?.() ?? new Error().stack ?? ''
		const stack = Strings.shiftLine(rawStack, rawStack.includes('@') ? 2 : 3) // handle safari stack traces (@)

		// logNode.append(document.createTextNode(`original stack ${new Error().stack}`), document.createElement('br'))
		// logNode.append(document.createTextNode(`shifted stack ${stack}`), document.createElement('br'))

		const lineMatch = stack.match(STACK_FILE_LINE_REGEX)
		const line = Number(lineMatch?.[1] ?? lineMatch?.[2])
		const lineText = lines[line - 1]
		// logNode.append(document.createTextNode(`found ${lineMatch?.[1] ?? lineMatch?.[2]} ${line} ${lineText}`))
		// logNode.append(document.createElement('br'), document.createElement('br'))
		if (!lineText)
			return undefined

		const varName = lineText.match(VARIABLE_NAME_REGEX)?.[1]
		if (varName)
			return addKebabCase(varName)

		const sliceUntilLine = indexjsText!.slice(0, indexjsText!.indexOf(lineText))
		moduleName = sliceUntilLine.match(LAST_MODULE_DEF_REGEX)?.[1]
		if (!moduleName)
			return undefined

		return addKebabCase(moduleName)
	}

	export function removeContents (element: Node) {
		for (const child of [...element.childNodes]) {
			if (child.component)
				child.component.remove()
			else {
				removeContents(child)
				child.remove()
			}
		}
	}

	export function closest<BUILDERS extends Component.BuilderLike[]> (builder: BUILDERS, element?: HTMLElement | Component | null): { [INDEX in keyof BUILDERS]: BUILDERS[INDEX] extends infer BUILDER ? (BUILDER extends Component.BuilderLike<any[], infer COMPONENT> ? COMPONENT : never) | undefined : never }[number]
	export function closest<BUILDER extends Component.BuilderLike> (builder: BUILDER, element?: HTMLElement | Component | null): (BUILDER extends Component.BuilderLike<any[], infer COMPONENT> ? COMPONENT : never) | undefined
	export function closest<COMPONENT extends Component> (builder: Component.Builder<any[], COMPONENT>, element?: HTMLElement | Component | null): COMPONENT | undefined
	export function closest<COMPONENT extends Component> (builder: Component.Extension<any[], COMPONENT>, element?: HTMLElement | Component | null): COMPONENT | undefined
	export function closest (builder: BuilderLike, element?: HTMLElement | Component | null) {
		let cursor: HTMLElement | null = is(element) ? element.element ?? null : element ?? null
		while (cursor) {
			const component = cursor?.component
			if (component?.is(builder))
				return component

			cursor = cursor.parentElement
		}
	}

	export function findAll<BUILDERS extends Component.BuilderLike[]> (builder: BUILDERS, element?: HTMLElement | Component | null): { [INDEX in keyof BUILDERS]: BUILDERS[INDEX] extends infer BUILDER ? (BUILDER extends Component.BuilderLike<any[], infer COMPONENT> ? COMPONENT : never) : never }[number][]
	export function findAll<BUILDER extends Component.BuilderLike> (builder: BUILDER, element?: HTMLElement | Component | null): (BUILDER extends Component.BuilderLike<any[], infer COMPONENT> ? COMPONENT : never)[]
	export function findAll<COMPONENT extends Component> (builder: Component.Builder<any[], COMPONENT>, element?: HTMLElement | Component | null): COMPONENT[]
	export function findAll<COMPONENT extends Component> (builder: Component.Extension<any[], COMPONENT>, element?: HTMLElement | Component | null): COMPONENT[]
	export function findAll (builder: BuilderLike, element?: HTMLElement | Component | null) {
		const components: Component[] = []
		const cursor: HTMLElement | null = is(element) ? element.element ?? null : element ?? null
		if (cursor) {
			const walker = document.createTreeWalker(cursor, NodeFilter.SHOW_ELEMENT)
			let node: Node | null
			while ((node = walker.nextNode())) {
				const component = (node as Element).component
				if (component?.is(builder))
					components.push(component)
			}
		}
		return components
	}

}

export default Component
