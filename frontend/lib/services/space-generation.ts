/**
 * Space Generation Service
 * 
 * Orchestrates Groq AI generation + backend API calls
 */

import { generateWithFallback } from '@/lib/ai';
import type { CreateSpaceRequest, CreateSubspaceInput } from '@/types/api';

export interface GenerateSpaceOptions {
  name: string;
  description?: string;
  intention?: string;
  userId: string;
}

/**
 * Generate a complete space with AI-powered subspaces and markers
 * 
 * Flow:
 * 1. Groq generates subspaces + markers
 * 2. Format for backend API
 * 3. Return CreateSpaceRequest ready to send
 */
export async function generateSpace(
  options: GenerateSpaceOptions
): Promise<CreateSpaceRequest> {
  // Step 1: Generate subspaces using Groq AI
  const aiSubspaces = await generateWithFallback({
    spaceName: options.name,
    description: options.description,
    intention: options.intention,
  });

  // Step 2: Format for backend API
  const subspaces: CreateSubspaceInput[] = aiSubspaces.map((sub) => ({
    name: sub.name,
    description: sub.description,
    markers: sub.markers,
    depth: sub.depth,
    prerequisites: sub.prerequisites,
    suggested_study_order: sub.suggested_study_order,
  }));

  // Step 3: Return complete request (user_id comes from JWT in Authorization header)
  return {
    name: options.name,
    description: options.description,
    intention: options.intention,
    subspaces,
  };
}

/**
 * Estimate token/cost for space generation (for analytics)
 */
export function estimateGenerationCost(spaceName: string, description?: string, intention?: string): {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUSD: number;
} {
  // Rough estimates based on prompt size
  const baseInputTokens = 500; // Prompt template
  const inputFromName = (spaceName.length / 4) * 1.3;
  const inputFromDesc = ((description?.length || 0) / 4) * 1.3;
  const inputFromIntent = ((intention?.length || 0) / 4) * 1.3;
  
  const estimatedInputTokens = Math.ceil(
    baseInputTokens + inputFromName + inputFromDesc + inputFromIntent
  );

  // Output is typically 5-7 subspaces × 4-6 markers × ~10 tokens per marker
  const estimatedOutputTokens = 2000; // Conservative estimate

  // Groq pricing (update with current rates)
  const inputCostPer1M = 0; // Placeholder
  const outputCostPer1M = 0; // Placeholder

  const estimatedCostUSD =
    (estimatedInputTokens / 1_000_000) * inputCostPer1M +
    (estimatedOutputTokens / 1_000_000) * outputCostPer1M;

  return {
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedCostUSD,
  };
}
