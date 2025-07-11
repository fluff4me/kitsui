export type UUID = `${string}-${string}-${string}-${string}-${string}`

namespace Strings {
	/** 
	 * Generates a unique string valid for an ID on an element, in the format `_<base 36 timestamp><base 36 random number>`  
	 * For example: `_m6rpr4mo02bw589br2ze`
	 */
	export function uid () {
		return `_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
	}

	export function simplify (string: string) {
		return string.toLowerCase()
			.replace(/\W+/g, ' ')
	}

	export function areSameWords (a?: string, b?: string) {
		return a === undefined || b === undefined ? false
			: simplify(a) === simplify(b)
	}

	export type Replace<STRING extends string, MATCH extends string, REPLACE extends string> =
		STRING extends `${infer A}${MATCH}${infer B}` ? `${Replace<A, MATCH, REPLACE>}${REPLACE}${Replace<B, MATCH, REPLACE>}` : STRING

	export function includesAt (string: string, substring: string, index: number) {
		if (index < 0)
			index = string.length + index

		if (index + substring.length > string.length)
			return false

		for (let i = 0; i < substring.length; i++)
			if (string[i + index] !== substring[i])
				return false

		return true
	}

	export function splitOnce (string: string, separator: string) {
		const index = string.indexOf(separator)
		if (index === -1)
			return [string]

		return [string.slice(0, index), string.slice(index + separator.length)]
	}

	export function sliceTo (string: string, substring: string, startAt?: number) {
		const index = string.indexOf(substring, startAt)
		if (index === -1)
			return string

		return string.slice(0, index)
	}

	export function sliceAfter (string: string, substring: string, startAt?: number) {
		const index = string.indexOf(substring, startAt)
		if (index === -1)
			return string

		return string.slice(index + substring.length)
	}

	export function trimTextMatchingFromStart (string: string, substring: string, startAt?: number) {
		if (string.length < substring.length)
			return string

		const index = string.indexOf(substring, startAt)
		if (index !== 0)
			return string

		return string.slice(index + substring.length)
	}

	export function trimTextMatchingFromEnd (string: string, substring: string, startAt?: number) {
		if (string.length < substring.length)
			return string

		const index = string.lastIndexOf(substring, startAt)
		if (index !== string.length - substring.length)
			return string

		return string.slice(0, index)
	}

	export function extractFromQuotes (string?: string | null) {
		let substring = (string ?? '').trim()
		if (substring[0] === '"')
			substring = substring.slice(1)
		if (substring[substring.length - 1] === '"')
			substring = substring.slice(0, -1)

		return substring.trim()
	}

	export function extractFromSquareBrackets (string?: string | null) {
		let substring = (string ?? '')
		if (substring[0] === '[')
			substring = substring.slice(1).trimStart()
		if (substring[substring.length - 1] === ']')
			substring = substring.slice(0, -1).trimEnd()

		return substring
	}

	export function mergeRegularExpressions (flags: string, ...expressions: RegExp[]) {
		let exprString = ''
		for (const expr of expressions)
			exprString += '|' + expr.source

		return new RegExp(exprString.slice(1), flags)
	}

	export function count (string: string, substring: string, stopAtCount = Infinity) {
		let count = 0
		let lastIndex = -1
		while (count < stopAtCount) {
			const index = string.indexOf(substring, lastIndex + 1)
			if (index === -1)
				return count

			count++
			lastIndex = index
		}

		return count
	}

	export function includesOnce (string: string, substring: string) {
		return count(string, substring, 2) === 1
	}

	export function getVariations (name: string) {
		const variations = [name]
		variations.push(name + 'd', name + 'ed')

		if (name.endsWith('d'))
			variations.push(...getVariations(name.slice(0, -1)))

		if (name.endsWith('ed'))
			variations.push(...getVariations(name.slice(0, -2)))

		if (name.endsWith('ing')) {
			variations.push(name.slice(0, -3))
			if (name[name.length - 4] === name[name.length - 5])
				variations.push(name.slice(0, -4))
		}
		else {
			variations.push(name + 'ing', name + name[name.length - 1] + 'ing')
			if (name.endsWith('y'))
				variations.push(name.slice(0, -1) + 'ing')
		}

		if (name.endsWith('ion')) {
			variations.push(...getVariations(name.slice(0, -3)))
			if (name[name.length - 4] === name[name.length - 5])
				variations.push(name.slice(0, -4))
		}
		else
			variations.push(name + 'ion')

		if (name.endsWith('er'))
			variations.push(name.slice(0, -1), name.slice(0, -2))
		else {
			variations.push(name + 'r', name + 'er')
			if (name.endsWith('y'))
				variations.push(name.slice(0, -1) + 'ier')
		}

		if (name.endsWith('ier'))
			variations.push(name.slice(0, -3) + 'y')

		variations.push(name + 's', name + 'es')
		if (name.endsWith('s'))
			variations.push(name.slice(0, -1))
		else {
			if (name.endsWith('y'))
				variations.push(name.slice(0, -1) + 'ies')
		}

		return variations
	}

	export function shiftLine (lines: string, count = 1) {
		for (let i = 0; i < count; i++) {
			const index = lines.indexOf('\n')
			if (index === -1)
				return lines

			lines = lines.slice(index + 1)
		}
		return lines
	}

}

export default Strings
