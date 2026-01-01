import { AppError } from './base.error';

/**
 * Error thrown when validation fails
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly field?: string,
    details?: unknown
  ) {
    super(message, 400, 'VALIDATION_ERROR', { field, ...details });
  }
}

/**
 * Multiple validation errors
 */
export class ValidationErrors extends AppError {
  constructor(
    public readonly errors: Array<{ field: string; message: string }>
  ) {
    super(
      `Validation failed: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`,
      400,
      'VALIDATION_ERRORS',
      { errors }
    );
  }
}
