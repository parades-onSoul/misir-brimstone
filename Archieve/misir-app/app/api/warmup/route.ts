import { NextResponse } from 'next/server';
import { warmUp, getStatus } from '@/lib/ai/embeddings';

/**
 * GET /api/warmup
 * 
 * Pre-warm the embedding model to avoid cold start latency.
 * Call this endpoint after deployment or from a cron job.
 */
export async function GET() {
    const status = getStatus();

    if (status.loaded) {
        return NextResponse.json({
            message: 'Model already loaded',
            ...status,
        });
    }

    const result = await warmUp();

    if (result.success) {
        return NextResponse.json({
            message: 'Model warmed up successfully',
            loadTimeMs: result.loadTimeMs,
            ...getStatus(),
        });
    }

    return NextResponse.json(
        { error: 'Failed to warm up model', loadTimeMs: result.loadTimeMs },
        { status: 500 }
    );
}
