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
type OnLoadHandler<HOST> = (loading: HOST, displayLoaded: () => unknown) => unknown
export interface LoadingExtensions extends Loading.LoadedSlotExtensions {
	readonly spinner: Component
	readonly progressBar: Component
	readonly messageText: Component
	readonly errorIcon: Component
	readonly errorText: Component
	readonly loaded: State<boolean>
	set<T> (state: State.Async<T, StringApplicatorSource>, initialiser: (slot: Loading.LoadedSlot, value: T) => unknown): this
	set<T> (
		load: (signal: AbortSignal, setProgress: (progress: number | null, details?: StringApplicatorSource) => void) => Promise<T>,
		initialiser: (slot: Loading.LoadedSlot, value: T) => unknown,
	): this
	onSet (handler: OnSetHandler<this>): this
	onLoad (handler: OnLoadHandler<this>): this
}

interface Loading extends Component, LoadingExtensions, Component.StyleHost<typeof LoadingStyleTargets> { }

namespace Loading {
	export interface LoadedSlotExtensions {
		refresh (): this
	}

	export interface LoadedSlot extends Component, LoadedSlotExtensions { }
}

const Loading = Component((component): Loading => {
	const loading = component.addStyleTargets(LoadingStyleTargets)
	const style = loading.styleTargets
	const storage = Component().setOwner(component)

	const spinner = Component().style(style.Spinner)
	const progressBar = Component().style(style.ProgressBar)
	const messageText = Component().style(style.MessageText)
	const errorIcon = Component().style(style.ErrorIcon)
	const errorText = Component().style(style.ErrorText)

	const loaded = State(false)

	let owner: State.Owner.Removable | undefined
	let refresh: (() => void) | undefined
	const onSetHandlers: OnSetHandler<Loading>[] = []
	const onLoadHandlers: OnLoadHandler<Loading>[] = []
	return loading.style(style.Loading)
		.extend<LoadingExtensions>(loading => ({
			spinner,
			progressBar,
			messageText,
			errorIcon,
			errorText,
			loaded,
			refresh () {
				refresh?.()
				return this
			},
			set (stateIn, initialiser) {
				owner?.remove(); owner = State.Owner.create()

				loaded.value = false

				const state = typeof stateIn !== 'function' ? stateIn : State.Async(owner, stateIn)

				refresh = state.refresh

				updateDisplays()
				state.settled.subscribe(owner, updateDisplays)
				state.progress.subscribe(owner, updateDisplays)
				state.state.use(owner, state => {
					if (!state.settled) {
						clearContents()
						loading.append(spinner, progressBar, messageText)
						return
					}

					if (state.error) {
						clearContents()
						loading.append(errorIcon, errorText)
						return
					}

					let loadHandlerIndex = 0
					function runNextLoadHandler () {
						const loadHandler = onLoadHandlers[loadHandlerIndex]
						if (!loadHandler) {
							clearContents()
							loaded.value = true
							initialiser(loading, state.value!)
							return
						}

						loadHandlerIndex++
						return loadHandler(loading, runNextLoadHandler)
					}

					runNextLoadHandler()
				})

				for (const handler of onSetHandlers)
					handler(loading, owner, state)

				return loading

				function clearContents () {
					storage.append(spinner, progressBar, messageText, errorIcon, errorText)
					loading.removeContents()
				}

				function updateDisplays () {
					loading.style.bind(state.settled.value, style.LoadingLoaded)
					messageText.text.set(state.progress.value?.details)
					progressBar
						.style.bind(state.progress.value?.progress === null, style.ProgressBarProgressUnknown)
						.style.setVariable('progress', state.progress.value?.progress ?? 1)
				}
			},
			onSet (handler) {
				onSetHandlers.push(handler)
				return loading
			},
			onLoad (handler) {
				onLoadHandlers.push(handler)
				return loading
			},
		}))
		.onRemoveManual(() => {
			owner?.remove(); owner = undefined
			refresh = undefined
		})
})

export default Loading
