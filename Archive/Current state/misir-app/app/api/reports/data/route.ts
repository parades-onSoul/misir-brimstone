/**
 * Report Data API Route
 * 
 * Fetches space/subspace data for generating reports.
 * Returns structured data that the report generator can use.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'weekly';
    const spaceId = searchParams.get('spaceId');

    try {
        const supabase = await createClient();

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Calculate date range based on period
        const now = new Date();
        let startDate: Date;

        switch (period) {
            case 'daily':
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case 'weekly':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'monthly':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case 'yearly':
                startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        // Fetch spaces
        let spacesQuery = supabase
            .from('spaces')
            .select('id, name, intention, created_at')
            .eq('user_id', user.id);

        if (spaceId) {
            spacesQuery = spacesQuery.eq('id', spaceId);
        }

        const { data: spaces, error: spacesError } = await spacesQuery;

        if (spacesError) {
            console.error('[Reports] Error fetching spaces:', spacesError);
            return NextResponse.json({ error: 'Failed to fetch spaces' }, { status: 500 });
        }

        if (!spaces || spaces.length === 0) {
            return NextResponse.json({ spaces: [], period });
        }

        // Fetch subspaces for each space with evidence calculation
        const spacesWithSubspaces = await Promise.all(
            spaces.map(async (space) => {
                // Fetch subspaces
                const { data: subspaces, error: subspacesError } = await supabase
                    .from('subspaces')
                    .select('id, name, markers, centroid_artifact_count')
                    .eq('space_id', space.id);

                if (subspacesError) {
                    console.error('[Reports] Error fetching subspaces:', subspacesError);
                    return { ...space, subspaces: [] };
                }

                // Calculate evidence for each subspace based on artifacts in the period
                const subspacesWithEvidence = await Promise.all(
                    (subspaces || []).map(async (subspace) => {
                        // Count artifacts in date range
                        const { count, error: countError } = await supabase
                            .from('artifacts')
                            .select('*', { count: 'exact', head: true })
                            .eq('subspace_id', subspace.id)
                            .gte('created_at', startDate.toISOString());

                        // Evidence is artifact count + baseline from centroid_artifact_count
                        const artifactCount = countError ? 0 : (count || 0);
                        const evidence = artifactCount + (subspace.centroid_artifact_count || 0) * 0.1;

                        return {
                            id: subspace.id,
                            name: subspace.name,
                            evidence: evidence,
                        };
                    })
                );

                return {
                    id: space.id,
                    name: space.name,
                    subspaces: subspacesWithEvidence,
                };
            })
        );

        return NextResponse.json({
            spaces: spacesWithSubspaces,
            period,
        });

    } catch (error) {
        console.error('[Reports] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
