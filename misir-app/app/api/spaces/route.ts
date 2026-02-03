import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { requireAuth } from '@/lib/auth/server';
import { generateSubspacesWithMarkers } from '@/lib/ai/gemini';
import { embedText, embedTexts, toPgVector } from '@/lib/ai/embeddings';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { CreateSpaceSchema, validateBody, formatZodError } from '@/lib/api/validation';
import { logger } from '@/lib/logger';

// Internal type for subspace data in API
interface SpaceSubspace {
  id: string;
  spaceId: string;
  userId: string;
  name: string;
  markers: string[];
  displayOrder: number;
  evidence: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /api/spaces
 * List all spaces for the current user with subspaces and current state
 * 
 * Query params:
 * - limit: number (default 20, max 100)
 * - offset: number (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const userId = user.id;

    // Parse pagination params
    const url = new URL(request.url);
    const limit = Math.min(
      parseInt(url.searchParams.get('limit') || '20', 10),
      100 // Max limit
    );
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const supabase = await createClient();

    // Get total count first
    const { count: totalCount } = await supabase
      .from('spaces')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Fetch spaces with pagination
    const { data: spaces, error: spacesError } = await supabase
      .from('spaces')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (spacesError) throw spacesError;

    if (!spaces || spaces.length === 0) {
      return NextResponse.json({
        spaces: [],
        pagination: { total: totalCount || 0, limit, offset, hasMore: false }
      });
    }

    // Deduplicate spaces by ID (in case of any database issues)
    const uniqueSpaces = Array.from(
      new Map(spaces.map(s => [s.id, s])).values()
    );

    // Fetch subspaces for all spaces
    const spaceIds = uniqueSpaces.map(s => s.id);
    const { data: subspaces } = await supabase
      .from('subspaces')
      .select('*')
      .in('space_id', spaceIds)
      .order('display_order', { ascending: true });

    // Fetch space_states for evidence
    const { data: spaceStates } = await supabase
      .from('space_states')
      .select('*')
      .in('space_id', spaceIds);

    // Fetch artifacts grouped by subspace to calculate per-subspace evidence
    const subspaceIds = (subspaces || []).map(s => s.id);
    const { data: artifacts } = await supabase
      .from('artifacts')
      .select('subspace_id, base_weight, relevance, created_at')
      .in('subspace_id', subspaceIds);

    // Calculate evidence per subspace (sum of base_weight * relevance)
    // Note: In production, this should include decay based on created_at
    const evidenceBySubspace: Record<string, number> = {};
    (artifacts || []).forEach(artifact => {
      if (artifact.subspace_id) {
        const contribution = (artifact.base_weight || 0.2) * (artifact.relevance || 0);
        evidenceBySubspace[artifact.subspace_id] = (evidenceBySubspace[artifact.subspace_id] || 0) + contribution;
      }
    });

    console.log('[API] Artifacts fetched:', artifacts?.length || 0);
    console.log('[API] Evidence by subspace:', evidenceBySubspace);

    // State thresholds (lowered for ambient artifact weights)
    const THETA_1 = 1;
    const THETA_2 = 3;
    const THETA_3 = 6;

    // Helper to get state from evidence
    const getStateFromEvidence = (evidence: number): 0 | 1 | 2 | 3 => {
      if (evidence >= THETA_3) return 3;
      if (evidence >= THETA_2) return 2;
      if (evidence >= THETA_1) return 1;
      return 0;
    };

    // Group subspaces by space_id with evidence
    const subspacesBySpace = (subspaces || []).reduce((acc, subspace) => {
      if (!acc[subspace.space_id]) acc[subspace.space_id] = [];
      const evidence = evidenceBySubspace[subspace.id] || 0;
      acc[subspace.space_id].push({
        id: subspace.id,
        spaceId: subspace.space_id,
        userId: subspace.user_id,
        name: subspace.name,
        markers: Array.isArray(subspace.markers) ? subspace.markers : JSON.parse(subspace.markers || '[]'),
        displayOrder: subspace.display_order,
        evidence: evidence,
        createdAt: subspace.created_at,
        updatedAt: subspace.updated_at,
      });
      return acc;
    }, {} as Record<string, SpaceSubspace[]>);

    // Map evidence by space_id
    const evidenceBySpace = (spaceStates || []).reduce((acc, state) => {
      acc[state.space_id] = state.evidence;
      return acc;
    }, {} as Record<string, number>);

    // Calculate state vector for each space based on subspace states
    const calculateStateVector = (subspaceList: SpaceSubspace[]): [number, number, number, number] => {
      if (!subspaceList || subspaceList.length === 0) return [10, 0, 0, 0];

      // Count subspaces in each state
      const counts = [0, 0, 0, 0];
      subspaceList.forEach(sub => {
        const state = getStateFromEvidence(sub.evidence || 0);
        counts[state]++;
      });

      logger.debug('State counts', { counts });

      // Normalize to total mass of 10, ensuring non-zero counts get at least 1
      const total = subspaceList.length;
      const result: [number, number, number, number] = [0, 0, 0, 0];
      let remaining = 10;

      // First pass: give at least 1 to each non-zero count
      for (let i = 3; i >= 0; i--) {
        if (counts[i] > 0) {
          result[i] = 1;
          remaining--;
        }
      }

      // Second pass: distribute remaining based on proportion
      if (remaining > 0) {
        for (let i = 0; i < 4; i++) {
          if (counts[i] > 0) {
            const proportion = counts[i] / total;
            const additional = Math.round(proportion * remaining);
            result[i] += additional;
          }
        }
      }

      // Ensure total is exactly 10
      const currentTotal = result.reduce((a, b) => a + b, 0);
      if (currentTotal !== 10) {
        // Adjust the largest category
        const maxIdx = result.indexOf(Math.max(...result));
        result[maxIdx] += (10 - currentTotal);
      }

      return result;
    };

    // Transform and combine
    const transformedSpaces = uniqueSpaces.map(space => {
      const spaceSubspaces = subspacesBySpace[space.id] || [];
      const stateVector = calculateStateVector(spaceSubspaces);
      logger.debug('Space state vector', { space: space.name, subspaceCount: spaceSubspaces.length, stateVector });
      return {
        id: space.id,
        userId: space.user_id,
        name: space.name,
        intention: space.intention,
        lastUpdatedAt: space.last_updated_at,
        createdAt: space.created_at,
        subspaces: spaceSubspaces,
        stateVector: stateVector,
        evidence: evidenceBySpace[space.id] || 0,
      };
    });

    return NextResponse.json({
      spaces: transformedSpaces,
      pagination: {
        total: totalCount || 0,
        limit,
        offset,
        hasMore: offset + transformedSpaces.length < (totalCount || 0)
      }
    });
  } catch (error) {
    logger.error('Error fetching spaces', { error });

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch spaces' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/spaces
 * Create a new space with AI-generated subspaces
 * Uses Architecture B: Normalized markers with Nomic Embed v1.5 embeddings (768-dim)
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = checkRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const user = await requireAuth();
    const userId = user.id;

    // Validate request body
    const { data: body, error: validationError } = await validateBody(request, CreateSpaceSchema);
    if (validationError) {
      return NextResponse.json(formatZodError(validationError), { status: 400 });
    }

    console.log('[API] Creating space:', body.name);

    // 1. Generate AI-powered subspaces with markers (Gemini)
    const subspacesWithMarkers = await generateSubspacesWithMarkers(
      body.name,
      undefined, // description removed
      body.intention
    );

    console.log('[API] Generated subspaces:', subspacesWithMarkers.length);

    // 2. Generate embedding for space (name + intention)
    const spaceText = body.intention
      ? `${body.name}: ${body.intention}`
      : body.name;
    const spaceEmbedding = await embedText(spaceText);

    console.log('[API] Generated space embedding');

    const supabase = await createClient();

    // 3. Create space with embedding
    const { data: space, error: spaceError } = await supabase
      .from('spaces')
      .insert({
        user_id: userId,
        name: body.name,
        intention: body.intention,
        embedding: toPgVector(spaceEmbedding),
      })
      .select()
      .single();

    if (spaceError) {
      console.error('[API] Database error creating space:', spaceError);
      throw spaceError;
    }

    console.log('[API] Created space:', space.id);

    // 4. Create space_state (evidence tracking)
    const { error: stateError } = await supabase
      .from('space_states')
      .insert({
        space_id: space.id,
        evidence: 0,
      });

    if (stateError) {
      console.error('[API] Database error creating space_state:', stateError);
      throw stateError;
    }

    // 5. Generate embeddings for all subspace names
    const subspaceNames = subspacesWithMarkers.map(s => s.name);
    const subspaceEmbeddings = await embedTexts(subspaceNames);

    console.log('[API] Generated subspace embeddings:', subspaceEmbeddings.length);

    // 6. Create subspaces with embeddings
    // - embedding: Static "seed" from subspace name (never changes)
    // - centroid_embedding: Initially same as embedding, but evolves over time with evidence
    const subspacesToInsert = subspacesWithMarkers.map((subspace, index) => ({
      space_id: space.id,
      user_id: userId,
      name: subspace.name,
      markers: subspace.markers, // Keep JSONB for backward compatibility
      display_order: index,
      embedding: toPgVector(subspaceEmbeddings[index]),           // Static seed
      centroid_embedding: toPgVector(subspaceEmbeddings[index]),  // Will evolve with artifacts
    }));

    const { data: createdSubspaces, error: subspacesError } = await supabase
      .from('subspaces')
      .insert(subspacesToInsert)
      .select();

    if (subspacesError) {
      console.error('[API] Database error creating subspaces:', subspacesError);
      throw subspacesError;
    }

    console.log('[API] Created subspaces:', createdSubspaces?.length);

    // 7. Architecture B: Populate markers table and subspace_markers join table
    // Collect all unique markers across all subspaces
    const allMarkers = new Set<string>();
    for (const subspace of subspacesWithMarkers) {
      for (const marker of subspace.markers) {
        allMarkers.add(marker.toLowerCase().trim());
      }
    }

    const uniqueMarkers = Array.from(allMarkers);
    console.log('[API] Unique markers to process:', uniqueMarkers.length);

    // Generate embeddings for all markers
    const markerEmbeddings = await embedTexts(uniqueMarkers);
    console.log('[API] Generated marker embeddings');

    // Upsert markers (insert if not exists within this space, return existing if exists)
    // Markers are namespaced by space_id to handle semantic collision
    // (e.g., "transformer" in ML space vs Engineering space)
    const markerIdMap = new Map<string, string>();

    for (let i = 0; i < uniqueMarkers.length; i++) {
      const label = uniqueMarkers[i];
      const embedding = markerEmbeddings[i];

      // Try to find existing marker in this space
      const { data: existingMarker } = await supabase
        .from('markers')
        .select('id')
        .eq('label', label)
        .eq('space_id', space.id)
        .single();

      if (existingMarker) {
        markerIdMap.set(label, existingMarker.id);
      } else {
        // Insert new marker with embedding and space_id
        const { data: newMarker, error: markerError } = await supabase
          .from('markers')
          .insert({
            label,
            embedding: toPgVector(embedding),
            space_id: space.id,
          })
          .select('id')
          .single();

        if (markerError) {
          console.error(`[API] Error inserting marker "${label}":`, markerError);
          continue; // Skip this marker but continue with others
        }

        if (newMarker) {
          markerIdMap.set(label, newMarker.id);
        }
      }
    }

    console.log('[API] Markers in database:', markerIdMap.size);

    // 8. Create subspace_markers join records
    const subspaceMarkerLinks: Array<{
      subspace_id: string;
      marker_id: string;
      weight: number;
    }> = [];

    for (let i = 0; i < subspacesWithMarkers.length; i++) {
      const subspace = subspacesWithMarkers[i];
      const createdSubspace = createdSubspaces?.[i];

      if (!createdSubspace) continue;

      for (const marker of subspace.markers) {
        const normalizedMarker = marker.toLowerCase().trim();
        const markerId = markerIdMap.get(normalizedMarker);

        if (markerId) {
          subspaceMarkerLinks.push({
            subspace_id: createdSubspace.id,
            marker_id: markerId,
            weight: 1.0,
          });
        }
      }
    }

    if (subspaceMarkerLinks.length > 0) {
      const { error: linkError } = await supabase
        .from('subspace_markers')
        .insert(subspaceMarkerLinks);

      if (linkError) {
        console.error('[API] Error creating subspace_markers:', linkError);
        // Non-fatal, continue
      } else {
        console.log('[API] Created subspace_markers links:', subspaceMarkerLinks.length);
      }
    }

    // Transform response
    const transformedSpace = {
      id: space.id,
      userId: space.user_id,
      name: space.name,
      intention: space.intention,
      lastUpdatedAt: space.last_updated_at,
      createdAt: space.created_at,
      subspaces: (createdSubspaces || []).map(s => ({
        id: s.id,
        spaceId: s.space_id,
        userId: s.user_id,
        name: s.name,
        markers: Array.isArray(s.markers) ? s.markers : JSON.parse(s.markers || '[]'),
        displayOrder: s.display_order,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      })),
      stateVector: [10, 0, 0, 0] as [number, number, number, number],
      evidence: 0,
    };

    return NextResponse.json({ space: transformedSpace }, { status: 201 });
  } catch (error) {
    console.error('Error creating space:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to create space' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/spaces
 * Delete a space
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Space ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify ownership before deleting
    const { data: space } = await supabase
      .from('spaces')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!space || space.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Space not found' },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from('spaces')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting space:', error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting space:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to delete space' },
      { status: 500 }
    );
  }
}
