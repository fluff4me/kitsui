export type SupplierOr<T, A extends any[] = []> = T | ((...args: A) => T)
export type AnyFunction<R = any> = (...args: any[]) => R

namespace Functions {

	export const NO_OP = () => { }

	export function resolve<ARGS extends any[], RETURN> (fn: SupplierOr<RETURN, ARGS>, ...args: ARGS): RETURN {
		return typeof fn === 'function' ? (fn as (...args: ARGS) => RETURN)(...args) : fn
	}

	export function throwing (message: string): () => never {
		return () => {
			throw new Error(message)
		}
	}
}

export default Functions
