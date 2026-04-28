import type {
	SensitiveInfoItem,
	StorageMetadata,
} from '../../sensitive-info.nitro'

type MetadataOverrides = Partial<StorageMetadata>

/**
 * Builds a deterministic `StorageMetadata` for tests. Override any field by passing it in.
 *
 * @internal
 */
export const buildTestMetadata = (
	overrides: MetadataOverrides = {}
): StorageMetadata => ({
	securityLevel: 'secureEnclave',
	backend: 'keychain',
	accessControl: 'secureEnclaveBiometry',
	timestamp: 1,
	...overrides,
})

/**
 * Builds a deterministic `SensitiveInfoItem`. `metadata` overrides flow through to
 * {@link buildTestMetadata}; top-level fields override the item shell.
 *
 * @internal
 */
export const buildTestItem = (
	overrides: Partial<Omit<SensitiveInfoItem, 'metadata'>> & {
		readonly metadata?: MetadataOverrides
	} = {}
): SensitiveInfoItem => {
	const { metadata, ...rest } = overrides
	return {
		key: 'token',
		service: 'auth',
		...rest,
		metadata: buildTestMetadata(metadata),
	}
}
