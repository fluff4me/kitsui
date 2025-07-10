import type Component from 'Component'
import Arrays from 'utility/Arrays'
import Mouse from 'utility/Mouse'

namespace HoverListener {
	let lastHovered: HTMLElement[] = []

	export function allHovered (): readonly HTMLElement[] {
		return lastHovered
	}

	export function hovered (): HTMLElement | undefined {
		return lastHovered.at(-1)
	}

	export function* allHoveredComponents (): Generator<Component> {
		for (const element of lastHovered) {
			const component = element.component
			if (component)
				yield component
		}
	}

	export function hoveredComponent (): Component | undefined {
		return lastHovered.at(-1)?.component
	}

	export function listen () {
		Mouse.onMove((event, allHovered) => {
			const hovered = allHovered.at(-1)

			if (hovered && (hovered.clientWidth === 0 || hovered.clientHeight === 0))
				Arrays.filterInPlace(allHovered, element => element.computedStyleMap().get('display')?.toString() !== 'none')

			if (hovered === lastHovered.at(-1))
				return

			const newHovered = allHovered

			const noLongerHovering = lastHovered.filter(element => !newHovered.includes(element))
			for (const element of noLongerHovering)
				if (element.component)
					element.component.hoveredTime.asMutable?.setValue(undefined)

			const nowHovering = newHovered.filter(element => !lastHovered.includes(element))
			for (const element of nowHovering)
				if (element.component)
					element.component.hoveredTime.asMutable?.setValue(Date.now())

			lastHovered = newHovered
		})
	}

}

export default HoverListener
Object.assign(window, { HoverListener })
