import { AppError } from './base.error.js';

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
    super(message, 502, 'AI_PROVIDER_ERROR', { provider, originalError: originalError?.message, ...details });
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
