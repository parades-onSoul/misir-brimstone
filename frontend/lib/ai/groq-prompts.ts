/**
 * Groq AI Prompts v2.1 - Multi-Factor Adaptive
 * 
 * Architecture:
 * - Prompts analyze input signals (domain complexity, expertise, intent)
 * - Adapts terminology, depth, and quantity automatically
 * - No backend scenario tracking needed
 */

export type PromptMode = 'standard' | 'advanced' | 'fast';

export interface SubspaceWithMarkers {
  name: string;
  description?: string;
  markers: string[];
  depth?: 'foundational' | 'intermediate' | 'advanced';
  prerequisites?: string[];
  suggested_study_order?: number;
}

export const GROQ_PROMPTS = {
  standard: `You are an expert semantic knowledge architect designing personalized learning systems.

TASK: Break down a knowledge domain into coherent semantic subspaces.
META-RULE: This system adapts based on detected domain complexity and user expertise signals.

INPUT:
- Space name: "{space_name}"
- Space description: "{description}"
- User intent: "{intention}"

STEP 1: ANALYZE CONTEXT (Do not output this analysis; use it internally)

Domain Complexity Detection:
  IF description contains: ["mathematical", "theoretical", "algorithm", "framework", "architecture", "formal"]
    → INFER: High technical complexity
  IF description contains: ["beginner", "intro", "basics", "fundamentals", "simple", "easy"]
    → INFER: Low complexity needed
  IF description is empty OR vague
    → INFER: Medium complexity (default)
  ELSE: Parse space_name for technical indicators
    → Domain topics like "Quantum Physics" → High complexity
    → Domain topics like "Coffee" → Low complexity
    → Ambiguous topics → Medium complexity

User Expertise Signal Detection:
  IF intention contains: ["research", "deep", "advanced", "academic", "theory", "expert"]
    → INFER: User is deep learner (add advanced subspaces)
  IF intention contains: ["quick", "intro", "overview", "basics", "beginner", "learn fundamentals"]
    → INFER: User is beginner (reduce complexity)
  IF description is highly technical (full sentences, technical terms, specific references)
    → INFER: User understands the domain (add deeper concepts)
  ELSE: Default to medium depth

STEP 2: ADJUST OUTPUT BASED ON SIGNALS

- HIGH complexity + DEEP learner → 7-8 subspaces, 5-6 markers, advanced terminology
- HIGH complexity + BEGINNER → 5-6 subspaces, 4-5 markers, foundational focus
- MEDIUM complexity + ANY learner → 5-7 subspaces, 4-6 markers, balanced approach
- LOW complexity + ANY learner → 3-5 subspaces, 3-4 markers, essential concepts only

STEP 3: GENERATE SUBSPACES

OUTPUT: JSON array of subspaces, each with:
- name: Semantic category (noun phrase, 2-4 words, match detected complexity)
- description: Why this subspace matters (1 sentence, 20 words max)
- markers: Array of 4-6 precise keywords/phrases (adapt terminology to complexity level)

QUALITY CRITERIA (Always Follow):

1. **Scope Rule**: Each subspace must be:
   - Coherent: Ideas belong together (not "fruit" AND "gravity")
   - Distinct: Non-overlapping with other subspaces
   - Learnable: Mastery time matches domain complexity

2. **Marker Terminology Adaptation**:
   FOR HIGH COMPLEXITY: Use precise technical terms
   FOR MEDIUM COMPLEXITY: Balance technical + accessible
   FOR LOW COMPLEXITY: Use common vocabulary
   ALWAYS: Markers must be searchable and relevant to subspace

3. **Diversity Rule**:
   - No marker appears in multiple subspaces (global deduplication)
   - No subspace duplicates concepts from another
   - Total coverage: together they span the domain breadth

4. **Quantity Rule** (Adaptive):
   - Narrow domains: 3-4 subspaces minimum
   - Medium domains: 5-7 subspaces default
   - Broad domains: 7-8 subspaces maximum
   - Quality > quantity (3 excellent > 7 mediocre)

5. **Language Rule**:
   - Use lowercase for markers (except proper nouns, acronyms)
   - Use singular nouns where possible
   - Use consistent terminology
   - TECHNICAL domains: Accept acronyms (CNN, RNN, LSTM)
   - PRACTICAL domains: Spell out concepts

RESPONSE FORMAT:
- Return ONLY valid JSON array (no markdown, no explanation, no preamble)
- If you cannot confidently generate subspaces, return empty array: []
- If input is invalid/harmful, return: {"error": "Invalid input"}

CRITICAL RULES:
- ❌ Do NOT generate subspaces if domain is unclear
- ❌ Do NOT include vague markers ("concept", "idea", "advanced", "important")
- ❌ Do NOT duplicate markers across subspaces
- ✅ DO analyze input signals before generating
- ✅ DO adapt terminology and quantity to detected signals
- ✅ DO validate that each marker belongs semantically to its subspace`,

  advanced: `You are an expert knowledge architect designing comprehensive learning systems for advanced learners.

TASK: Create hierarchical semantic structure with learning paths.

INPUT:
- Space name: "{space_name}"
- Description: "{description}"
- User intent: "{intention}"
- Mode: "advanced"

STEP 1: DETECT USER SOPHISTICATION LEVEL

Academic/Research Signal:
  IF intention contains: ["research", "academic", "paper", "publish", "rigorous", "theoretical"]
    → Assume researcher; include theory, primary concepts, advanced references
    
Professional Signal:
  IF intention contains: ["apply", "implement", "production", "engineer", "system", "real-world"]
    → Assume professional; emphasize practical patterns, architectural concepts, tools

STEP 2: BUILD LEARNING HIERARCHY

Foundational Level: Essential concepts prerequisite to everything else
Intermediate Level: Builds on 1-2 foundational concepts
Advanced Level: Requires multiple prerequisites

STEP 3: GENERATE HIERARCHICAL OUTPUT

OUTPUT: JSON array with this structure:
[
  {
    "name": "Subspace Name",
    "depth": "foundational|intermediate|advanced",
    "description": "Why learners need this (1 sentence, 20 words max)",
    "markers": [...],
    "prerequisites": ["name of other subspace"],
    "suggested_study_order": 1
  }
]

ADAPTIVE RULES:

1. **For Researchers**: Include theoretical foundations + research frontiers
2. **For Professionals**: Include practical frameworks and patterns
3. **Learning Path Rules**:
   - Order 1-3: Foundational (everyone starts here)
   - Order 4-7: Intermediate (requires foundation)
   - Order 8+: Advanced (requires multiple prerequisites)
4. **Marker Complexity Scaling**:
   - Foundational: Basic concepts
   - Intermediate: Applied knowledge
   - Advanced: Specialized topics

RESPONSE FORMAT:
- Return ONLY valid JSON array
- Include all required fields (name, depth, markers, prerequisites, suggested_study_order)
- Empty prerequisites: [] (not null)
- Prerequisite names must exactly match other subspace names in output

CRITICAL RULES:
- ✅ DO adapt learning profile based on signals
- ✅ DO create realistic prerequisite chains
- ✅ DO adjust marker complexity to depth level
- ❌ Do NOT create impossible prerequisites
- ❌ Do NOT create circular dependencies`,

  fast: `You are a knowledge guide optimizing for quick onboarding without sacrificing quality.

TASK: Generate lightweight, essential semantic structure for fast learners.

INPUT:
- Space name: "{space_name}"
- Description: "{description}"
- User intent: "{intention}"
- Mode: "fast"

STEP 1: DETECT IF FAST MODE IS APPROPRIATE

Speed Signals:
  IF intention contains: ["quick", "fast", "intro", "overview", "basics", "getting started"]
    → Generate minimal essential concepts
    
Domain Complexity Signal:
  IF complex domain like "Quantum Computing"
    → Output: 4-5 subspaces (don't oversimplify)
  IF simple domain like "Coffee"
    → Output: 3-4 subspaces (truly minimal)

STEP 2: SELECT ESSENTIAL CONCEPTS ONLY

Essential = What someone MUST know to start learning independently

STEP 3: GENERATE MINIMAL STRUCTURE

OUTPUT: JSON array, 3-5 subspaces

QUALITY RULES:
  1. No duplicate markers across subspaces
  2. No vague markers ("concept", "idea", "advanced")
  3. Each marker must be actionable/searchable
  4. Markers must match subspace scope

RESPONSE FORMAT:
- Return ONLY valid JSON array
- Minimal structure: [{ "name": "...", "description": "...", "markers": [...] }]

CRITICAL RULES:
- ✅ DO remove non-essential subspaces
- ✅ DO keep marker count to 3-4
- ✅ DO use accessible language
- ✅ DO detect domain complexity and adjust
- ❌ Do NOT oversimplify complex domains
- ❌ Do NOT include advanced concepts`
};

