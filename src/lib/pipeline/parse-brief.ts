import { getAnthropicClient } from '../anthropic';
import { buildBriefParserPrompt } from '../prompts/brief-parser';
import type { ParsedBrief } from './types';

export async function parseBrief(briefText: string): Promise<ParsedBrief> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: buildBriefParserPrompt(),
    messages: [
      {
        role: 'user',
        content: `Parse this assignment brief:\n\n${briefText}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // Extract JSON from response (handle potential markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse brief: no JSON found in response');
  }

  const parsed = JSON.parse(jsonMatch[0]) as ParsedBrief;
  return parsed;
}
