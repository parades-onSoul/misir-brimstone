import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface SubspaceWithMarkers {
  name: string;
  markers: string[];
  informationGain?: 'high' | 'medium' | 'low';
}

export interface GenerationResult {
  subspaces: SubspaceWithMarkers[];
  exhaustionStatus: 'not_exhausted' | 'nearing_exhaustion' | 'exhausted';
  reasoning?: string;
}

/**
 * Fallback Subspaces when AI generation fails
 */
function getFallbackSubspaces(spaceName: string): SubspaceWithMarkers[] {
  console.log('[Gemini] Using fallback Subspaces');
  return [{
    name: 'Getting Started',
    markers: [spaceName.toLowerCase(), 'basics', 'fundamentals', 'introduction'],
    informationGain: 'high'
  }];
}

/**
 * Generate Subspaces with exhaustive marker lists for a given space
 * Uses the Subspace Exhaustion Model to prevent redundancy and ensure intention alignment
 * 
 * @param spaceName - Name of the space (topic)
 * @param _unused - Deprecated, kept for backward compatibility
 * @param intention - User's goal/purpose for learning this topic
 * @param fastMode - If true, generates fewer subspaces (5-7) for faster onboarding
 */
export async function generateSubspacesWithMarkers(
  spaceName: string,
  _unused?: string, // Deprecated: description removed
  intention?: string,
  fastMode: boolean = false
): Promise<SubspaceWithMarkers[]> {
  // Check if API key is configured
  if (!process.env.GEMINI_API_KEY) {
    console.error('[Gemini] API key not configured');
    return getFallbackSubspaces(spaceName);
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

  // Fast mode for onboarding: 5-7 subspaces with 10-15 markers
  // Full mode: 10-25 subspaces with 15-50 markers (let exhaustion model decide)
  const subspaceGuidance = fastMode 
    ? 'Generate 5-7 high-value subspaces quickly.' 
    : 'Generate 10-25 subspaces. Stop when exhausted, even if below minimum.';
  const markerCount = fastMode ? '10-15' : '15-50';

  const prompt = `You are analyzing a Space to generate its subspaces with exhaustive keyword markers.

INPUT:
- Space Name: "${spaceName}"
${intention ? `- Intention: "${intention}"` : '- Intention: General understanding of the topic'}

EXHAUSTION RULES (Strictly Enforced):

1. INTENTION CONSTRAINT
   Every subspace must directly serve the stated intention.
   If a subspace introduces a new aim or scope not implied by the intention, reject it.
   Example: If intention is "Build a recommendation system" for ML, focus on relevant techniques, not ML history.

2. INFORMATION GAIN
   Each subspace must add new understanding not covered by other subspaces.
   If a candidate subspace is semantically similar to an existing one (ΔI ≤ 0.1), do not include it.
   "Predictive Modeling" adds nothing if you already have "Classification" and "Regression".

3. DIMINISHING RETURNS
   If you cannot generate subspaces with meaningful new information, stop.
   Do not pad to reach a count. Quality over quantity.

4. SUMMARIZABILITY
   All subspaces together must compress back to the Space name without contradiction.
   If a subspace requires redefining the Space, it belongs in a new Space.

5. NO INFINITE GRANULARITY
   Depth without novelty is invalid.
   "Machine Learning Basics" as a subspace of "Machine Learning" adds nothing.
   "Simple Linear Regression" under "Supervised Learning" is too granular.

6. EXHAUSTION AWARENESS
   Stop generating when new subspaces would be:
   - Redundant with existing ones
   - Overly granular without new insight
   - Outside the intention scope

GENERATION GUIDANCE:
${subspaceGuidance}
- Minimum: 5 subspaces (if topic supports it)
- Maximum: 40 subspaces (hard cap)
- Each subspace needs ${markerCount} exhaustive keyword markers
- Markers are keywords/phrases that appear in educational content about that subspace
- Be specific and technical - avoid generic words like "learn", "tutorial", "guide"
- Include variations: plurals, abbreviations, related terms

OUTPUT FORMAT (strict JSON):
{
  "subspaces": [
    {
      "name": "Subspace Name",
      "markers": ["keyword1", "keyword2", "phrase with spaces", ...],
      "informationGain": "high"
    }
  ],
  "exhaustionStatus": "not_exhausted" | "nearing_exhaustion" | "exhausted",
  "reasoning": "One paragraph explaining the structure and why you stopped where you did"
}

EXAMPLE for Space "Machine Learning" with Intention "Build a recommendation system":
{
  "subspaces": [
    {
      "name": "Collaborative Filtering",
      "markers": ["user-based filtering", "item-based filtering", "matrix factorization", "cosine similarity", "pearson correlation", "neighborhood methods", "implicit feedback", "explicit ratings", "user-item matrix", "sparsity", "cold start"],
      "informationGain": "high"
    },
    {
      "name": "Content-Based Filtering",
      "markers": ["feature extraction", "tf-idf", "item profiles", "user profiles", "content similarity", "attribute matching", "hybrid approaches", "metadata", "item features"],
      "informationGain": "high"
    }
  ],
  "exhaustionStatus": "not_exhausted",
  "reasoning": "Focused on recommendation-relevant ML techniques. Excluded general ML topics like supervised/unsupervised learning as they don't directly serve the recommendation system intention."
}

Now generate for the given space. Return ONLY valid JSON, no markdown formatting.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    console.log('[Gemini] Raw response:', text.substring(0, 300));
    
    // Parse JSON response
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed: GenerationResult = JSON.parse(cleaned);
    
    // Handle both old format (Subspaces) and new format (subspaces)
    const subspaces = parsed.subspaces || (parsed as unknown as { Subspaces: SubspaceWithMarkers[] }).Subspaces;
    
    if (!subspaces || !Array.isArray(subspaces)) {
      throw new Error('Invalid response format from Gemini');
    }
    
    console.log(`[Gemini] Generated ${subspaces.length} Subspaces`);
    console.log(`[Gemini] Exhaustion status: ${parsed.exhaustionStatus || 'unknown'}`);
    if (parsed.reasoning) {
      console.log(`[Gemini] Reasoning: ${parsed.reasoning.substring(0, 100)}...`);
    }
    
    // Filter out low information gain subspaces in full mode
    const filtered = fastMode 
      ? subspaces 
      : subspaces.filter(s => s.informationGain !== 'low');
    
    console.log(`[Gemini] After filtering: ${filtered.length} Subspaces`);
    
    return filtered;
  } catch (error) {
    console.error('[Gemini] Error generating Subspaces:', error);
    return getFallbackSubspaces(spaceName);
  }
}
