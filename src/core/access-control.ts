import type {
	AccessControl,
	SecurityAvailability,
} from '../sensitive-info.nitro'
import { getSupportedSecurityLevels } from './storage'

/**
 * Pure mapping table: which capability does each {@link AccessControl} policy require?
 *
 * Kept as a `const` literal lookup (not a `switch`, not a `Map`) so the minifier can constant-fold
 * it and dead-code-eliminate unused branches. Internal helper — not exported from the public API.
 *
 * @internal
 */
const POLICY_PREDICATES: {
	readonly [P in AccessControl]: (levels: SecurityAvailability) => boolean
} = {
	secureEnclaveBiometry: (l) =>
		(l.secureEnclave || l.strongBox) && l.biometryStatus === 'available',
	biometryCurrentSet: (l) => l.biometryStatus === 'available',
	biometryAny: (l) => l.biometryStatus === 'available',
	devicePasscode: (l) => l.deviceCredential,
	none: () => true,
}

/**
 * Synchronous variant of {@link canUseAccessControl} for callers that already hold a
 * {@link SecurityAvailability} snapshot (e.g. inside a render that consumes
 * {@link useSecurityAvailability}).
 *
 * Pure function — no native call, no IPC round-trip. Safe to call inside React render paths.
 *
 * @param policy - The {@link AccessControl} policy you intend to write with.
 * @param levels - Capability snapshot, typically from {@link getSupportedSecurityLevels} or
 *   {@link useSecurityAvailability}.
 * @returns `true` when the device currently satisfies the policy's requirements; `false` when a
 *   write would fail or be silently downgraded.
 *
 * @example
 * ```tsx
 * const { data: caps } = useSecurityAvailability()
 * const canEnable = caps ? canUseAccessControlSync('secureEnclaveBiometry', caps) : false
 * return <Toggle disabled={!canEnable} />
 * ```
 *
 * @see {@link canUseAccessControl}
 * @public
 */
export function canUseAccessControlSync(
	policy: AccessControl,
	levels: SecurityAvailability
): boolean {
	return POLICY_PREDICATES[policy](levels)
}

/**
 * Predicts whether a given {@link AccessControl} policy can be satisfied on the current device
 * **right now** — useful for gating biometric toggles before attempting a write that would
 * otherwise fail or be silently downgraded.
 *
 * Internally maps the requested policy onto the {@link SecurityAvailability} snapshot returned by
 * {@link getSupportedSecurityLevels}. Pass `levels` to skip the native round-trip.
 *
 * @param policy - The {@link AccessControl} policy you intend to write with.
 * @param levels - Optional pre-fetched capability snapshot. When omitted, the helper calls
 *   {@link getSupportedSecurityLevels} internally.
 * @returns Resolves to `true` when the policy can be applied, `false` otherwise. Resolves to
 *   `false` (rather than throwing) for `'unknown'` biometry status — gate UI off availability
 *   instead.
 *
 * @remarks
 * This is a *predictive* check, not a guarantee — the user could change biometric settings
 * between this call and the subsequent write. Always handle {@link KeyInvalidatedError} and
 * {@link AuthenticationCanceledError} on the write path as well.
 *
 * @example
 * ```ts
 * if (await canUseAccessControl('secureEnclaveBiometry')) {
 *   await setItem('session', token, { accessControl: 'secureEnclaveBiometry' })
 * } else {
 *   await setItem('session', token, { accessControl: 'devicePasscode' })
 * }
 * ```
 *
 * @see {@link canUseAccessControlSync}
 * @see {@link getSupportedSecurityLevels}
 * @public
 */
export async function canUseAccessControl(
	policy: AccessControl,
	levels?: SecurityAvailability
): Promise<boolean> {
	const snapshot = levels ?? (await getSupportedSecurityLevels())
	return canUseAccessControlSync(policy, snapshot)
}
