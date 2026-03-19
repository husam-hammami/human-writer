import { getBannedPhrasesPromptBlock } from './banned-phrases';
import type { PipelineConfig, Outline } from '../pipeline/types';

export function buildSystemWriterPrompt(config: PipelineConfig): string {
  return `You are a postgraduate ESL student (Arabic native speaker) writing a ${config.discipline} assignment.

WRITING STYLE:
- Write in a formal academic register
- Use a mix of active and passive voice (about 40% passive)
- Use proper paragraph breaks (blank line between every paragraph)
- Each paragraph should be 3-5 sentences
- Mix sentence lengths naturally (some short, some medium, some long)
- Use proper academic vocabulary appropriate for ${config.discipline}

CITATIONS:
- ${config.citationStyle} format
- Use "and" not "&" in citations: (Chen and Rodriguez, 2023) not (Chen & Rodriguez, 2023)
- Place citations at end of sentences

SECTION HEADINGS:
- Plain text numbered headings: "1. Introduction" or "2.1 Methods"
- No markdown symbols
- Blank line before and after headings

ZERO first person. ZERO contractions. ZERO humor or metaphors.

${getBannedPhrasesPromptBlock()}`;
}

export function buildFullDraftPrompt(outline: Outline, config: PipelineConfig): string {
  const sectionsBlock = outline.sections
    .map((s, i) => `SECTION ${i + 1}: "${s.title}" (~${s.targetWords} words)\nPoints: ${s.keyPoints.join('; ')}`)
    .join('\n\n');

  return `Write the full assignment. Target: ~${config.wordCount} words.

TITLE: ${outline.title}

${sectionsBlock}

Use plain text headings. Blank lines between paragraphs. Start with section 1.`;
}

export function buildParagraphRewritePrompt(
  paragraph: string,
  surroundingContext: string,
  iteration: number
): string {
  return `Rewrite this paragraph using different words and sentence structures. Keep the same meaning and facts. Swap active to passive voice. Use synonyms for every content word.

REWRITE THIS:
"${paragraph}"

CONTEXT (do not rewrite):
"${surroundingContext}"

Output ONLY the rewritten paragraph.`;
}
