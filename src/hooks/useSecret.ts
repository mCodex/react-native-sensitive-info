import { useCallback } from 'react'
import type {
  SensitiveInfoItem,
  SensitiveInfoOptions,
} from '../sensitive-info.nitro'
import { deleteItem, setItem } from '../core/storage'
import {
  createHookFailureResult,
  createHookSuccessResult,
  type HookMutationResult,
  type AsyncState,
} from './types'
import { useSecretItem, type UseSecretItemOptions } from './useSecretItem'
import createHookError from './error-utils'

/**
 * Configuration object for {@link useSecret}.
 * Combines the read options from {@link useSecretItem} with mutation convenience flags.
 */
export type UseSecretOptions = UseSecretItemOptions

/**
 * Result bag returned by {@link useSecret}.
 */
export interface UseSecretResult extends AsyncState<SensitiveInfoItem> {
  readonly saveSecret: (value: string) => Promise<HookMutationResult>
  readonly deleteSecret: () => Promise<HookMutationResult>
  readonly refetch: () => Promise<void>
}

/**
 * Removes hook-specific flags before delegating to the storage module.
 */
const normalizeMutationOptions = (
  options?: UseSecretOptions
): SensitiveInfoOptions | undefined => {
  if (!options) return undefined
  const { skip: _skip, includeValue: _includeValue, ...core } = options
  return core as SensitiveInfoOptions
}

/**
 * Maintains a secure item while exposing imperative helpers to mutate or refresh it.
 *
 * @example
 * ```tsx
 * const secret = useSecret('refreshToken', { service: 'com.example.session' })
 * ```
 */
export function useSecret(
  key: string,
  options?: UseSecretOptions
): UseSecretResult {
  const { data, error, isLoading, isPending, refetch } = useSecretItem(
    key,
    options
  )

  const saveSecret = useCallback(
    async (value: string) => {
      try {
        await setItem(key, value, normalizeMutationOptions(options))
        await refetch()
        return createHookSuccessResult()
      } catch (errorLike) {
        const hookError = createHookError(
          'useSecret.saveSecret',
          errorLike,
          'Check the access control requirements for this key.'
        )
        return createHookFailureResult(hookError)
      }
    },
    [key, options, refetch]
  )

  const deleteSecret = useCallback(async () => {
    try {
      await deleteItem(key, normalizeMutationOptions(options))
      await refetch()
      return createHookSuccessResult()
    } catch (errorLike) {
      const hookError = createHookError(
        'useSecret.deleteSecret',
        errorLike,
        'Ensure the user completed biometric prompts or that the key is spelled correctly.'
      )
      return createHookFailureResult(hookError)
    }
  }, [key, options, refetch])

  return {
    data,
    error,
    isLoading,
    isPending,
    saveSecret,
    deleteSecret,
    refetch,
  }
}
