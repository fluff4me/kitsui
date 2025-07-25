import Component from 'Component'
import State from 'utility/State'

const OPEN_DIALOGS = new Set<Dialog>()
function addOpenDialog (dialog: Dialog) {
	const hadOpenDialogs = !!OPEN_DIALOGS.size
	OPEN_DIALOGS.add(dialog)
	if (!hadOpenDialogs)
		Component.getDocument().style.setProperty('overflow', 'hidden')
}
function removeOpenDialog (dialog: Dialog) {
	OPEN_DIALOGS.delete(dialog)
	if (!OPEN_DIALOGS.size)
		Component.getDocument().style.removeProperties('overflow')
}

export interface DialogExtensions {
	readonly willClose: State<boolean>
	readonly willOpen: State<boolean>
	readonly opened: State<boolean>

	setNotModal (notModal?: boolean): this
	setFullscreen (fullscreen?: boolean): this

	open (): this
	close (): this
	toggle (open?: boolean): this
	bind (state: State.Mutable<boolean>): this
	unbind (): this
}

enum DialogStyleTargets {
	Dialog,
	Dialog_Open,
}

interface Dialog extends Component, DialogExtensions, Component.StyleHost<typeof DialogStyleTargets> { }

const Dialog = Object.assign(
	Component.Builder((): Dialog => {
		const opened = State(false)
		const willOpen = State(false)
		const willClose = State(false)
		let modal = true

		let unbind: State.Unsubscribe | undefined
		const dialog = Component('dialog')
			.addStyleTargets(DialogStyleTargets)

		const style = dialog.styleTargets

		dialog.style(style.Dialog)
			.style.bind(opened, style.Dialog_Open)

		return dialog.extend<DialogExtensions>(dialog => ({
			opened,
			willClose,
			willOpen,
			setNotModal: (notModal = true) => {
				modal = !notModal
				dialog.style.toggleProperty(notModal, 'position', 'fixed')
				dialog.style.toggleProperty(notModal, 'inset', 'auto')
				dialog.style.toggleProperty(notModal, 'z-index', '99999999999')
				return dialog
			},
			setFullscreen: (fullscreen = true) => {
				dialog.style.toggleProperty(fullscreen, 'width', '100%')
				dialog.style.toggleProperty(fullscreen, 'height', '100%')
				dialog.style.toggleProperty(fullscreen, 'inset', '0')
				return dialog
			},

			open: () => {
				willOpen.value = true
				if (!dialog.willOpen.value)
					return dialog

				unbind?.()
				addOpenDialog(dialog)
				dialog.element[modal ? 'showModal' : 'show']()
				opened.value = true
				willOpen.value = false
				return dialog
			},
			close: () => {
				willClose.value = true
				if (!dialog.willClose.value)
					return dialog

				unbind?.()
				removeOpenDialog(dialog)
				dialog.element.close()
				opened.value = false
				willClose.value = false
				return dialog
			},
			toggle: (open = !dialog.opened.value) => {
				const willChangeStateName = open ? 'willOpen' : 'willClose'
				dialog[willChangeStateName].asMutable?.setValue(true)
				if (!dialog[willChangeStateName].value)
					return dialog

				unbind?.()
				if (open) {
					addOpenDialog(dialog)
					dialog.element[modal ? 'showModal' : 'show']()
				}
				else {
					removeOpenDialog(dialog)
					dialog.element.close()
				}

				opened.value = open ?? !opened.value
				dialog[willChangeStateName].asMutable?.setValue(false)
				return dialog
			},
			bind: state => {
				unbind?.()
				unbind = state.use(dialog, open => {
					const willChangeStateName = open ? 'willOpen' : 'willClose'
					dialog[willChangeStateName].asMutable?.setValue(true)

					if (open) {
						addOpenDialog(dialog)
						dialog.element[modal ? 'showModal' : 'show']()
					}
					else {
						removeOpenDialog(dialog)
						dialog.element.close()
					}

					opened.value = open
					dialog[willChangeStateName].asMutable?.setValue(false)
				})
				return dialog
			},
			unbind: () => {
				unbind?.()
				return dialog
			},
		}))
	}),
	{
		await (dialog: Dialog) {
			let remove = false
			if (!dialog.rooted.value) {
				remove = true
				dialog.appendTo(document.body)
			}

			return new Promise<void>(resolve => {
				dialog.open()
				dialog.event.subscribe('close', event => {
					event.host.event.subscribe('transitionend', () => {
						if (remove)
							dialog.remove()

						resolve()
					})
				})
			})
		},
		forceCloseAll () {
			for (const dialog of OPEN_DIALOGS)
				dialog.close()
		},
	}
)
export default Dialog
