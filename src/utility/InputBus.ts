import Component from 'Component'
import type { Events } from 'utility/EventManipulator'
import EventManipulator from 'utility/EventManipulator'

enum Classes {
	ReceiveFocusedClickEvents = '_receieve-focused-click-events',
}

interface InputBusComponentExtensions {
	receiveFocusedClickEvents (): this
}

declare module 'Component' {

	interface ComponentExtensions extends InputBusComponentExtensions { }
}

Component.extend(component => {
	component.extend<InputBusComponentExtensions>(component => ({
		receiveFocusedClickEvents: () => component.classes.add(Classes.ReceiveFocusedClickEvents),
	}))
})

export const HandlesKeyboardEvents = Component.Tag().setName('HandlesKeyboardEvents')
export const HandlesMouseEvents = Component.Tag().setName('HandlesMouseEvents')

type Modifier = 'ctrl' | 'shift' | 'alt'

export interface InputEvent {
	key: string
	ctrl: boolean
	shift: boolean
	alt: boolean
	used: boolean
	targetElement: HTMLElement | null
	targetComponent: Component | null
	input: HTMLElement | null
	use (key: string, ...modifiers: Modifier[]): boolean
	useOverInput (key: string, ...modifiers: Modifier[]): boolean
	matches (key: string, ...modifiers: Modifier[]): boolean
	cancelInput (): void
	hovering (selector?: string): HTMLElement | undefined
}

export interface InputUpEvent extends InputEvent {
	usedAnotherKeyDuring: boolean
}

export interface InputBusEvents {
	Down (input: InputEvent): any
	Up (input: InputUpEvent): any
}

const MOUSE_KEYNAME_MAP: Record<string, string> = {
	[0]: 'MouseLeft',
	[1]: 'MouseMiddle',
	[2]: 'MouseRight',
	[3]: 'Mouse3',
	[4]: 'Mouse4',
	[5]: 'Mouse5',

	[`${undefined}`]: 'Mouse?',
}

type RawEvent = Partial<KeyboardEvent> & Partial<MouseEvent> & (KeyboardEvent | MouseEvent)

let lastUsed = 0
const inputDownTime: Record<string, number | undefined> = {}

interface InputBusExtensions {
	getPressStart (name: string): number | undefined
	getPressDuration (name: string): number | undefined
	isDown (name: string): boolean
	isUp (name: string): boolean
}

interface InputBus extends InputBusExtensions {
	readonly event: EventManipulator<this, Events<Component, InputBusEvents>>
}

const InputBus: InputBus = Object.assign(
	{
		getPressStart: (name: string) => inputDownTime[name],
		getPressDuration: (name: string) => inputDownTime[name] === undefined ? undefined : Date.now() - inputDownTime[name],
		isDown: (name: string) => !!inputDownTime[name],
		isUp: (name: string) => !inputDownTime[name],
	} satisfies InputBusExtensions,
	{
		event: EventManipulator({}) as EventManipulator<InputBus, InputBusEvents>,
	}
)