export type PromptModeClassifierSource = 'semantic' | 'llm' | 'fallback';

export interface PromptModeClassification {
  mode: PromptMode;
  confidence: number;
  margin: number;
  source: PromptModeClassifierSource;
  scores: Record<PromptMode, number>;
}

export interface PromptModeClassifierOptions {
  lowConfidenceThreshold?: number;
  minMargin?: number;
  llmFallback?: (intention: string) => Promise<PromptMode | null>;
}

interface SemanticModel {
  idf: Map<string, number>;
  centroids: Record<PromptMode, Map<string, number>>;
}

const MODE_EXAMPLES: Record<PromptMode, string[]> = {
  advanced: [
    'I need deep research coverage for this topic and rigorous analysis.',
    'Help me learn the theoretical foundations and advanced concepts.',
    'I want academic depth with formal methods and detailed reasoning.',
    'Design an expert-level learning path for production architecture.',
    'I am preparing a paper and need comprehensive technical scope.',
  ],
  fast: [
    'Give me a quick overview and a beginner-friendly starting point.',
    'I only need the basics to get started quickly.',
    'Create a fast onboarding plan with essential concepts only.',
    'I want an intro-level breakdown in simple language.',
    'Help me learn this rapidly with a short practical roadmap.',
  ],
  standard: [
    'I want to learn this topic properly from start to finish.',
    'Build a balanced plan covering core concepts and applications.',
    'Help me understand this domain with moderate depth.',
    'I need structured learning with clear categories and useful markers.',
    'Create a complete but practical overview of this knowledge space.',
  ],
};

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how', 'i', 'in',
  'is', 'it', 'me', 'my', 'of', 'on', 'or', 'so', 'that', 'the', 'this', 'to', 'we',
  'with', 'want', 'need', 'help', 'learn', 'about', 'topic', 'please',
]);

