import State from 'utility/State'

namespace Viewport {

	export interface Size {
		w: number
		h: number
	}

	export const size = State.JIT<Size>(() => ({ w: window.innerWidth, h: window.innerHeight }))
	export const sizeExcludingScrollbars = State.JIT<Size>(() => ({ w: document.documentElement.clientWidth, h: document.documentElement.clientHeight }))
	export const mobile = State.JIT(owner => {
		const contentWidth = 800
		const result = size.value.w < contentWidth
		size.subscribe(owner, mobile.markDirty)
		return result
	})
	export const tablet = State.JIT(owner => {
		const tabletWidth = 1200
		const result = size.value.w < tabletWidth
		size.subscribe(owner, tablet.markDirty)
		return result
	})
	export const laptop = State.JIT(owner => {
		const laptopWidth = 1600
		const result = size.value.w < laptopWidth
		size.subscribe(owner, laptop.markDirty)
		return result
	})

	export type State =
		| 'desktop'
		| 'laptop'
		| 'tablet'
		| 'mobile'

	export const state = State.JIT(owner => {
		const result = mobile.value ? 'mobile' : tablet.value ? 'tablet' : laptop.value ? 'laptop' : 'desktop'
		mobile.subscribe(owner, state.markDirty)
		tablet.subscribe(owner, state.markDirty)
		laptop.subscribe(owner, state.markDirty)
		return result
	})

	export function listen () {
		window.addEventListener('resize', () => { size.markDirty(); sizeExcludingScrollbars.markDirty() })
	}
}

export default Viewport
