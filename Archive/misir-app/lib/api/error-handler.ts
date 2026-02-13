/**
 * API Error Handler
 * 
 * Centralized error handling for API routes with:
 * - Consistent error formatting
 * - Structured logging
 * - Optional Sentry integration point
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { ZodError } from 'zod';

// ============================================================================
// Error Types
// ============================================================================

export class APIError extends Error {
    constructor(
        message: string,
        public statusCode: number = 500,
        public code?: string,
        public details?: unknown
    ) {
        super(message);
        this.name = 'APIError';
    }
}

export class NotFoundError extends APIError {
    constructor(message: string = 'Resource not found') {
        super(message, 404, 'NOT_FOUND');
    }
}

export class UnauthorizedError extends APIError {
    constructor(message: string = 'Unauthorized') {
        super(message, 401, 'UNAUTHORIZED');
    }
}

export class ForbiddenError extends APIError {
    constructor(message: string = 'Forbidden') {
        super(message, 403, 'FORBIDDEN');
    }
}

export class BadRequestError extends APIError {
    constructor(message: string = 'Bad request', details?: unknown) {
        super(message, 400, 'BAD_REQUEST', details);
    }
}

export class RateLimitError extends APIError {
    constructor(retryAfter: number) {
        super('Too many requests', 429, 'RATE_LIMIT', { retryAfter });
    }
}

// ============================================================================
// Error Response Formatter
// ============================================================================

interface ErrorResponse {
    error: string;
    code?: string;
    details?: unknown;
    requestId?: string;
}

function formatErrorResponse(error: unknown, requestId?: string): ErrorResponse {
    if (error instanceof APIError) {
        return {
            error: error.message,
            code: error.code,
            details: error.details,
            requestId,
        };
    }

    if (error instanceof ZodError) {
        return {
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: error.issues.map(e => ({
                field: e.path.map(String).join('.'),
                message: e.message,
            })),
            requestId,
        };
    }

    if (error instanceof Error) {
        return {
            error: error.message,
            code: 'INTERNAL_ERROR',
            requestId,
        };
    }

    return {
        error: 'An unexpected error occurred',
        code: 'UNKNOWN_ERROR',
        requestId,
    };
}

function getStatusCode(error: unknown): number {
    if (error instanceof APIError) return error.statusCode;
    if (error instanceof ZodError) return 400;
    return 500;
}

// ============================================================================
// Error Handler Wrapper
// ============================================================================

type RouteHandler = (
    request: NextRequest,
    context?: { params?: Record<string, string> }
) => Promise<NextResponse>;

/**
 * Wrap an API route handler with centralized error handling
 * 
 * @example
 * export const GET = withErrorHandler(async (request) => {
 *   const data = await fetchData();
 *   return NextResponse.json(data);
 * });
 */
export function withErrorHandler(handler: RouteHandler): RouteHandler {
    return async (request: NextRequest, context?: { params?: Record<string, string> }) => {
        const requestId = crypto.randomUUID().slice(0, 8);
        const startTime = Date.now();

        try {
            const response = await handler(request, context);

            // Log successful requests
            const elapsed = Date.now() - startTime;
            logger.debug('API request completed', {
                requestId,
                method: request.method,
                path: new URL(request.url).pathname,
                status: response.status,
                elapsed,
            });

            return response;
        } catch (error) {
            const elapsed = Date.now() - startTime;
            const statusCode = getStatusCode(error);

            // Log error with context
            const logData = {
                requestId,
                method: request.method,
                path: new URL(request.url).pathname,
                status: statusCode,
                elapsed,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            };

            if (statusCode >= 500) {
                logger.error('API error', logData);
                // TODO: Send to Sentry
                // Sentry.captureException(error, { extra: logData });
            } else {
                logger.warn('API client error', logData);
            }

            const errorResponse = formatErrorResponse(error, requestId);

            return NextResponse.json(errorResponse, { status: statusCode });
        }
    };
}

/**
 * Helper to throw API errors from within handlers
 */
export function throwAPIError(
    message: string,
    statusCode: number = 500,
    code?: string
): never {
    throw new APIError(message, statusCode, code);
}

// ============================================================================
// Request Helpers
// ============================================================================

/**
 * Parse and validate JSON body
 */
export async function parseBody<T>(request: NextRequest): Promise<T> {
    try {
        return await request.json();
    } catch {
        throw new BadRequestError('Invalid JSON body');
    }
}

/**
 * Get required query parameter
 */
export function requireQueryParam(
    request: NextRequest,
    name: string
): string {
    const param = new URL(request.url).searchParams.get(name);
    if (!param) {
        throw new BadRequestError(`Missing required query parameter: ${name}`);
    }
    return param;
}

/**
 * Get optional query parameter with default
 */
export function getQueryParam(
    request: NextRequest,
    name: string,
    defaultValue?: string
): string | undefined {
    return new URL(request.url).searchParams.get(name) ?? defaultValue;
}
