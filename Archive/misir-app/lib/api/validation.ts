/**
 * API Validation Schemas
 * 
 * Zod schemas for validating API request bodies.
 */

import { z } from 'zod';

// ============================================================================
// Space Schemas
// ============================================================================

export const CreateSpaceSchema = z.object({
    name: z.string()
        .min(1, 'Space name is required')
        .max(100, 'Space name must be 100 characters or less')
        .trim(),
    intention: z.string()
        .max(280, 'Intention must be 280 characters or less')
        .optional(),
});

export type CreateSpaceInput = z.infer<typeof CreateSpaceSchema>;

// ============================================================================
// Artifact Schemas
// ============================================================================

export const ArtifactTypeSchema = z.enum(['view', 'save', 'highlight', 'annotate']);

export const CreateArtifactSchema = z.object({
    spaceId: z.string().uuid('Invalid space ID'),
    subspaceId: z.string().uuid('Invalid subspace ID').optional(),
    url: z.string().url('Invalid URL'),
    title: z.string()
        .min(1, 'Title is required')
        .max(500, 'Title must be 500 characters or less'),
    extractedText: z.string()
        .max(50000, 'Extracted text must be 50,000 characters or less')
        .optional(),
    type: ArtifactTypeSchema,
    relevance: z.number()
        .min(0, 'Relevance must be between 0 and 1')
        .max(1, 'Relevance must be between 0 and 1')
        .optional()
        .default(1.0),
    // Reading depth metrics
    dwellTimeMs: z.number().int().nonnegative().optional(),
    scrollDepth: z.number().min(0).max(1).optional(),
    readingDepth: z.number().min(0).max(1.5).optional(),
    sessionId: z.string().uuid().optional(),
});

export type CreateArtifactInput = z.infer<typeof CreateArtifactSchema>;

// ============================================================================
// Match Schemas
// ============================================================================

export const MatchContentSchema = z.object({
    content: z.string()
        .min(1, 'Content is required')
        .max(100000, 'Content must be 100,000 characters or less'),
    title: z.string()
        .max(500, 'Title must be 500 characters or less')
        .optional(),
    spaceId: z.string().uuid('Invalid space ID').optional(),
    url: z.string().url('Invalid URL').optional(),
});

export type MatchContentInput = z.infer<typeof MatchContentSchema>;

// ============================================================================
// Marker Generation Schemas
// ============================================================================

export const GenerateMarkersSchema = z.object({
    topic: z.string()
        .min(1, 'Topic is required')
        .max(200, 'Topic must be 200 characters or less'),
    context: z.string()
        .max(1000, 'Context must be 1000 characters or less')
        .optional(),
});

export type GenerateMarkersInput = z.infer<typeof GenerateMarkersSchema>;

// ============================================================================
// Snapshot Schemas
// ============================================================================

export const SnapshotTypeSchema = z.enum(['daily', 'weekly', 'monthly']);

export const CreateSnapshotSchema = z.object({
    snapshotType: SnapshotTypeSchema.optional().default('daily'),
});

export type CreateSnapshotInput = z.infer<typeof CreateSnapshotSchema>;

// ============================================================================
// Report Schemas
// ============================================================================

export const GenerateReportSchema = z.object({
    spaceId: z.string().uuid('Invalid space ID'),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
});

export type GenerateReportInput = z.infer<typeof GenerateReportSchema>;

// ============================================================================
// Pagination Schemas
// ============================================================================

export const PaginationSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().nonnegative().optional().default(0),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;

// ============================================================================
// Validation Helper
// ============================================================================

/**
 * Validate request body against a Zod schema
 * @returns Parsed data or null (sets response error)
 */
export async function validateBody<T>(
    request: Request,
    schema: z.ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: z.ZodError }> {
    try {
        const body = await request.json();
        const data = schema.parse(body);
        return { data, error: null };
    } catch (err) {
        if (err instanceof z.ZodError) {
            return { data: null, error: err };
        }
        throw err;
    }
}

/**
 * Format Zod errors for API response
 * Compatible with both Zod v3 (errors) and v4 (issues)
 */
export function formatZodError(error: z.ZodError): {
    error: string;
    details: Array<{ field: string; message: string }>;
} {
    // Zod v4 uses 'issues' property
    const issues = error.issues ?? [];

    return {
        error: 'Validation failed',
        details: issues.map((e) => ({
            field: e.path.map(String).join('.') || 'root',
            message: e.message,
        })),
    };
}
