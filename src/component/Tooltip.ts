import Component from 'Component'
import type { PopoverComponentRegisteredExtensions } from 'component/Popover'
import Popover from 'component/Popover'

export type PopoverInitialiser<HOST> = (popover: Popover, host: HOST) => unknown

interface TooltipComponentExtensions {
	setTooltip (initialiser: PopoverInitialiser<this>): this & PopoverComponentRegisteredExtensions
	setTooltip (tooltip: Tooltip): this & PopoverComponentRegisteredExtensions
}

declare module 'Component' {
	interface ComponentExtensions extends TooltipComponentExtensions { }
}

export interface TooltipExtensions { }

enum TooltipStyleTargets {
	Tooltip,
}

type PopoverWithTooltipStyleTargets = Popover & Component.StyleHost<typeof TooltipStyleTargets>
interface Tooltip extends PopoverWithTooltipStyleTargets, TooltipExtensions { }

const Tooltip = Component((component): Tooltip => {
	const tooltip = component.and(Popover)
		.setDelay(300)
		.setMousePadding(0)
		.addStyleTargets(TooltipStyleTargets)
	return tooltip.style(tooltip.styleTargets.Tooltip)
		.anchor.add('aligned left', 'off bottom')
		.anchor.add('aligned left', 'off top')
		.anchor.add('aligned right', 'off bottom')
		.anchor.add('aligned right', 'off top')
})

Component.extend(component => {
	component.extend<TooltipComponentExtensions>((component: Component & TooltipComponentExtensions & Partial<PopoverComponentRegisteredExtensions>) => ({
		setTooltip (initialiserOrTooltip) {
			if (Component.is(initialiserOrTooltip))
				return component.setPopover('hover/longpress', initialiserOrTooltip)

			const initialiser = initialiserOrTooltip
			return component.setPopover('hover/longpress', (popover, host) => initialiser(popover.and(Tooltip), host))
		},
	}))
})

export default Tooltip
