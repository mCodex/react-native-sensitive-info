import { useEffect, useRef } from 'react'
import type { BiometryStatus } from '../sensitive-info.nitro'
import {
	type UseSecurityAvailabilityResult,
	useSecurityAvailability,
} from './useSecurityAvailability'

/**
 * Callback invoked when {@link BiometryStatus} transitions between distinct values.
 *
 * @param next - The new status reported by the native probe.
 * @param previous - The status observed on the previous render, or `null` on first detection.
 *
 * @public
 */
export type BiometryStatusChangeListener = (
	next: BiometryStatus,
	previous: BiometryStatus | null
) => void

/**
 * Result returned by {@link useBiometryStatusWatcher}.
 *
 * Re-exposes the underlying {@link UseSecurityAvailabilityResult} so callers can render UI off
 * the same snapshot without composing two hooks.
 *
 * @public
 */
export type UseBiometryStatusWatcherResult = UseSecurityAvailabilityResult

/**
 * Subscribes to biometric availability and fires `onChange` **only** when
 * {@link BiometryStatus} actually transitions.
 *
 * Internally wraps {@link useSecurityAvailability} with `refreshOnForeground: true`, so the
 * status is re-probed whenever the app returns to foreground. The callback is invoked only on
 * real transitions (e.g. `'notEnrolled'` → `'available'` after the user enrolls a fingerprint),
 * never on every render or refetch.
 *
 * Lives in its own module so apps that don't watch enrollment changes don't pay for it (Metro /
 * Webpack tree-shaking via `sideEffects: false`).
 *
 * @param onChange - Listener invoked on each status transition. Stable across renders is
 *   recommended (e.g. `useCallback`) — the watcher captures the latest reference automatically.
 * @returns The same {@link UseSecurityAvailabilityResult} you'd get from
 *   {@link useSecurityAvailability}, so you can render UI without composing two hooks.
 *
 * @example
 * ```tsx
 * useBiometryStatusWatcher((next, prev) => {
 *   analytics.track('biometry_status_changed', { from: prev, to: next })
 *   if (next === 'available' && prev === 'notEnrolled') showToast('Face ID is ready.')
 * })
 * ```
 *
 * @see {@link useSecurityAvailability}
 * @see {@link BiometryStatus}
 * @public
 */
export function useBiometryStatusWatcher(
	onChange: BiometryStatusChangeListener
): UseBiometryStatusWatcherResult {
	const result = useSecurityAvailability({ refreshOnForeground: true })

	// Capture the latest listener so subscribers don't need to memoize it.
	const listenerRef = useRef(onChange)
	useEffect(() => {
		listenerRef.current = onChange
	}, [onChange])

	const previousRef = useRef<BiometryStatus | null>(null)
	const status = result.data?.biometryStatus ?? null

	useEffect(() => {
		if (status === null) return
		const previous = previousRef.current
		if (previous === status) return
		previousRef.current = status
		listenerRef.current(status, previous)
	}, [status])

	return result
}
