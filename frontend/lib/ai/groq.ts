/**
 * Groq AI Client — OpenAI-compatible REST integration
 * Model: meta-llama/llama-4-maverick-17b-128e-instruct
 */

import { formatPrompt, selectPromptMode, type PromptMode, type SubspaceWithMarkers } from './groq-prompts';
import { validateGeminiOutput } from './validation';

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

  // Auto-select mode based on intention
  const mode = options.mode || selectPromptMode(options.intention);
  console.log('🎯 Selected prompt mode:', mode);
  
  // Format the prompt with user inputs
  const prompt = formatPrompt(
    mode,
    options.spaceName,
    options.description,
    options.intention
  );

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
        content: prompt,
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
          console.log(`Gemini API temporarily unavailable (${response.status}). Retrying in ${delay}ms...`);
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
      let jsonText = generatedText.trim();
      
      // Remove markdown code blocks if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch (error) {
        console.error('Failed to parse Groq response:', jsonText);
        throw new Error(`Invalid JSON from Groq: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Validate output quality
      const validated = validateGeminiOutput(parsed, mode);

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
