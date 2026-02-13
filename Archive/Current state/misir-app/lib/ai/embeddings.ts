/**
 * Embedding Service - Nomic Embed Text v1.5
 * 
 * Provides semantic embeddings for spaces, subspaces, and markers.
 * Uses Xenova/transformers.js for Node.js inference.
 * 
 * Model: nomic-ai/nomic-embed-text-v1.5
 * - 768 dimensions (native)
 * - 8192 token context window
 * - Matryoshka support (can truncate to 512, 384, 256, 128, 64)
 * - Aligned with FastAPI backend embedding service
 */

import { pipeline, Pipeline, FeatureExtractionPipeline } from '@xenova/transformers';

// Singleton pipeline instance
let embeddingPipeline: FeatureExtractionPipeline | null = null;
let isLoading = false;
let loadPromise: Promise<FeatureExtractionPipeline> | null = null;

const MODEL_NAME = 'nomic-ai/nomic-embed-text-v1.5';
const EMBEDDING_DIMENSIONS = 768;

// Matryoshka dimensions supported by Nomic Embed
const MATRYOSHKA_DIMS = [768, 512, 384, 256, 128, 64] as const;
type MatryoshkaDim = typeof MATRYOSHKA_DIMS[number];

/**
 * Initialize Nomic Embed v1.5 model
 * Lazy-loaded on first use, cached for subsequent calls
 */
async function getEmbeddingPipeline(): Promise<FeatureExtractionPipeline> {
  if (embeddingPipeline) {
    return embeddingPipeline;
  }

  if (loadPromise) {
    return loadPromise;
  }

  if (isLoading) {
    // Wait for existing load to complete
    while (isLoading && !embeddingPipeline) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return embeddingPipeline!;
  }

  isLoading = true;
  console.log('[Embeddings] Loading nomic-embed-text-v1.5 (768-dim)...');

  loadPromise = pipeline('feature-extraction', MODEL_NAME, {
    quantized: true,
  }) as Promise<FeatureExtractionPipeline>;

  try {
    embeddingPipeline = await loadPromise;
    console.log('[Embeddings] Model loaded successfully');
    return embeddingPipeline;
  } catch (error) {
    console.error('[Embeddings] Failed to load model:', error);
    throw error;
  } finally {
    isLoading = false;
    loadPromise = null;
  }
}

/**
 * Generate embedding for a single text (document)
 * @param text - Text to embed
 * @param dim - Optional Matryoshka dimension (default: 768)
 * @returns Normalized embedding vector
 */
export async function embedText(text: string, dim: MatryoshkaDim = 768): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    return new Array(dim).fill(0);
  }

  const pipe = await getEmbeddingPipeline();

  // Nomic uses "search_document:" prefix for documents
  const prefixedText = `search_document: ${text}`;
  
  const output = await pipe(prefixedText, {
    pooling: 'mean',
    normalize: true
  });

  const fullEmbedding = Array.from(output.data as Float32Array);
  
  // Matryoshka truncation
  if (dim < 768) {
    return fullEmbedding.slice(0, dim);
  }
  
  return fullEmbedding;
}

/**
 * Generate embedding for query text (uses query prefix)
 * @param text - Query text to embed
 * @param dim - Optional Matryoshka dimension (default: 768)
 * @returns Normalized embedding vector
 */
export async function embedQuery(text: string, dim: MatryoshkaDim = 768): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    return new Array(dim).fill(0);
  }

  const pipe = await getEmbeddingPipeline();

  // Nomic uses "search_query:" prefix for queries
  const prefixedText = `search_query: ${text}`;
  
  const output = await pipe(prefixedText, {
    pooling: 'mean',
    normalize: true
  });

  const fullEmbedding = Array.from(output.data as Float32Array);
  
  if (dim < 768) {
    return fullEmbedding.slice(0, dim);
  }
  
  return fullEmbedding;
}

/**
 * Batch embed multiple texts
 * More efficient than calling embedText multiple times
 * 
 * @param texts - Array of texts to embed
 * @param dim - Optional Matryoshka dimension (default: 768)
 * @returns Array of normalized vectors
 */
export async function embedTexts(texts: string[], dim: MatryoshkaDim = 768): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const pipe = await getEmbeddingPipeline();
  const results: number[][] = [];

  // Process in batches to avoid memory issues
  const BATCH_SIZE = 32;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    for (const text of batch) {
      if (!text || text.trim().length === 0) {
        results.push(new Array(dim).fill(0));
        continue;
      }

      const prefixedText = `search_document: ${text}`;
      const output = await pipe(prefixedText, {
        pooling: 'mean',
        normalize: true
      });

      const fullEmbedding = Array.from(output.data as Float32Array);
      results.push(dim < 768 ? fullEmbedding.slice(0, dim) : fullEmbedding);
    }
  }

  return results;
}

/**
 * Calculate cosine similarity between two vectors
 * Vectors should be normalized (which embedText does)
 * 
 * @param a - First vector
 * @param b - Second vector
 * @returns Similarity score between -1 and 1 (1 = identical)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;

  // For normalized vectors, cosine similarity = dot product
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
  }

  return dotProduct;
}

/**
 * Find top-k most similar vectors to a query
 * 
 * @param query - Query vector
 * @param candidates - Array of {id, embedding} objects
 * @param k - Number of results to return
 * @param threshold - Minimum similarity threshold (default 0.5)
 * @returns Top-k matches with similarity scores
 */
export function findMostSimilar<T extends { id: string; embedding: number[] }>(
  query: number[],
  candidates: T[],
  k: number = 5,
  threshold: number = 0.5
): Array<{ item: T; similarity: number }> {
  const scored = candidates
    .map(item => ({
      item,
      similarity: cosineSimilarity(query, item.embedding),
    }))
    .filter(result => result.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);

  return scored;
}

/**
 * Convert embedding array to PostgreSQL vector format
 * For use with pgvector extension
 */
export function toPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * Parse PostgreSQL vector format to array
 */
export function fromPgVector(pgVector: string): number[] {
  if (!pgVector) return [];
  const cleaned = pgVector.replace(/[\[\]]/g, '');
  return cleaned.split(',').map(Number);
}

/**
 * Pre-warm the embedding model
 * Call this on app startup or via a warm-up endpoint
 */
export async function warmUp(): Promise<{ success: boolean; loadTimeMs: number }> {
  const start = Date.now();
  try {
    await getEmbeddingPipeline();
    const loadTimeMs = Date.now() - start;
    console.log(`[Embeddings] Warm-up complete in ${loadTimeMs}ms`);
    return { success: true, loadTimeMs };
  } catch (error) {
    console.error('[Embeddings] Warm-up failed:', error);
    return { success: false, loadTimeMs: Date.now() - start };
  }
}

/**
 * Check if model is ready (loaded in memory)
 */
export function isReady(): boolean {
  return embeddingPipeline !== null;
}

/**
 * Get model status for health checks
 */
export function getStatus(): {
  loaded: boolean;
  loading: boolean;
  model: string;
  dimensions: number;
} {
  return {
    loaded: embeddingPipeline !== null,
    loading: isLoading,
    model: MODEL_NAME,
    dimensions: EMBEDDING_DIMENSIONS,
  };
}

// Export constants and types
export { EMBEDDING_DIMENSIONS, MODEL_NAME, MATRYOSHKA_DIMS };
export type { MatryoshkaDim };