function emitKeyEvent (e: RawEvent) {
	const target = e.target as HTMLElement | null
	const input = target?.closest<HTMLElement>('input[type=text], textarea, [contenteditable]') ?? null
	let usedByInput = !!input

	const isClick = true
		&& !usedByInput
		&& e.type === 'keydown'
		&& (e.key === 'Enter' || e.key === ' ')
		&& !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey
		&& !!target?.classList.contains(Classes.ReceiveFocusedClickEvents)
	if (isClick) {
		const result = target?.component?.event.emit('click')

		if (result?.stoppedPropagation === true)
			e.stopPropagation()
		else if (result?.stoppedPropagation === 'immediate')
			e.stopImmediatePropagation()

		if (result?.defaultPrevented) {
			e.preventDefault()
			return
		}
	}

	const eventKey = e.key ?? MOUSE_KEYNAME_MAP[e.button!]
	const eventType = e.type === 'mousedown' ? 'keydown' : e.type === 'mouseup' ? 'keyup' : e.type as 'keydown' | 'keyup'
	if (eventType === 'keydown')
		inputDownTime[eventKey] = Date.now()

	let cancelInput = false
	const event: InputEvent & Partial<InputUpEvent> = {
		key: eventKey,
		ctrl: e.ctrlKey,
		shift: e.shiftKey,
		alt: e.altKey,
		used: usedByInput,
		input,
		targetElement: target,
		targetComponent: target?.component ?? null,
		use: (key, ...modifiers) => {
			if (event.used)
				return false

			const matches = event.matches(key, ...modifiers)
			if (matches)
				event.used = true

			return matches
		},
		useOverInput: (key, ...modifiers) => {
			if (event.used && !usedByInput)
				return false

			const matches = event.matches(key, ...modifiers)
			if (matches) {
				event.used = true
				usedByInput = false
			}

			return matches
		},
		matches: (key, ...modifiers) => {
			if (eventKey !== key)
				return false

			if (!modifiers.every(modifier => event[modifier]))
				return false

			return true
		},
		cancelInput: () => cancelInput = true,
		hovering: selector => {
			const hovered = [...document.querySelectorAll<HTMLElement>(':hover')]
			return selector ? hovered[hovered.length - 1]?.closest<HTMLElement>(selector) ?? undefined : hovered[hovered.length - 1]
		},
	}

	if (eventType === 'keyup') {
		event.usedAnotherKeyDuring = lastUsed > (inputDownTime[eventKey] ?? 0)
		delete inputDownTime[eventKey]
	}

	InputBus.event.emit(eventType === 'keydown' ? 'Down' : 'Up', event as InputUpEvent)

	if ((event.used && !usedByInput) || (usedByInput && cancelInput)) {
		e.preventDefault()
		lastUsed = Date.now()
	}

	if (usedByInput) {
		if (e.type === 'keydown' && eventKey === 'Enter' && !event.shift && !event.alt) {
			const form = target?.closest('form')
			if (form && (target?.tagName.toLowerCase() === 'input' || target?.closest('[contenteditable]')) && !event.ctrl) {
				if (!Component.closest(HandlesKeyboardEvents, target))
					e.preventDefault()
			}
			else {
				form?.requestSubmit()
			}
		}
	}
}

document.addEventListener('keydown', emitKeyEvent, { capture: true })
document.addEventListener('keyup', emitKeyEvent, { capture: true })

document.addEventListener('mousedown', emitKeyEvent)
document.addEventListener('mouseup', emitKeyEvent)
document.addEventListener('click', emitKeyEvent)

declare global {
	interface MouseEvent {
		used: boolean
		use (key: string, ...modifiers: Modifier[]): boolean
		matches (key: string, ...modifiers: Modifier[]): boolean
	}
	interface PointerEvent {
		used: boolean
		use (key: string, ...modifiers: Modifier[]): boolean
		matches (key: string, ...modifiers: Modifier[]): boolean
	}
}

interface MouseEventInternal extends MouseEvent {
	_used?: boolean
}

Object.defineProperty(MouseEvent.prototype, 'used', {
	get (this: MouseEventInternal) {
		return this._used ?? false
	},
})

Object.defineProperty(MouseEvent.prototype, 'use', {
	value: function (this: MouseEventInternal, key: string, ...modifiers: Modifier[]) {
		if (this._used)
			return false

		const matches = this.matches(key, ...modifiers)
		if (matches) {
			this._used = true
			// allow click & contextmenu handlers to be considered "used" for IKeyUpEvents
			lastUsed = Date.now()
		}

		return matches
	},
})

Object.defineProperty(MouseEvent.prototype, 'matches', {
	value: function (this: MouseEventInternal, key: string, ...modifiers: Modifier[]) {
		if (MOUSE_KEYNAME_MAP[this.button] !== key)
			return false

		if (!modifiers.every(modifier => this[`${modifier}Key`]))
			return false

		return true
	},
})

export default InputBus
