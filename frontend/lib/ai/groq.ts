/**
 * Groq AI Client — OpenAI-compatible REST integration
 * Model: meta-llama/llama-4-maverick-17b-128e-instruct
 */

import {
  classifyPromptMode,
  formatPrompt,
  type PromptMode,
  type SubspaceWithMarkers,
} from './groq-prompts';
import {
  MODE_MARKER_LIMITS,
  applyMarkerRepairs,
  validateGroqOutput,
} from './validation';

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;
const GROQ_MODEL = 'meta-llama/llama-4-maverick-17b-128e-instruct';

interface GroqGenerateOptions {
  spaceName: string;
  description?: string;
  intention?: string;
  mode?: PromptMode;
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface GroqChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string | null;
  }>;
}

interface MarkerRepairRequest {
  name: string;
  description?: string;
  markers: Array<{ text: string; weight: number }>;
  needed: number;
}

function stripCodeFences(content: string): string {
  let text = content.trim();
  if (text.startsWith('```json')) {
    text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return text;
}

function parseModeFromClassifierOutput(content: string): PromptMode | null {
  const cleaned = stripCodeFences(content);
  try {
    const parsed = JSON.parse(cleaned) as { mode?: string };
    const mode = parsed?.mode?.toLowerCase();
    if (mode === 'advanced' || mode === 'fast' || mode === 'standard') {
      return mode;
    }
  } catch {
    const match = cleaned.match(/\b(advanced|fast|standard)\b/i);
    if (match?.[1]) {
      return match[1].toLowerCase() as PromptMode;
    }
  }
  return null;
}

async function classifyPromptModeWithGroq(intention: string): Promise<PromptMode | null> {
  if (!GROQ_API_KEY) {
    return null;
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'Classify user intent for prompt style routing. Return ONLY JSON: {"mode":"advanced|standard|fast"}.',
        },
        {
          role: 'user',
          content: `Classify this intention: "${intention}"`,
        },
      ],
      temperature: 0,
      top_p: 1,
      max_tokens: 30,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data: GroqChatResponse = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    return null;
  }

  return parseModeFromClassifierOutput(content);
}

function buildStrictMarkerInstruction(mode: PromptMode): string {
  const limits = MODE_MARKER_LIMITS[mode];
  return `Hard constraint: each subspace must have ${limits.min}-${limits.max} unique markers after deduplication.`;
}

function getMissingMarkerPlan(
  subspaces: SubspaceWithMarkers[],
  mode: PromptMode
): MarkerRepairRequest[] {
  const minMarkers = MODE_MARKER_LIMITS[mode].min;
  return subspaces
    .map((subspace) => ({
      ...subspace,
      needed: Math.max(0, minMarkers - subspace.markers.length),
    }))
    .filter((subspace) => subspace.needed > 0);
}

function parseRepairResponse(content: string): Record<string, string[]> {
  const cleaned = stripCodeFences(content);
  const parsed = JSON.parse(cleaned) as Array<{ name?: string; markers?: string[] }>;
  if (!Array.isArray(parsed)) {
    throw new Error('Repair output must be an array');
  }

  const result: Record<string, string[]> = {};
  for (const row of parsed) {
    if (!row || typeof row !== 'object' || !row.name || !Array.isArray(row.markers)) {
      continue;
    }
    result[row.name.toLowerCase().trim()] = row.markers;
  }
  return result;
}

