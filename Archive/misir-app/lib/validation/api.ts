import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Validate request body against a Zod schema.
 */
export async function validateBody<T>(req: NextRequest, schema: z.Schema<T>): Promise<{ success: true; data: T } | { success: false; error: NextResponse }> {
    try {
        const json = await req.json();
        const result = schema.safeParse(json);

        if (!result.success) {
            return {
                success: false,
                error: NextResponse.json(
                    { error: 'Validation Error', details: result.error.flatten() },
                    { status: 400 }
                ),
            };
        }

        return { success: true, data: result.data };
    } catch (error) {
        return {
            success: false,
            error: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
        };
    }
}

/**
 * Validate URL search parameters against a Zod schema.
 */
export function validateQueryParams<T>(req: NextRequest, schema: z.Schema<T>): { success: true; data: T } | { success: false; error: NextResponse } {
    try {
        const url = new URL(req.url);
        const params = Object.fromEntries(url.searchParams.entries());
        const result = schema.safeParse(params);

        if (!result.success) {
            return {
                success: false,
                error: NextResponse.json(
                    { error: 'Invalid Query Parameters', details: result.error.flatten() },
                    { status: 400 }
                ),
            };
        }

        return { success: true, data: result.data };
    } catch (error) {
        return {
            success: false,
            error: NextResponse.json({ error: 'Invalid URL parameters' }, { status: 400 }),
        };
    }
}
