import { AppError } from './base.error';

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitError extends AppError {
  constructor(
    message: string,
    public readonly retryAfterSeconds?: number,
    details?: unknown
  ) {
    const detailObject = details && typeof details === 'object' ? details as Record<string, unknown> : {};
    super(message, 429, 'RATE_LIMIT_ERROR', { retryAfterSeconds, ...detailObject });
  }
}
