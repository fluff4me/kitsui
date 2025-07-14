export type AbortablePromiseOr<T> = T | AbortablePromise<T>

class AbortablePromise<T> extends Promise<T> {

	#controller?: AbortController

	/**
	 * Note that `signal` is not handled for you.
	 * If you need to resolve or reject on abort, you will need to add an abort listener.
	 */
	constructor (
		executor: (
			resolve: (value: T | PromiseLike<T>) => void,
			reject: (reason?: any) => void,
			signal: AbortSignal
		) => void
	) {
		const controller = new AbortController()
		super((resolve, reject) => executor(resolve, reject, controller.signal))
		this.#controller = controller
		this.abort = this.abort.bind(this)
	}

	/**
	 * Sends an abort signal to the promise handler
	 */
	abort (): void {
		if (this.#controller?.signal.aborted)
			return

		this.#controller?.abort()
	}

}

namespace AbortablePromise {
	export function asyncFunction<A extends any[], R> (asyncFunction: (signal: AbortSignal, ...args: A) => Promise<R>): (...args: A) => AbortablePromise<R> {
		return (...args: A) => new AbortablePromise<R>((resolve, reject, signal) =>
			void asyncFunction(signal, ...args).then(resolve, reject))
	}
}

export default AbortablePromise
