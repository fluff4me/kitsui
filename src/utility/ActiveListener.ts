import type Component from 'Component'

namespace ActiveListener {
	let lastActive: HTMLElement[] = []

	export function allActive (): readonly HTMLElement[] {
		return lastActive
	}

	export function active (): HTMLElement | undefined {
		return lastActive.at(-1)
	}

	export function* allActiveComponents (): Generator<Component> {
		for (const element of lastActive) {
			const component = element.component
			if (component)
				yield component
		}
	}

	export function activeComponent (): Component | undefined {
		return lastActive.at(-1)?.component
	}

	export function listen () {
		document.addEventListener('mousedown', updateActive)
		document.addEventListener('mouseup', updateActive)

		function updateActive (event: MouseEvent) {
			if (event.button !== 0)
				return // Only consider left mouse button

			const allActive = event.type === 'mousedown' ? getActive(event) : []
			const active = allActive[allActive.length - 1]
			if (active === lastActive[lastActive.length - 1])
				return

			const newActive = [...allActive]
			for (const element of lastActive)
				if (element.component && !newActive.includes(element))
					element.component.activeTime.asMutable?.setValue(undefined)

			for (const element of newActive)
				if (element.component && !lastActive.includes(element))
					element.component.activeTime.asMutable?.setValue(Date.now())

			lastActive = newActive
		}

		function getActive (event: MouseEvent) {
			const hovered: HTMLElement[] = []
			let cursor = event.target as HTMLElement | null
			while (cursor) {
				hovered.push(cursor)
				cursor = cursor.parentElement
			}

			return hovered
		}
	}

}

export default ActiveListener
Object.assign(window, { ActiveListener })