async function repairUnderfilledMarkers(
  subspaces: SubspaceWithMarkers[],
  mode: PromptMode
): Promise<SubspaceWithMarkers[]> {
  const repairPlan = getMissingMarkerPlan(subspaces, mode);
  if (repairPlan.length === 0) {
    return subspaces;
  }

  const limits = MODE_MARKER_LIMITS[mode];
  const usedMarkers = Array.from(
    new Set(subspaces.flatMap((s: SubspaceWithMarkers) => s.markers.map((m) => m.text.toLowerCase().trim())))
  );

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You generate missing markers for subspaces. Return ONLY JSON array: [{"name":"...","markers":["..."]}] with unique, domain-specific markers.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'repair_markers',
            mode,
            marker_limits: limits,
            used_markers: usedMarkers,
            subspaces_needing_markers: repairPlan.map((item) => ({
              name: item.name,
              description: item.description || '',
              existing_markers: item.markers.map(m => m.text),
              needed_new_markers: item.needed,
            })),
            rules: [
              'Provide exactly needed_new_markers or more for each row.',
              'Do not repeat any marker already in used_markers.',
              'Use concise lowercase marker phrases.',
              'No generic markers like concept, idea, important, relevant.',
            ],
          }),
        },
      ],
      temperature: 0.2,
      top_p: 0.9,
      max_tokens: 700,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Marker repair failed: ${response.status} - ${body}`);
  }

  const data: GroqChatResponse = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Marker repair returned no content');
  }

  const repairs = parseRepairResponse(content);
  return applyMarkerRepairs(subspaces, repairs, mode);
}

/**
 * Generate subspaces and markers using Groq with retry logic
 */
export async function generateSubspacesWithMarkers(
  options: GroqGenerateOptions,
  retries = 2
): Promise<SubspaceWithMarkers[]> {
  console.log('🔑 Groq API Key present:', !!GROQ_API_KEY);
  console.log('🔑 Key length:', GROQ_API_KEY?.length || 0);

  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not configured. Check NEXT_PUBLIC_GROQ_API_KEY in .env.local');
  }

  // Auto-select mode based on intention using semantic classifier + LLM fallback.
  const modeClassification = options.mode
    ? { mode: options.mode, source: 'explicit', confidence: 1 }
    : await classifyPromptMode(options.intention, {
      llmFallback: classifyPromptModeWithGroq,
    });
  const mode = modeClassification.mode;
  console.log(
    '🎯 Selected prompt mode:',
    mode,
    `source=${modeClassification.source}`,
    `confidence=${modeClassification.confidence.toFixed(2)}`
  );

  // Format the prompt with user inputs
  const prompt = formatPrompt(
    mode,
    options.spaceName,
    options.description,
    options.intention
  );
  const strictInstruction = buildStrictMarkerInstruction(mode);

  const apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
  const requestBody = {
    model: GROQ_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are a precise knowledge architect. Return ONLY valid JSON (no markdown). Use the user prompt as instructions and do not add commentary.',
      },
      {
        role: 'user',
        content: `${prompt}\n\n${strictInstruction}`,
      },
    ],
    temperature: 0.6,
    top_p: 0.9,
    max_tokens: 2048,
  };

  // Retry loop with exponential backoff
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Call Groq API
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Check if it's a retryable error (503, 429, 500)
        const isRetryable = [503, 429, 500].includes(response.status);

        if (isRetryable && attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.log(`Groq API temporarily unavailable (${response.status}). Retrying in ${delay}ms...`);
          await sleep(delay);
          continue; // Retry
        }

        // Non-retryable error or out of retries
        throw new Error(`Groq API error: ${response.status} - ${errorText}`);
      }

      const data: GroqChatResponse = await response.json();

      // Extract generated text
      const generatedText = data.choices?.[0]?.message?.content;

      if (!generatedText) {
        throw new Error('No content generated from Groq');
      }

      // Parse JSON from response (handle markdown code blocks)
      const jsonText = stripCodeFences(generatedText);

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch (error) {
        console.error('Failed to parse Groq response:', jsonText);
        throw new Error(`Invalid JSON from Groq: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Stage 1: relaxed validation so we can repair marker coverage.
      const relaxed = validateGroqOutput(parsed, mode, { enforceMarkerMinimum: false });

      // Stage 2: repair missing markers and then enforce strict mode minima.
      const repaired = await repairUnderfilledMarkers(relaxed, mode);
      const validated = validateGroqOutput(repaired, mode, { enforceMarkerMinimum: true });

      return validated; // Success - exit retry loop

    } catch (error) {
      // If not retryable or last attempt, throw
      if (attempt === retries) {
        throw error;
      }
      // Otherwise, continue to next retry attempt
    }
  }

  // Should never reach here
  throw new Error('Unexpected error in generateSubspacesWithMarkers');
}

/**
 * Generate subspaces and markers using Groq - no fallback
 */
export async function generateWithFallback(
  options: GroqGenerateOptions
): Promise<SubspaceWithMarkers[]> {
  // Just call the main generation function - let it fail if it fails
  return await generateSubspacesWithMarkers(options);
}
