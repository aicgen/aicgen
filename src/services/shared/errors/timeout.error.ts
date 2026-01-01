import { AppError } from './base.error';

/**
 * Error thrown when an operation times out
 */
export class TimeoutError extends AppError {
  constructor(
    message: string,
    public readonly timeoutMs: number,
    details?: unknown
  ) {
    super(message, 408, 'TIMEOUT_ERROR', { timeoutMs, ...details });
  }
}
