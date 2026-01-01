/**
 * Log level enum
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

/**
 * Structured log entry
 */
export interface LogEntry {
  level: keyof typeof LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger interface for dependency injection
 */
export interface ILogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
  setLevel(level: LogLevel): void;
}

/**
 * Console-based structured logger
 * Outputs JSON for machine readability or pretty format for humans
 */
export class Logger implements ILogger {
  private level: LogLevel = LogLevel.INFO;
  private readonly prettyPrint: boolean;

  constructor(options?: { level?: LogLevel; prettyPrint?: boolean }) {
    this.level = options?.level ?? LogLevel.INFO;
    this.prettyPrint = options?.prettyPrint ?? process.env.NODE_ENV !== 'production';
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.level <= LogLevel.DEBUG) {
      this.log('DEBUG', message, context);
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (this.level <= LogLevel.INFO) {
      this.log('INFO', message, context);
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (this.level <= LogLevel.WARN) {
      this.log('WARN', message, context);
    }
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    if (this.level <= LogLevel.ERROR) {
      const errorInfo = error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined;

      this.log('ERROR', message, context, errorInfo);
    }
  }

  private log(
    level: keyof typeof LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: LogEntry['error']
  ): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      error
    };

    if (this.prettyPrint) {
      this.prettyLog(entry);
    } else {
      console.log(JSON.stringify(entry));
    }
  }

  private prettyLog(entry: LogEntry): void {
    const colors = {
      DEBUG: '\x1b[36m', // Cyan
      INFO: '\x1b[32m',  // Green
      WARN: '\x1b[33m',  // Yellow
      ERROR: '\x1b[31m'  // Red
    };
    const reset = '\x1b[0m';
    const color = colors[entry.level];

    const timestamp = entry.timestamp.split('T')[1].split('.')[0];
    let output = `${color}[${entry.level}]${reset} ${timestamp} ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      output += `\n  ${JSON.stringify(entry.context, null, 2).split('\n').join('\n  ')}`;
    }

    if (entry.error) {
      output += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        output += `\n  ${entry.error.stack.split('\n').slice(1, 4).join('\n  ')}`;
      }
    }

    console.log(output);
  }
}

/**
 * Global logger instance
 * Can be replaced with custom logger for testing
 */
export let logger: ILogger = new Logger();

/**
 * Set global logger instance
 */
export function setLogger(customLogger: ILogger): void {
  logger = customLogger;
}

/**
 * Create a child logger with preset context
 */
export function createLogger(baseContext: Record<string, unknown>): ILogger {
  return {
    debug: (message, context?) => logger.debug(message, { ...baseContext, ...context }),
    info: (message, context?) => logger.info(message, { ...baseContext, ...context }),
    warn: (message, context?) => logger.warn(message, { ...baseContext, ...context }),
    error: (message, error?, context?) => logger.error(message, error, { ...baseContext, ...context }),
    setLevel: (level) => logger.setLevel(level)
  };
}
