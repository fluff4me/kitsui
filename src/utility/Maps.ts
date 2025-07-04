namespace Maps {
	export function compute<K, V> (map: Map<K, V>, key: K, computer: (key: K) => V): V {
		const value = map.get(key)
		if (value === undefined)
			return computer(key)
		return value
	}
}

export default Maps
