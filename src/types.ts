// Common types for SensitiveInfo

export type SensitiveInfoResult<T> =
  | { value: T; error?: undefined }
  | { error: { code: string; message: string }; value?: undefined };