const ADVANCED_KEYWORD_REGEX = /research|academic|paper|publish|rigorous|theoretical|deep|expert|architecture|formal|production/i;
const FAST_KEYWORD_REGEX = /quick|fast|intro|overview|basics|getting started|beginner|rapid|brief/i;

let semanticModelCache: SemanticModel | null = null;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeToken(token: string): string {
  const cleaned = token.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cleaned) {
    return '';
  }
  if (cleaned.length > 4 && cleaned.endsWith('ing')) {
    return cleaned.slice(0, -3);
  }
  if (cleaned.length > 3 && cleaned.endsWith('ed')) {
    return cleaned.slice(0, -2);
  }
  if (cleaned.length > 3 && cleaned.endsWith('s')) {
    return cleaned.slice(0, -1);
  }
  return cleaned;
}

function tokenize(text: string): string[] {
  const baseTokens = text
    .split(/\s+/)
    .map(normalizeToken)
    .filter(token => token && !STOP_WORDS.has(token));

  const bigrams: string[] = [];
  for (let i = 0; i < baseTokens.length - 1; i++) {
    bigrams.push(`${baseTokens[i]}_${baseTokens[i + 1]}`);
  }

  return [...baseTokens, ...bigrams];
}

function computeTf(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  if (!tokens.length) {
    return tf;
  }
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  for (const [token, count] of tf.entries()) {
    tf.set(token, count / tokens.length);
  }
  return tf;
}

function normalizeVector(vector: Map<string, number>): Map<string, number> {
  let normSquared = 0;
  for (const value of vector.values()) {
    normSquared += value * value;
  }
  const norm = Math.sqrt(normSquared);
  if (!norm) {
    return vector;
  }
  const normalized = new Map<string, number>();
  for (const [token, value] of vector.entries()) {
    normalized.set(token, value / norm);
  }
  return normalized;
}

function toTfidfVector(tokens: string[], idf: Map<string, number>): Map<string, number> {
  const tf = computeTf(tokens);
  const vector = new Map<string, number>();
  for (const [token, tfValue] of tf.entries()) {
    const idfValue = idf.get(token) || 0;
    if (!idfValue) {
      continue;
    }
    vector.set(token, tfValue * idfValue);
  }
  return normalizeVector(vector);
}

function cosineSimilarity(left: Map<string, number>, right: Map<string, number>): number {
  if (!left.size || !right.size) {
    return 0;
  }
  let dot = 0;
  for (const [token, leftValue] of left.entries()) {
    const rightValue = right.get(token);
    if (rightValue !== undefined) {
      dot += leftValue * rightValue;
    }
  }
  return clamp(dot, 0, 1);
}

