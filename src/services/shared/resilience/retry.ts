import { RateLimitError, TimeoutError } from '../errors/index';

/**
 * Backoff strategy for retries
 */
export type BackoffStrategy = 'fixed' | 'exponential' | 'linear';

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxAttempts?: number;

  /**
   * Initial delay in milliseconds before first retry
   * @default 1000
   */
  initialDelayMs?: number;

  /**
   * Maximum delay in milliseconds between retries
   * @default 30000
   */
  maxDelayMs?: number;

  /**
   * Backoff strategy to use
   * @default 'exponential'
   */
  backoff?: BackoffStrategy;

  /**
   * Function to determine if error is retryable
   * @default retries all errors except RateLimitError and TimeoutError
   */
  isRetryable?: (error: Error) => boolean;

  /**
   * Callback invoked before each retry attempt
   */
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

/**
 * Default retry configuration
 */
const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoff: 'exponential',
  isRetryable: (error: Error) => {
    // Don't retry rate limit errors (need to wait)
    if (error instanceof RateLimitError) return false;
    // Don't retry timeout errors (won't help)
    if (error instanceof TimeoutError) return false;
    // Retry all other errors (network failures, temporary issues)
    return true;
  },
  onRetry: () => { /* no-op */ }
};

/**
 * Calculate delay for retry attempt based on backoff strategy
 */
function calculateDelay(
  attempt: number,
  config: Required<RetryConfig>
): number {
  let delay: number;

  switch (config.backoff) {
    case 'fixed':
      delay = config.initialDelayMs;
      break;

    case 'linear':
      delay = config.initialDelayMs * attempt;
      break;

    case 'exponential':
    default:
      delay = config.initialDelayMs * Math.pow(2, attempt - 1);
      break;
  }

  // Add jitter (±25%) to prevent thundering herd
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  delay = Math.round(delay + jitter);

  // Cap at max delay
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 *
 * @example
 * ```typescript
 * const result = await retry(
 *   () => fetch('https://api.example.com/data'),
 *   { maxAttempts: 3, backoff: 'exponential' }
 * );
 * ```
 *
 * @param operation - Async function to retry
 * @param config - Retry configuration
 * @returns Promise that resolves with operation result or rejects with last error
 */
export async function retry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const finalConfig: Required<RetryConfig> = {
    ...DEFAULT_CONFIG,
    ...config
  };

  let lastError: Error;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      if (!finalConfig.isRetryable(lastError)) {
        throw lastError;
      }

      // If this was the last attempt, throw
      if (attempt >= finalConfig.maxAttempts) {
        throw lastError;
      }

      // Calculate delay and wait
      const delayMs = calculateDelay(attempt, finalConfig);
      finalConfig.onRetry(attempt, lastError, delayMs);
      await sleep(delayMs);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError!;
}

/**
 * Create a reusable retry function with preset configuration
 *
 * @example
 * ```typescript
 * const retryWithBackoff = createRetrier({ maxAttempts: 5, backoff: 'exponential' });
 * const result = await retryWithBackoff(() => apiCall());
 * ```
 */
export function createRetrier(config: RetryConfig) {
  return <T>(operation: () => Promise<T>): Promise<T> => {
    return retry(operation, config);
  };
}
