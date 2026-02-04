import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { requireAuth } from '@/lib/auth/server';
import { generateSubspacesWithMarkers } from '@/lib/ai/gemini';
import { embedText, embedTexts, toPgVector } from '@/lib/ai/embeddings';

/**
 * POST /api/onboarding/seed
 * 
 * The "Seed" Protocol: Create initial spaces for first-time users.
 * Takes 1-3 topics and generates spaces with AI-powered subspaces.
 * All spaces start in Latent state (evidence = 0).
 * 
 * Uses Architecture B: Normalized markers with Nomic Embed v1.5 embeddings (768-dim)
 * Uses fast mode (5-7 subspaces per space) and parallel generation
 * to complete in ~10-20 seconds instead of 5+ minutes.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const userId = user.id;

    const { topics } = await request.json();

    // Validate input
    if (!Array.isArray(topics) || topics.length === 0) {
      return NextResponse.json(
        { error: 'At least one topic is required' },
        { status: 400 }
      );
    }

    // Filter and sanitize topics
    const validTopics = topics
      .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      .map(t => t.trim())
      .slice(0, 3); // Max 3 topics

    if (validTopics.length === 0) {
      return NextResponse.json(
        { error: 'At least one valid topic is required' },
        { status: 400 }
      );
    }

    console.log('[Onboarding] Seeding spaces for user:', userId);
    console.log('[Onboarding] Topics:', validTopics);

    const supabase = await createClient();

    // Check if user already has spaces (prevent re-seeding)
    const { data: existingSpaces } = await supabase
      .from('spaces')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (existingSpaces && existingSpaces.length > 0) {
      console.log('[Onboarding] User already has spaces, skipping seed');
      return NextResponse.json({
        message: 'User already has spaces',
        spacesCreated: 0
      });
    }

    // Generate subspaces for ALL topics in PARALLEL (much faster)
    console.log('[Onboarding] Generating subspaces in parallel...');
    const subspaceResults = await Promise.all(
      validTopics.map(topic =>
        generateSubspacesWithMarkers(topic, undefined, undefined, true) // fastMode = true
      )
    );

    // Create spaces for each topic
    const createdSpaces = [];

    for (let i = 0; i < validTopics.length; i++) {
      const topic = validTopics[i];
      const subspacesWithMarkers = subspaceResults[i];

      console.log(`[Onboarding] Creating space: "${topic}" with ${subspacesWithMarkers.length} subspaces`);

      // 1. Generate embedding for space
      const spaceEmbedding = await embedText(topic);

      // 2. Create the space with embedding
      const { data: space, error: spaceError } = await supabase
        .from('spaces')
        .insert({
          user_id: userId,
          name: topic,
          description: `Seeded during onboarding`,
          embedding: toPgVector(spaceEmbedding),
        })
        .select()
        .single();

      if (spaceError) {
        console.error(`[Onboarding] Failed to create space "${topic}":`, spaceError);
        continue; // Try next topic
      }

      // 3. Create space_state (starts at evidence = 0, Latent)
      const { error: stateError } = await supabase
        .from('space_states')
        .insert({
          space_id: space.id,
          evidence: 0,
        });

      if (stateError) {
        console.error(`[Onboarding] Failed to create space_state:`, stateError);
      }

      // 4. Generate embeddings for all subspace names
      const subspaceNames = subspacesWithMarkers.map(s => s.name);
      const subspaceEmbeddings = await embedTexts(subspaceNames);

      console.log(`[Onboarding] Generated ${subspaceEmbeddings.length} subspace embeddings`);

      // 5. Create subspaces with embeddings
      let createdSubspaces: Array<{ id: string; markers: string[] }> = [];
      if (subspacesWithMarkers.length > 0) {
        const subspacesToInsert = subspacesWithMarkers.map((subspace, index) => ({
          space_id: space.id,
          user_id: userId,
          name: subspace.name,
          markers: subspace.markers,
          display_order: index,
          embedding: toPgVector(subspaceEmbeddings[index]),
        }));

        const { data, error: subspacesError } = await supabase
          .from('subspaces')
          .insert(subspacesToInsert)
          .select('id, markers');

        if (subspacesError) {
          console.error(`[Onboarding] Failed to create subspaces:`, subspacesError);
        } else {
          createdSubspaces = data || [];
        }
      }

      // 6. Architecture B: Populate markers table with space_id namespace
      const allMarkers = new Set<string>();
      for (const subspace of subspacesWithMarkers) {
        for (const marker of subspace.markers) {
          allMarkers.add(marker.toLowerCase().trim());
        }
      }

      const uniqueMarkers = Array.from(allMarkers);
      console.log(`[Onboarding] Processing ${uniqueMarkers.length} unique markers`);

      // Generate embeddings for all markers
      const markerEmbeddings = await embedTexts(uniqueMarkers);

      // Upsert markers (namespaced by space_id)
      const markerIdMap = new Map<string, string>();

      for (let j = 0; j < uniqueMarkers.length; j++) {
        const label = uniqueMarkers[j];
        const embedding = markerEmbeddings[j];

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
            console.error(`[Onboarding] Error inserting marker "${label}":`, markerError);
            continue;
          }

          if (newMarker) {
            markerIdMap.set(label, newMarker.id);
          }
        }
      }

      console.log(`[Onboarding] Markers in database: ${markerIdMap.size}`);

      // 7. Create subspace_markers join records
      const subspaceMarkerLinks: Array<{
        subspace_id: string;
        marker_id: string;
        weight: number;
      }> = [];

      for (let j = 0; j < subspacesWithMarkers.length; j++) {
        const subspace = subspacesWithMarkers[j];
        const createdSubspace = createdSubspaces[j];

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
          console.error('[Onboarding] Error creating subspace_markers:', linkError);
        } else {
          console.log(`[Onboarding] Created ${subspaceMarkerLinks.length} subspace_marker links`);
        }
      }

      createdSpaces.push({
        id: space.id,
        name: space.name,
        subspaceCount: subspacesWithMarkers.length,
      });
    }

    console.log(`[Onboarding] Created ${createdSpaces.length} spaces`);

    // Mark user as onboarded
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ onboarded_at: new Date().toISOString() })
      .eq('id', userId);

    if (userUpdateError) {
      console.error('[Onboarding] Failed to update onboarded_at:', userUpdateError);
    }

    return NextResponse.json({
      message: 'Spaces seeded successfully',
      spacesCreated: createdSpaces.length,
      spaces: createdSpaces,
    });

  } catch (error) {
    console.error('[Onboarding] Error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to seed spaces' },
      { status: 500 }
    );
  }
}
