import { AppError } from './base.error';

/**
 * Error thrown when AI provider API call fails
 */
export class AIProviderError extends AppError {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly originalError?: Error,
    details?: unknown
  ) {
    const detailObject = details && typeof details === 'object' ? details as Record<string, unknown> : {};
    super(message, 502, 'AI_PROVIDER_ERROR', { provider, originalError: originalError?.message, ...detailObject });
  }
}

/**
 * Error thrown when AI provider returns invalid response
 */
export class AIResponseError extends AppError {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly response?: unknown
  ) {
    super(message, 502, 'AI_RESPONSE_ERROR', { provider, response });
  }
}

/**
 * Error thrown when API credentials are invalid or missing
 */
export class InvalidCredentialsError extends AppError {
  constructor(
    message: string,
    public readonly provider: string
  ) {
    super(message, 401, 'INVALID_CREDENTIALS', { provider });
  }
}
