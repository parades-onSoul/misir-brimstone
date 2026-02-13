/**
 * AI Module Exports
 * 
 * Clean barrel file for AI functionality.
 * 
 * Frontend handles: Gemini (subspace generation), Embeddings (spaces/subspaces/markers)
 * Backend handles: Intelligence reports, insights, evidence calculation
 */

// Gemini - Subspace generation
export {
    generateSubspacesWithMarkers,
    type SubspaceWithMarkers,
    type GenerationResult,
} from './gemini';

// Embeddings - Nomic Embed v1.5 (768-dim, Matryoshka support)
export {
    embedText,
    embedTexts,
    embedQuery,
    toPgVector,
    cosineSimilarity,
    warmUp,
    isReady,
    getStatus,
    EMBEDDING_DIMENSIONS,
    MODEL_NAME,
    MATRYOSHKA_DIMS,
    type MatryoshkaDim,
} from './embeddings';
