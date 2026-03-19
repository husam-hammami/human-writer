import { getAnthropicClient } from '../anthropic';
import { buildSystemWriterPrompt, buildFullDraftPrompt } from '../prompts/system-writer';
import type { Outline, PipelineConfig } from './types';

export async function generateDraft(
  outline: Outline,
  config: PipelineConfig,
  apiKey?: string,
): Promise<string> {
  const client = getAnthropicClient(apiKey);
  const temperature = config.temperature ?? 0.85;
  const systemPrompt = buildSystemWriterPrompt(config);
  const userPrompt = buildFullDraftPrompt(outline, config);
  const estimatedTokens = Math.min(16384, Math.max(4096, Math.ceil(config.wordCount * 1.5)));

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: estimatedTokens,
    temperature,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  return (response.content[0].type === 'text' ? response.content[0].text : '').trim();
}

export async function generateLongDraft(
  outline: Outline,
  config: PipelineConfig,
  onProgress?: (phase: string) => void,
  apiKey?: string,
): Promise<string> {
  if (config.wordCount <= 6000) return generateDraft(outline, config, apiKey);

  const totalWords = config.wordCount;
  const midpoint = Math.ceil(outline.sections.length / 2);
  const firstHalf: Outline = { title: outline.title, sections: outline.sections.slice(0, midpoint), totalWords: Math.ceil(totalWords / 2) };
  const secondHalf: Outline = { title: outline.title, sections: outline.sections.slice(midpoint), totalWords: totalWords - Math.ceil(totalWords / 2) };

  onProgress?.('Generating first half...');
  const firstDraft = await generateDraft(firstHalf, { ...config, wordCount: Math.ceil(totalWords / 2) }, apiKey);
  const overlapContext = firstDraft.split(/\s+/).slice(-120).join(' ');

  onProgress?.('Generating second half...');
  const client = getAnthropicClient(apiKey);
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16384,
    temperature: config.temperature ?? 0.85,
    system: buildSystemWriterPrompt(config),
    messages: [{ role: 'user', content: `Continue from previous sections (DO NOT repeat):\n---\n${overlapContext}\n---\n\n${buildFullDraftPrompt(secondHalf, { ...config, wordCount: totalWords - Math.ceil(totalWords / 2) })}` }],
  });

  return firstDraft + '\n\n' + (response.content[0].type === 'text' ? response.content[0].text : '').trim();
}
