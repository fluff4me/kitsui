interface Timeout {
	id: number
	until: number
	cb: () => unknown
}
namespace Timeout {
	const timeouts: Timeout[] = []

	// function validateTimeouts () {
	// 	let i = 0
	// 	for (i; i < timeouts.length && timeouts[i].until !== 0; i++)
	// 		// traverse active timeouts
	// 		continue

	// 	for (i; i < timeouts.length; i++)
	// 		// traverse reusable timeouts
	// 		if (timeouts[i].until !== 0)
	// 			throw new Error('Active timeout found after reusable timeouts')
	// }

	const rAF = self.requestAnimationFrame ?? (cb => self.setTimeout(cb, 10))
	process()
	function process () {
		const now = Date.now()

		let firstRealTimeoutIndex: number | undefined
		let cbsToRun: (() => unknown)[] = []
		for (let i = timeouts.length - 1; i >= 0; i--) {
			if (Date.now() - now > 10)
				// prevent blocking the main thread for too long
				break

			const timeout = timeouts[i]
			if (timeout.until === 0)
				// timeouts with until = 0 are held for reuse
				continue

			if (timeout.until > now) {
				firstRealTimeoutIndex ??= i
				continue
			}

			// this timeout is ready to run
			cbsToRun ??= []
			cbsToRun.push(timeout.cb)
			firstRealTimeoutIndex = unuseTimeout(i, firstRealTimeoutIndex)
		}

		for (const cb of cbsToRun)
			try {
				cb()
			}
			catch (e) {
				console.error('Error in Timeout callback:', e)
			}

		rAF(process)
	}

	function unuseTimeout (index: number, firstRealTimeoutIndex: number | undefined) {
		const timeout = timeouts[index]
		timeout.id = 0
		timeout.until = 0
		timeout.cb = undefined!

		if (firstRealTimeoutIndex === undefined) {
			// if it's undefined, this *was* the first real timeout, so no point in moving it
			// validateTimeouts()
			return index - 1
		}

		// swap with firstRealTimeoutIndex
		timeouts[index] = timeouts[firstRealTimeoutIndex]
		timeouts[firstRealTimeoutIndex] = timeout
		// validateTimeouts()

		// move firstRealTimeoutIndex forward since it's pointing to a completed timeout now
		return firstRealTimeoutIndex - 1
	}

	let nextTimeoutId = 1
	export function set (cb: () => unknown, ms: number): number {
		for (const timeout of timeouts) {
			if (timeout.until !== 0)
				continue

			// completed timeout object, reuse it
			timeout.id = nextTimeoutId++
			timeout.until = Date.now() + ms
			timeout.cb = cb
			// validateTimeouts()
			return timeout.id
		}

		const timeout: Timeout = {
			id: nextTimeoutId++,
			until: Date.now() + ms,
			cb,
		}
		timeouts.unshift(timeout)
		// validateTimeouts()
		return timeout.id
	}

	export function clear (id?: number) {
		if (!id || !(id > 0))
			return

		let firstRealTimeoutIndex: number | undefined
		for (let i = timeouts.length - 1; i >= 0; i--) {
			const timeout = timeouts[i]
			if (timeout.until === 0)
				continue

			firstRealTimeoutIndex ??= i

			if (timeout.id !== id)
				continue

			// found it, mark as completed
			firstRealTimeoutIndex = unuseTimeout(i, firstRealTimeoutIndex)
		}
	}
}

export default Timeout
