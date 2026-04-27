import { useCallback, useMemo } from 'react'
import type { SensitiveInfoOptions } from '../sensitive-info.nitro'
import useAsync, { type UseAsyncResult } from './useAsync'
import useStableOptions from './useStableOptions'

/**
 * Shared "stable options → strip skip → memoize → useAsync" recipe used by every parameterized
 * data-fetching hook. Keeps `useHasSecret`/`useSecretItem` (and friends) down to a single call
 * site and ensures the abort/skip semantics stay consistent across the public surface.
 *
 * @internal
 */
const useAsyncQuery = <T, O extends { readonly skip?: boolean }>(
	runner: (request: SensitiveInfoOptions) => Promise<T | null>,
	defaults: Required<Pick<O, 'skip'>> & Partial<Omit<O, 'skip'>>,
	operation: string,
	options: O | undefined,
	hint?: string
): UseAsyncResult<T> => {
	const stable = useStableOptions<O>(defaults as Partial<O>, options)
	const { skip } = stable

	const requestOptions = useMemo<SensitiveInfoOptions>(() => {
		const { skip: _skip, ...rest } = stable
		return rest as SensitiveInfoOptions
	}, [stable])

	const run = useCallback(
		() => runner(requestOptions),
		[runner, requestOptions]
	)

	return useAsync<T>(run, operation, { skip, hint })
}

export default useAsyncQuery
