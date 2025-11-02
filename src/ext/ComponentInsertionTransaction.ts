import type Component from 'Component'
import type { ComponentInsertionDestination } from 'Component'
import type { Mutable } from 'utility/Objects'
import State from 'utility/State'

interface ComponentInsertionTransaction extends ComponentInsertionDestination {
	readonly closed: State<boolean>
	readonly size: number
	abort (): void
	close (): void
}

function ComponentInsertionTransaction (component?: Component, onEnd?: (transaction: ComponentInsertionTransaction) => unknown): ComponentInsertionTransaction {
	let unuseComponentRemove: State.Unsubscribe | undefined = component?.removed.useManual(removed => removed && onComponentRemove())

	const closed = State(false)
	let removed = false
	const result: Mutable<ComponentInsertionTransaction> = {
		isInsertionDestination: true,
		closed,
		get size () {
			return component?.element.children.length ?? 0
		},
		append (...contents) {
			if (closed.value) {
				for (let content of contents) {
					content = content && 'component' in content ? content.component : content
					if (content && 'remove' in content)
						content.remove()
				}

				return result
			}

			component?.append(...contents)
			return result
		},
		prepend (...contents) {
			if (closed.value) {
				for (let content of contents) {
					content = content && 'component' in content ? content.component : content
					if (content && 'remove' in content)
						content.remove()
				}

				return result
			}

			component?.prepend(...contents)
			return result
		},
		insert (direction, sibling, ...contents) {
			if (closed.value) {
				for (let content of contents) {
					content = content && 'component' in content ? content.component : content
					if (content && 'remove' in content)
						content.remove()
				}

				return result
			}

			component?.insert(direction, sibling, ...contents)
			return result
		},
		abort () {
			if (closed.value)
				return

			close()
		},
		close () {
			if (closed.value)
				return

			if (!removed)
				onEnd?.(result)

			close()
		},
	}

	return result

	function close () {
		closed.value = true
		unuseComponentRemove?.(); unuseComponentRemove = undefined
		component?.removeContents()
		component = undefined
	}

	function onComponentRemove () {
		unuseComponentRemove?.(); unuseComponentRemove = undefined
		removed = true
		result.close()
	}
}

export default ComponentInsertionTransaction