function buildSemanticModel(): SemanticModel {
  const documents: Array<{ mode: PromptMode; tokens: string[] }> = [];
  const documentFrequency = new Map<string, number>();

  for (const mode of Object.keys(MODE_EXAMPLES) as PromptMode[]) {
    for (const example of MODE_EXAMPLES[mode]) {
      const tokens = tokenize(example);
      documents.push({ mode, tokens });
      const seen = new Set(tokens);
      for (const token of seen) {
        documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
      }
    }
  }

  const totalDocs = documents.length;
  const idf = new Map<string, number>();
  for (const [token, freq] of documentFrequency.entries()) {
    const score = Math.log((1 + totalDocs) / (1 + freq)) + 1;
    idf.set(token, score);
  }

  const sums: Record<PromptMode, Map<string, number>> = {
    advanced: new Map<string, number>(),
    fast: new Map<string, number>(),
    standard: new Map<string, number>(),
  };
  const counts: Record<PromptMode, number> = { advanced: 0, fast: 0, standard: 0 };

  for (const doc of documents) {
    const vector = toTfidfVector(doc.tokens, idf);
    counts[doc.mode] += 1;
    const bucket = sums[doc.mode];
    for (const [token, value] of vector.entries()) {
      bucket.set(token, (bucket.get(token) || 0) + value);
    }
  }

  const centroids: Record<PromptMode, Map<string, number>> = {
    advanced: new Map<string, number>(),
    fast: new Map<string, number>(),
    standard: new Map<string, number>(),
  };

  for (const mode of Object.keys(sums) as PromptMode[]) {
    const averaged = new Map<string, number>();
    const denominator = Math.max(counts[mode], 1);
    for (const [token, value] of sums[mode].entries()) {
      averaged.set(token, value / denominator);
    }
    centroids[mode] = normalizeVector(averaged);
  }

  return { idf, centroids };
}

function getSemanticModel(): SemanticModel {
  if (!semanticModelCache) {
    semanticModelCache = buildSemanticModel();
  }
  return semanticModelCache;
}

function getKeywordBoost(mode: PromptMode, text: string): number {
  if (!text) {
    return 0;
  }
  if (mode === 'advanced' && ADVANCED_KEYWORD_REGEX.test(text)) {
    return 0.08;
  }
  if (mode === 'fast' && FAST_KEYWORD_REGEX.test(text)) {
    return 0.08;
  }
  return 0;
}

function getTopTwoModes(scores: Record<PromptMode, number>): [PromptMode, PromptMode] {
  const sorted = (Object.entries(scores) as Array<[PromptMode, number]>)
    .sort((left, right) => right[1] - left[1]);
  return [sorted[0][0], sorted[1][0]];
}

function classifyPromptModeSemantic(intention?: string): PromptModeClassification {
  const text = (intention || '').trim();
  if (!text) {
    return {
      mode: 'standard',
      confidence: 0,
      margin: 0,
      source: 'fallback',
      scores: { advanced: 0, fast: 0, standard: 0 },
    };
  }

  const model = getSemanticModel();
  const intentVector = toTfidfVector(tokenize(text), model.idf);
  const rawScores: Record<PromptMode, number> = {
    advanced: cosineSimilarity(intentVector, model.centroids.advanced),
    fast: cosineSimilarity(intentVector, model.centroids.fast),
    standard: cosineSimilarity(intentVector, model.centroids.standard),
  };

  const boostedScores: Record<PromptMode, number> = {
    advanced: clamp(rawScores.advanced + getKeywordBoost('advanced', text), 0, 1),
    fast: clamp(rawScores.fast + getKeywordBoost('fast', text), 0, 1),
    standard: clamp(rawScores.standard, 0, 1),
  };

  const [bestMode, secondMode] = getTopTwoModes(boostedScores);
  const margin = clamp(boostedScores[bestMode] - boostedScores[secondMode], 0, 1);
  const confidence = clamp((boostedScores[bestMode] * 0.65) + (margin * 0.35), 0, 1);

  return {
    mode: bestMode,
    confidence,
    margin,
    source: 'semantic',
    scores: boostedScores,
  };
}

function isPromptMode(value: unknown): value is PromptMode {
  return value === 'standard' || value === 'advanced' || value === 'fast';
}

export async function classifyPromptMode(
  intention?: string,
  options: PromptModeClassifierOptions = {}
): Promise<PromptModeClassification> {
  const local = classifyPromptModeSemantic(intention);
  const text = (intention || '').trim();
  if (!text) {
    return local;
  }

  const threshold = options.lowConfidenceThreshold ?? 0.33;
  const minMargin = options.minMargin ?? 0.06;
  const isConfident = local.confidence >= threshold && local.margin >= minMargin;
  if (isConfident) {
    return local;
  }

  if (options.llmFallback) {
    try {
      const llmMode = await options.llmFallback(text);
      if (isPromptMode(llmMode)) {
        return {
          ...local,
          mode: llmMode,
          source: 'llm',
          confidence: clamp(Math.max(local.confidence, 0.51), 0, 1),
        };
      }
    } catch {
      // Ignore fallback errors and use deterministic local fallback.
    }
  }

  return {
    ...local,
    mode: 'standard',
    source: 'fallback',
  };
}

export function selectPromptMode(intention?: string): PromptMode {
  return classifyPromptModeSemantic(intention).mode;
}

export function formatPrompt(
  mode: PromptMode,
  spaceName: string,
  description?: string,
  intention?: string
): string {
  return GROQ_PROMPTS[mode]
    .replace('{space_name}', spaceName)
    .replace('{description}', description || '')
    .replace('{intention}', intention || `Learn comprehensive knowledge of ${spaceName}`);
}
