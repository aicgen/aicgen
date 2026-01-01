import { withTimeout, withAbortTimeout, createTimeoutWrapper } from './timeout';
import { TimeoutError } from '../errors/index';

describe('Timeout Handling', () => {
  describe('withTimeout()', () => {
    it('should resolve if operation completes within timeout', async () => {
      const operation = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'success';
      });

      const result = await withTimeout(operation, 100);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should throw TimeoutError if operation exceeds timeout', async () => {
      const operation = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return 'success';
      });

      await expect(
        withTimeout(operation, 50)
      ).rejects.toThrow(TimeoutError);

      await expect(
        withTimeout(operation, 50)
      ).rejects.toThrow('Operation timed out after 50ms');
    });

    it('should use custom error message', async () => {
      const operation = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });

      await expect(
        withTimeout(operation, 50, 'Custom timeout message')
      ).rejects.toThrow('Custom timeout message');
    });

    it('should propagate operation errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      await expect(
        withTimeout(operation, 100)
      ).rejects.toThrow('Operation failed');
    });
  });

  describe('withAbortTimeout()', () => {
    it('should resolve if operation completes within timeout', async () => {
      const operation = jest.fn().mockImplementation(async (signal: AbortSignal) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'success';
      });

      const result = await withAbortTimeout(operation, 100);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should abort and throw TimeoutError if operation exceeds timeout', async () => {
      const operation = jest.fn().mockImplementation(async (signal: AbortSignal) => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => resolve('success'), 200);
          signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      });

      await expect(
        withAbortTimeout(operation, 50)
      ).rejects.toThrow(TimeoutError);

      await expect(
        withAbortTimeout(operation, 50)
      ).rejects.toThrow('Operation aborted after 50ms');
    });

    it('should propagate non-abort errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      await expect(
        withAbortTimeout(operation, 100)
      ).rejects.toThrow('Operation failed');
    });
  });

  describe('createTimeoutWrapper()', () => {
    it('should create reusable timeout wrapper', async () => {
      const with100msTimeout = createTimeoutWrapper(100);

      const fastOperation = jest.fn().mockResolvedValue('fast');
      const slowOperation = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return 'slow';
      });

      const result = await with100msTimeout(fastOperation);
      expect(result).toBe('fast');

      await expect(
        with100msTimeout(slowOperation)
      ).rejects.toThrow(TimeoutError);
    });
  });
});
