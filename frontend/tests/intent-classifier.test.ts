import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyPromptMode, selectPromptMode } from '../lib/ai/groq-prompts';

test('selects advanced mode for research-heavy intention', async () => {
  const result = await classifyPromptMode(
    'I need deep research coverage with rigorous theoretical analysis and formal methods.'
  );
  assert.equal(result.mode, 'advanced');
  assert.ok(result.confidence > 0.3);
  assert.equal(result.source, 'semantic');
});

test('selects fast mode for quick-start intention', async () => {
  const result = await classifyPromptMode(
    'Give me a quick beginner intro and just the basics to get started fast.'
  );
  assert.equal(result.mode, 'fast');
  assert.ok(result.confidence > 0.3);
  assert.equal(result.source, 'semantic');
});

test('uses deterministic fallback for low-confidence intention', async () => {
  const result = await classifyPromptMode('Map this topic for me.');
  assert.equal(result.mode, 'standard');
  assert.equal(result.source, 'fallback');
});

test('uses llm fallback when local confidence is low', async () => {
  let fallbackCalls = 0;
  const result = await classifyPromptMode('Map this topic for me.', {
    llmFallback: async () => {
      fallbackCalls += 1;
      return 'advanced';
    },
  });

  assert.equal(fallbackCalls, 1);
  assert.equal(result.mode, 'advanced');
  assert.equal(result.source, 'llm');
});

test('falls back to standard if llm fallback returns invalid mode', async () => {
  const result = await classifyPromptMode('Map this topic for me.', {
    llmFallback: async () => null,
  });
  assert.equal(result.mode, 'standard');
  assert.equal(result.source, 'fallback');
});

test('sync selector remains deterministic', () => {
  assert.equal(
    selectPromptMode('I want a quick overview to get started'),
    'fast'
  );
  assert.equal(
    selectPromptMode('I am doing rigorous academic research in this area'),
    'advanced'
  );
});
