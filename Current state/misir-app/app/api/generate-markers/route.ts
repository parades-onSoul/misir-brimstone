// This route is obsolete - marker generation is now handled in /api/spaces
// using Gemini AI via generateSubspacesWithMarkers()
// Keeping for reference only

import { NextRequest, NextResponse } from 'next/server';
import { generateSubspacesWithMarkers } from '@/lib/ai/gemini';

/**
 * POST /api/generate-markers
 * Generate Subspace markers using AI
 */
export async function POST(request: NextRequest) {
  try {
    const { name, description } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Space name is required' },
        { status: 400 }
      );
    }

    // Use Gemini AI to generate Subspaces with markers
    const SubspacesWithMarkers = await generateSubspacesWithMarkers(name, description);

    return NextResponse.json({ Subspaces: SubspacesWithMarkers });

  } catch (error) {
    console.error('Error generating markers:', error);
    return NextResponse.json(
      { error: 'Failed to generate markers' },
      { status: 500 }
    );
  }
}
