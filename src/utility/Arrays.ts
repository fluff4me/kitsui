import type { Falsy } from 'utility/Type'

export const NonNullish = <T> (value: T | null | undefined): value is T => value !== null && value !== undefined
export const Truthy = <T> (value: T): value is Exclude<T, Falsy> => Boolean(value)

namespace Arrays {

	export type Or<T> = T | T[]
	export type ReadonlyOr<T> = T | readonly T[]

	export function resolve<T> (value: Or<T>): T[] {
		return Array.isArray(value) ? value : [value]
	}

	export const filterInPlace = <T> (array: T[], predicate: (value: T, index: number, array: T[]) => boolean): T[] => {
		let readCursor = 0
		let writeCursor = 0
		while (readCursor < array.length) {
			const value = array[readCursor++]
			if (predicate(value, readCursor - 1, array))
				array[writeCursor++] = value
		}

		array.length = writeCursor
		return array
	}
	export const distinctInPlace = <T> (array: T[], mapper?: (value: T) => unknown): T[] => {
		const encountered: unknown[] = []

		let readCursor = 0
		let writeCursor = 0
		while (readCursor < array.length) {
			const value = array[readCursor++]
			const encounterValue = mapper ? mapper(value) : value
			if (encountered.includes(encounterValue))
				continue

			encountered.push(encounterValue)
			array[writeCursor++] = value
		}

		array.length = writeCursor
		return array
	}

}

export default Arrays
