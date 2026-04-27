import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Tiny imperative async-call wrapper. Tracks pending + error state and ignores
 * results when the component unmounts mid-flight.
 */
export const useAsyncAction = <Args extends unknown[], T>(
	fn: (...args: Args) => Promise<T>
) => {
	const [isPending, setPending] = useState(false)
	const [error, setError] = useState<unknown>(null)
	const alive = useRef(true)

	useEffect(
		() => () => {
			alive.current = false
		},
		[]
	)

	const run = useCallback(
		async (...args: Args): Promise<T | undefined> => {
			setPending(true)
			setError(null)
			try {
				const value = await fn(...args)
				if (alive.current) setPending(false)
				return value
			} catch (errorLike) {
				if (alive.current) {
					setError(errorLike)
					setPending(false)
				}
				return undefined
			}
		},
		[fn]
	)

	return { isPending, error, run }
}
