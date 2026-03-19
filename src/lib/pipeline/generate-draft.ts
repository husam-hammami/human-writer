import { getAnthropicClient } from '../anthropic';
import { buildSystemWriterPrompt, buildFullDraftPrompt } from '../prompts/system-writer';
import type { Outline, PipelineConfig } from './types';

/**
 * Generate the full assignment draft in a single Claude call.
 * Single-pass generation maintains voice consistency across the entire document.
 */
export async function generateDraft(
  outline: Outline,
  config: PipelineConfig,
): Promise<string> {
  const client = getAnthropicClient();
  const temperature = config.temperature ?? 0.85;

  const systemPrompt = buildSystemWriterPrompt(config);
  const userPrompt = buildFullDraftPrompt(outline, config);

  // Calculate appropriate max_tokens based on target word count
  // Rough estimate: 1 word ≈ 1.3 tokens, plus buffer
  const estimatedTokens = Math.min(16384, Math.max(4096, Math.ceil(config.wordCount * 1.5)));

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: estimatedTokens,
    temperature,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userPrompt },
    ],
  });

  const content = response.content[0].type === 'text' ? response.content[0].text : '';
  return content.trim();
}

/**
 * For very long assignments (>6000 words), split into two calls with overlap context.
 */
export async function generateLongDraft(
  outline: Outline,
  config: PipelineConfig,
  onProgress?: (phase: string) => void,
): Promise<string> {
  const totalWords = config.wordCount;

  if (totalWords <= 6000) {
    return generateDraft(outline, config);
  }

  // Split outline into two halves
  const midpoint = Math.ceil(outline.sections.length / 2);
  const firstHalf: Outline = {
    title: outline.title,
    sections: outline.sections.slice(0, midpoint),
    totalWords: Math.ceil(totalWords / 2),
  };

  const secondHalf: Outline = {
    title: outline.title,
    sections: outline.sections.slice(midpoint),
    totalWords: totalWords - Math.ceil(totalWords / 2),
  };

  // Generate first half
  onProgress?.('Generating first half...');
  const firstConfig = { ...config, wordCount: Math.ceil(totalWords / 2) };
  const firstDraft = await generateDraft(firstHalf, firstConfig);

  // Extract last 500 words for context overlap
  const words = firstDraft.split(/\s+/);
  const overlapContext = words.slice(-120).join(' ');

  // Generate second half with context
  onProgress?.('Generating second half...');
  const client = getAnthropicClient();
  const systemPrompt = buildSystemWriterPrompt(config);
  const userPrompt = buildFullDraftPrompt(secondHalf, {
    ...config,
    wordCount: totalWords - Math.ceil(totalWords / 2),
  });

  const contextPrompt = `IMPORTANT: Continue from where the previous sections ended. Here are the last few paragraphs for voice and flow continuity (DO NOT repeat this content):

---
${overlapContext}
---

${userPrompt}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16384,
    temperature: config.temperature ?? 0.85,
    system: systemPrompt,
    messages: [
      { role: 'user', content: contextPrompt },
    ],
  });

  const secondDraft = response.content[0].type === 'text' ? response.content[0].text : '';

  return firstDraft + '\n\n' + secondDraft.trim();
}
