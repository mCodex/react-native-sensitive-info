import { useCallback, useEffect, useRef } from 'react'
import type { RefObject } from 'react'

export interface AsyncLifecycleControls {
  /**
   * Indicates whether the component that owns the hook is still mounted. Helpful when dispatching asynchronous state updates.
   */
  readonly mountedRef: RefObject<boolean>
  /**
   * Stores the last {@link AbortController} created by {@link begin}. Exposed for advanced scenarios such as manual cancellation.
   */
  readonly controllerRef: RefObject<AbortController | null>
  /**
   * Aborts the previous async job (if any) and returns a fresh {@link AbortController} tied to the current execution flow.
   */
  begin: () => AbortController
}

/**
 * Tracks the mounting lifecycle of a component and guarantees that asynchronous callbacks always respect the latest state.
 * The helper transparently aborts in-flight requests when a new run starts or the component unmounts, preventing subtle memory leaks.
 *
 * @example
 * ```tsx
 * const { begin, mountedRef } = useAsyncLifecycle()
 *
 * const fetchProfile = async () => {
 *   const controller = begin()
 *   const profile = await api.loadProfile({ signal: controller.signal })
 *   if (mountedRef.current && !controller.signal.aborted) {
 *     setProfile(profile)
 *   }
 * }
 * ```
 */
const useAsyncLifecycle = (): AsyncLifecycleControls => {
  const mountedRef = useRef(true)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      mountedRef.current = false
      controllerRef.current?.abort()
    },
    []
  )

  const begin = useCallback(() => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    return controller
  }, [])

  return {
    mountedRef,
    controllerRef,
    begin,
  }
}

export default useAsyncLifecycle
