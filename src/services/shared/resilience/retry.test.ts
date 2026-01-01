import { retry, createRetrier } from './retry.js';
import { RateLimitError, TimeoutError } from '../errors/index.js';

describe('Retry Logic', () => {
  describe('retry()', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await retry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce('success');

      const result = await retry(operation, { maxAttempts: 3, initialDelayMs: 10 });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw after max attempts exceeded', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent failure'));

      await expect(
        retry(operation, { maxAttempts: 3, initialDelayMs: 10 })
      ).rejects.toThrow('Persistent failure');

      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry RateLimitError', async () => {
      const operation = jest.fn().mockRejectedValue(new RateLimitError('Rate limited'));

      await expect(
        retry(operation, { maxAttempts: 3, initialDelayMs: 10 })
      ).rejects.toThrow('Rate limited');

      expect(operation).toHaveBeenCalledTimes(1); // No retries
    });

    it('should not retry TimeoutError', async () => {
      const operation = jest.fn().mockRejectedValue(new TimeoutError('Timed out', 5000));

      await expect(
        retry(operation, { maxAttempts: 3, initialDelayMs: 10 })
      ).rejects.toThrow('Timed out');

      expect(operation).toHaveBeenCalledTimes(1); // No retries
    });

    it('should call onRetry callback', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockResolvedValueOnce('success');

      const onRetry = jest.fn();

      await retry(operation, {
        maxAttempts: 2,
        initialDelayMs: 10,
        onRetry
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        1, // attempt number
        expect.any(Error), // error
        expect.any(Number) // delay
      );
    });

    it('should use custom isRetryable function', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Custom error'));

      const isRetryable = jest.fn().mockReturnValue(false);

      await expect(
        retry(operation, { maxAttempts: 3, isRetryable, initialDelayMs: 10 })
      ).rejects.toThrow('Custom error');

      expect(operation).toHaveBeenCalledTimes(1); // No retries
      expect(isRetryable).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should apply exponential backoff', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValueOnce('success');

      const delays: number[] = [];
      const onRetry = jest.fn((attempt, error, delay) => delays.push(delay));

      await retry(operation, {
        maxAttempts: 3,
        initialDelayMs: 100,
        backoff: 'exponential',
        onRetry
      });

      // Delays should be roughly 100ms, 200ms (with jitter)
      expect(delays[0]).toBeGreaterThanOrEqual(75);
      expect(delays[0]).toBeLessThanOrEqual(125);
      expect(delays[1]).toBeGreaterThanOrEqual(150);
      expect(delays[1]).toBeLessThanOrEqual(250);
    });
  });

  describe('createRetrier()', () => {
    it('should create reusable retrier with preset config', async () => {
      const retrier = createRetrier({ maxAttempts: 2, initialDelayMs: 10 });

      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Failure'))
        .mockResolvedValueOnce('success');

      const result = await retrier(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });
});
