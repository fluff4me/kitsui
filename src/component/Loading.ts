import Component from 'Component'
import State from 'utility/State'
import type { StringApplicatorSource } from 'utility/StringApplicator'

enum LoadingStyleTargets {
	Loading,
	LoadingLoaded,
	Spinner,
	ProgressBar,
	ProgressBarProgressUnknown,
	MessageText,
	ErrorIcon,
	ErrorText,
}

type OnSetHandler<HOST> = (loading: HOST, owner: State.Owner, state: State.Async<unknown, StringApplicatorSource>) => unknown
interface LoadingExtensions extends Loading.LoadedSlotExtensions {
	readonly spinner: Component
	readonly progressBar: Component
	readonly messageText: Component
	readonly errorIcon: Component
	readonly errorText: Component
	set<T> (state: State.Async<T, StringApplicatorSource>, initialiser: (slot: Loading.LoadedSlot, value: T) => unknown): this
	set<T> (
		load: (signal: AbortSignal, setProgress: (progress: number | null, details?: StringApplicatorSource) => void) => Promise<T>,
		initialiser: (slot: Loading.LoadedSlot, value: T) => unknown,
	): this
	onSet (handler: OnSetHandler<this>): this
}

interface Loading extends Component, LoadingExtensions, Component.StyleHost<typeof LoadingStyleTargets> { }

namespace Loading {
	export interface LoadedSlotExtensions {
		refresh (): this
	}

	export interface LoadedSlot extends Component, LoadedSlotExtensions { }
}

const Loading = Component((component): Loading => {
	const loading = component.setStyleTargets(LoadingStyleTargets)
	const style = loading.styleTargets
	const storage = Component().setOwner(component)

	const spinner = Component().style(style.Spinner)
	const progressBar = Component().style(style.ProgressBar)
	const messageText = Component().style(style.MessageText)
	const errorIcon = Component().style(style.ErrorIcon)
	const errorText = Component().style(style.ErrorText)

	let owner: State.Owner.Removable | undefined
	let refresh: (() => void) | undefined
	const onSetHandlers: OnSetHandler<Loading>[] = []
	return loading.style(style.Loading)
		.extend<LoadingExtensions>(loading => ({
			spinner,
			progressBar,
			messageText,
			errorIcon,
			errorText,
			refresh () {
				refresh?.()
				return this
			},
			set (state, initialiser) {
				owner?.remove(); owner = State.Owner.create()

				if (typeof state === 'function')
					state = State.Async(owner, state)

				refresh = state.refresh

				loading.style.bind(state.settled, style.LoadingLoaded)
				progressBar
					.style.bind(state.progress.map(owner, progress => progress?.progress === null), style.ProgressBarProgressUnknown)
					.style.bindVariable('progress', state.progress.map(owner, progress => progress?.progress ?? 1))
				messageText.text.bind(state.progress.map(owner, progress => progress?.details))
				state.state.use(owner, state => {
					storage.append(spinner, progressBar, messageText, errorIcon, errorText)
					loading.removeContents()

					if (!state.settled) {
						loading.append(spinner, progressBar, messageText)
						return
					}

					if (state.error) {
						loading.append(errorIcon, errorText)
						return
					}

					initialiser(loading, state.value)
				})

				for (const handler of onSetHandlers)
					handler(loading, owner, state)

				return loading
			},
			onSet (handler) {
				onSetHandlers.push(handler)
				return loading
			},
		}))
		.onRemoveManual(() => {
			owner?.remove(); owner = undefined
			refresh = undefined
		})
})

export default Loading
