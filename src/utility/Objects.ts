export type Mutable<T> = { -readonly [KEY in keyof T]: T[KEY] }
export const mutable = <T> (value: T): Mutable<T> => value as Mutable<T>

export const DefineProperty = <O, K extends string & keyof O> (obj: O, key: K, value: O[K]): O[K] => {
	try {
		Object.defineProperty(obj, key, {
			configurable: true,
			writable: true,
			value,
		})
	}
	catch { }

	return value
}
export interface MagicDefinition<O, K extends string & keyof O> {
	get (this: O): O[K]
	set?(this: O, value: O[K]): void
}
export const DefineMagic = <O, K extends string & keyof O> (obj: O, key: K, definition: MagicDefinition<O, K>): void => {
	try {
		Object.defineProperty(obj, key, {
			configurable: true,
			...definition,
		})
	}
	catch { }
}

namespace Objects {

}

export default Objects
