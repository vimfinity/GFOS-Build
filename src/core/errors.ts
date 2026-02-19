export type ErrorCode =
  | 'USAGE_INVALID_COMMAND'
  | 'USAGE_INVALID_PIPELINE_ACTION'
  | 'CONFIG_INVALID'
  | 'PIPELINE_INVALID'
  | 'PIPELINE_FILE_NOT_FOUND'
  | 'DISCOVERY_FAILED'
  | 'BUILD_FAILED'
  | 'UNKNOWN';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, string | number | boolean>
  ) {
    super(message);
    this.name = 'AppError';
  }
}
