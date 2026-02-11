/**
 * Gemini AI Prompts v2.1 - Multi-Factor Adaptive
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

export const GEMINI_PROMPTS = {
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

export function selectPromptMode(intention?: string): PromptMode {
  const lowerIntent = intention?.toLowerCase() || '';
  
  // Research/academic users
  if (/research|academic|paper|publish|rigorous|theoretical|deep understanding/i.test(lowerIntent)) {
    return 'advanced';
  }
  
  // Speed/quick learners
  if (/quick|fast|intro|overview|basics|getting started|beginner/i.test(lowerIntent)) {
    return 'fast';
  }
  
  // Default: Standard (handles most cases)
  return 'standard';
}

export function formatPrompt(
  mode: PromptMode,
  spaceName: string,
  description?: string,
  intention?: string
): string {
  return GEMINI_PROMPTS[mode]
    .replace('{space_name}', spaceName)
    .replace('{description}', description || '')
    .replace('{intention}', intention || `Learn comprehensive knowledge of ${spaceName}`);
}
