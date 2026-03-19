import { getAnthropicClient } from '../anthropic';
import type { ParsedBrief, Outline, PipelineConfig } from './types';

export async function generateOutline(
  brief: ParsedBrief,
  config: PipelineConfig,
  apiKey?: string,
): Promise<Outline> {
  const client = getAnthropicClient(apiKey);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: `You are an academic writing planner. Create a detailed outline for an assignment.

CRITICAL RULES:
1. Vary section lengths -- some should be 60% of average, others 140%
2. The structure should feel slightly asymmetric and organic, not perfectly balanced
3. Include all sections required by the assignment brief
4. Use numbered section format (1., 1.1, 2., 2.1, etc.)

Return a JSON object:
{
  "title": "assignment title",
  "sections": [
    {
      "title": "Section Name",
      "targetWords": 350,
      "keyPoints": ["point 1", "point 2", "point 3"],
      "order": 1
    }
  ],
  "totalWords": 3500
}

Return ONLY the JSON. No other text.`,
    messages: [
      {
        role: 'user',
        content: `Create an outline for this assignment:

Title: ${brief.title}
Discipline: ${brief.discipline || config.discipline}
Target word count: ${config.wordCount}
Required sections: ${brief.sections.join(', ')}
Key topics: ${brief.keyTopics.join(', ')}
Rubric criteria: ${brief.rubricCriteria.map(c => `${c.criterion} (weight: ${c.weight})`).join(', ')}

Requirements:
${brief.requirements.map(r => `- ${r}`).join('\n')}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to generate outline: no JSON found');
  }

  const outline = JSON.parse(jsonMatch[0]) as Outline;
  return outline;
}
