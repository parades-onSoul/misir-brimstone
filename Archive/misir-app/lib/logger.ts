/**
 * System-wide Logging Utility
 * 
 * Centralized logging using Consola for consistent, structured logging
 * across the entire application. Works on both client and server.
 * 
 * Usage:
 * ```typescript
 * import { logger } from '@/lib/logger';
 * 
 * logger.info('User signed in', { userId: '123' });
 * logger.error('Database connection failed', { error: err });
 * logger.debug('Processing artifact', { artifactId: '456' });
 * ```
 */

import { createConsola, type ConsolaInstance } from 'consola';

// Determine if we're in development
const isDevelopment = process.env.NODE_ENV !== 'production';

// Configure base logger
export const logger = createConsola({
  level: isDevelopment ? 4 : 3, // 4 = debug, 3 = info
  formatOptions: {
    date: true,
    colors: isDevelopment,
    compact: !isDevelopment,
  },
});

// Set tag for all logs
logger.withTag('misir');

/**
 * Create a child logger with a specific module tag
 * 
 * @example
 * const authLogger = createLogger('auth');
 * authLogger.info('Password reset requested');
 */
export function createLogger(name: string): ConsolaInstance {
  return logger.withTag(name);
}

/**
 * Log levels (consola):
 * - trace (5): Very detailed diagnostic information
 * - debug (4): Detailed information for debugging
 * - info (3): General informational messages
 * - warn (2): Warning messages for potentially harmful situations
 * - error (1): Error messages for failures
 * - fatal (0): Critical errors causing application shutdown
 */

// Export specific loggers for different modules
export const authLogger = createLogger('auth');
export const dbLogger = createLogger('database');
export const apiLogger = createLogger('api');
export const engineLogger = createLogger('engine');
export const vizLogger = createLogger('visualization');
export const matchLogger = createLogger('match');
export const embedLogger = createLogger('embeddings');

// Type-safe logging helper for requests
export interface RequestContext {
  method: string;
  url: string;
  userId?: string;
  duration?: number;
  statusCode?: number;
}

export function logRequest(context: RequestContext, level: 'info' | 'warn' | 'error' = 'info') {
  apiLogger[level]('Request processed', context);
}

// Type-safe logging helper for errors
export function logError(error: unknown, context?: Record<string, unknown>) {
  const errorDetails = error instanceof Error
    ? {
        message: error.message,
        stack: isDevelopment ? error.stack : undefined,
        name: error.name,
      }
    : { error: String(error) };
  
  logger.error('Error occurred', { ...errorDetails, ...context });
}

export default logger;
