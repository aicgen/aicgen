import { TimeoutError } from '../errors/index';

/**
 * Execute an async operation with a timeout
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   () => fetch('https://slow-api.com'),
 *   5000 // 5 second timeout
 * );
 * ```
 *
 * @param operation - Async function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Custom error message
 * @returns Promise that resolves with operation result or rejects with TimeoutError
 * @throws TimeoutError if operation takes longer than timeoutMs
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    // Create timeout
    const timeoutId = setTimeout(() => {
      reject(new TimeoutError(
        errorMessage ?? `Operation timed out after ${timeoutMs}ms`,
        timeoutMs
      ));
    }, timeoutMs);

    // Execute operation
    operation()
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Create a reusable timeout wrapper with preset timeout
 *
 * @example
 * ```typescript
 * const with30SecTimeout = createTimeoutWrapper(30000);
 * const result = await with30SecTimeout(() => longOperation());
 * ```
 */
export function createTimeoutWrapper(timeoutMs: number, errorMessage?: string) {
  return <T>(operation: () => Promise<T>): Promise<T> => {
    return withTimeout(operation, timeoutMs, errorMessage);
  };
}

/**
 * Execute an async operation with AbortController for cancelable fetch
 *
 * @example
 * ```typescript
 * const result = await withAbortTimeout(
 *   (signal) => fetch('https://api.com', { signal }),
 *   5000
 * );
 * ```
 *
 * @param operation - Async function that accepts AbortSignal
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise that resolves with operation result or rejects with TimeoutError
 */
export async function withAbortTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const result = await operation(controller.signal);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);

    if (
      (error instanceof Error && error.name === 'AbortError') ||
      (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError')
    ) {
      throw new TimeoutError(
        `Operation aborted after ${timeoutMs}ms`,
        timeoutMs
      );
    }

    throw error;
  }
}
