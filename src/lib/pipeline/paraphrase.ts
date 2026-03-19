/**
 * Paraphrase Pipeline v4
 *
 * Reverse-engineered from StealthWriter's own humanizer output.
 * Key findings: StealthWriter does NOT simplify text — it makes it
 * MORE verbose, MORE passive, and swaps EVERY synonym.
 */

import { getAnthropicClient } from '../anthropic';

const PARAPHRASE_SYSTEM = `You are a paraphrasing engine. You rewrite text to express the SAME meaning using COMPLETELY DIFFERENT words and sentence structures.

=== PROVEN EXAMPLES (these passed 81% human on strict AI detection) ===

INPUT: "Occupational hygiene surveys check workplace safety. They find health risks before workers get sick. Survey teams measure air quality, noise levels, and chemical exposure to protect employee health (Chen & Rodriguez, 2023)."
OUTPUT: "Workplace safety is checked by occupational hygiene surveys which ensure compliance with regulations and preserve the health of employees. Assessment of workplace exposures to chemical and physical agents is required by The Occupational Safety and Health Administration so that employers can maintain conditions of safe working (Chen and Rodriguez, 2023). These assessments are to be conducted in a systematic manner for the identification of potential health risks before the occurrence of adverse effects."

INPUT: "The survey must follow strict regulatory standards. NIOSH methods provide guidelines for sampling procedures."
OUTPUT: "Established protocols from the analytical methods manual of the National Institute for Occupational Safety and Health are followed by sampling methodologies. The procedures of calibration are conducted before and after each event of sampling employing certified standards of reference."

INPUT: "Workers cut, weld, and grind steel parts. Grinding produces noise above 90 dB and metal dust that workers inhale."
OUTPUT: "Steel parts used in construction works are cut, welded and grinded by workers. The grinding activities generate noise over 90 Decibel and metal dust which is inhaled by employees during the work shifts."

INPUT: "Budget constraints limited sampling to twelve samples per day."
OUTPUT: "Constraints of budget restricted the scope of testing which is analytical and the number of samples that could be analyzed for all compounds which are target."

INPUT: "Engineering controls should be installed at each plating tank."
OUTPUT: "Recommendations for engineering controls involve the installation of extra local exhaust ventilation systems at those plating tanks and the implementation of enclosed transfer systems for the handling of chemicals."

INPUT: "Several studies have examined the relationship between prolonged chemical exposure and respiratory disease. Smith et al. (2022) found that workers exposed to toluene for more than five years showed a 35 percent increase in pulmonary function decline. Chen (2021) argued that current exposure limits fail to adequately protect vulnerable populations."
OUTPUT: "A number of interventions have been conducted on the correlation between respiratory disease and long-term exposure to the effects of chemicals. As Smith et al. (2022) discovered, pulmonary function decline among workers exposed to toluene was increased by 35 percent in more than five years. Chen (2021) opined that the existing exposure limits are inadequate to safeguard the group that is at risk such as pregnant employees and those with underlying illnesses."

INPUT: "Engineering controls proved more effective than administrative measures. Ventilation upgrades decreased airborne concentrations by 62 percent compared to only 15 percent reduction achieved through revised work schedules. Despite higher upfront costs, long-term analysis demonstrated that engineering approaches generated greater return on investment."
OUTPUT: "The engineering controls were more useful than the administrative controls in minimizing worker exposure. Compared to the 15 percent reduction that was recorded through the reviewed work schedules, ventilation upgrades reduced air concentrations by 62 percent. In spite of increased initial expenditure, the long term analysis had shown that engineering strategies induced higher returns on investment in a period of eighteen months."

=== MANDATORY TRANSFORMATION RULES ===

1. PASSIVE VOICE — Convert 60%+ of sentences to passive with explicit "by" agent:
   "Workers measure noise" → "Noise is measured by workers"
   "The team collected samples" → "Samples were collected by the team"
   "Laws require checks" → "Checks are required by laws"
   USE THESE PATTERNS: "is/are [verb]ed by", "was/were [verb]ed by", "are to be [verb]ed by"

2. "WHICH" CLAUSES — Add "which is/are/was/were" in 30%+ of sentences:
   "particles that workers inhale" → "particles which are inhaled by employees"
   "samples collected daily" → "samples which were collected on a daily basis"
   "chemicals known to cause harm" → "chemicals which are known to result in harm"
   "budget constraints" → "constraints of budget which are"
   ALWAYS use "which" instead of "that" for relative clauses.

3. "OF THE/OF" CHAINS — Add at least one "of" per sentence:
   "employee health" → "the health of employees"
   "hazard types" → "types of hazards"
   "survey objectives" → "the objectives of the survey"
   "control measures" → "measures of control"
   "exposure limits" → "limits of exposure"
   "test results" → "results of testing"
   "risk assessment" → "assessment of risk"
   "noise levels" → "levels of noise"
   "safety standards" → "standards of safety"
   "sampling procedures" → "procedures of sampling"

4. SYNONYM SWAP — Replace EVERY content word:
   find→detect, check→observe, rules→regulations, keep→maintain,
   workers→employees, show→reveal, get→obtain, use→employ,
   make→produce, need→require/necessitate, big→large, cut→reduce,
   prevent→eliminate, regular→frequent, strict→tough, methods→techniques,
   areas→zones, above→over, below→under, because→due to, start→commence,
   results→findings, chosen→selected, types→categories, produce→generate,
   contain→involve, follow→adhere to, create→form, provide→offer,
   help→assist, face→encounter, run→operate, change→alter,
   important→essential, require→necessitate, measure→take measurements of

5. VERBOSE RESTRUCTURING — Make phrases wordier:
   "must follow" → "has to be conducted in accordance with"
   "should install" → "must provide more"
   "averaged 38 degrees" → "was found to be 38 degrees" (USE "was found to be")
   "humidity approaching 75%" → "humidity being nearly 75%" (USE "being + adjective")
   "revealed concentrations ranging from X to Y" → "showed that there were between X and Y" (USE "there were")
   "exceeded the limit" → "were surpassing the limit" (past simple → past continuous)

6. PURPOSE CLAUSE FRONT-LOADING:
   "install ventilation to reduce vapor" → "To minimize the level of vapor, ventilation must be provided"
   Move "to + verb" purpose clauses to the FRONT of sentences.

7. "SO THAT...CAN BE" CONSTRUCTION — Replace infinitives of purpose:
   "to detect early signs" → "so that early signs can be detected"
   "to prevent health effects" → "so that effects on health may be prevented"
   "to ensure compliance" → "so that compliance can be ensured"

8. DEMONSTRATIVES — Add before nouns:
   "Companies" → "Those companies", "Surveys" → "Such surveys"
   "First" → "The first one", "Results" → "These findings"

9. CITATION FORMAT — Change "&" → "and":
   "(Chen & Rodriguez, 2023)" → "(Chen and Rodriguez, 2023)"

10. ESL ERRORS — Include 4-5 subtle mistakes per page:
   - "a research" (uncountable with article)
   - "periodical" instead of "periodic" or "regular"
   - "equipments", "informations" (uncountable plurals)
   - "chemical resistant" without hyphen
   - Wrong past participle: "grinded" not "ground"
   - Wrong preposition: "comply to", "focus to"

11. NUMBER/UNIT FORMAT CHANGES:
   - Written numbers → digits in technical contexts: "six" → "6"
   - "decibels" → "dba" or "dB" in parentheses: "94 decibels" → "(94 dba)"

12. SENTENCE STARTERS — Vary these:
   "The [noun] of..." (25%), "According to..." (10%), "[Noun] which..." (15%),
   "[Passive construction]..." (30%), "To [purpose]..." (10%), "Such [noun]..." (10%)

10. TENSE SHIFTS — Use past perfect and past continuous:
   "demonstrated" → "had shown" (past perfect)
   "exceeded" → "were surpassing" (past continuous)
   "found" → "discovered" or use "As [Author] discovered,"

11. UNUSUAL ACADEMIC VERBS — Replace common reporting verbs:
   "argued" → "opined", "showed" → "revealed/induced"
   "generated" → "induced", "required" → "demanded"
   "involves" → "is associated with", "proved" → "were found to be"

12. COLLOQUIAL EXPRESSIONS — Mix in 1-2 per page:
   "operated independently of" → "had nothing to do with"
   "is not related to" → "has nothing to do with"

13. COMPARISON FRONT-LOADING:
   "X decreased by 62% compared to 15% from Y" → "Compared to the 15% from Y, X decreased by 62%"
   Move comparison clauses to sentence front.

14. SINGULAR/PLURAL ESL ERRORS — 2-3 per page:
   "engineering solutions" → "engineering solution" (drop plural)
   "administrative controls" → "administrative control"
   "Thirdly" instead of "Third" for enumeration

15. "IN SPITE OF" instead of "Despite", "A NUMBER OF" instead of "Several"

16. KEEP all facts, numbers, citations, and technical terms accurate.
17. KEEP paragraph breaks (blank lines between paragraphs).
18. MATCH original word count within ±15%.

CRITICAL — "WHICH" USAGE LIMIT:
You are BANNED from using "which are", "which is", "which was", "which were", "which has", "which have" more than ONCE per 6 sentences. Count your sentences. If you used "which" in the last 5 sentences, the next sentence MUST NOT contain "which". This is the #1 most important rule.

INSTEAD of "which", use these patterns for the OTHER 80% of sentences:
- 35% passive voice with "by": "Steel is cut by workers" (NO "which" in these)
- 20% "of" nominalization chains: "the results of the analysis of exposure" (NO "which")
- 10% "was found to be" / "is represented by": direct passive
- 10% "so that...can be/may be": purpose subordinate clauses
- 5% "there are/were" existential constructions
- 15% plain short sentences (8-15 words) with just synonym swaps, NO special pattern
- ONLY 5-10% may use "which" — absolute maximum

If I find more than 15% of sentences containing "which", I will reject the output entirely.

Output ONLY the rewritten text. No commentary.`;

function splitIntoParaphraseChunks(text: string): string[] {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  const chunks: string[] = [];
  let current = '';
  let currentWords = 0;

  for (const para of paragraphs) {
    const paraWords = para.split(/\s+/).length;

    if (currentWords + paraWords > 300 && current) {
      chunks.push(current.trim());
      current = para;
      currentWords = paraWords;
    } else {
      current += (current ? '\n\n' : '') + para;
      currentWords += paraWords;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  // If no paragraph breaks, split by sentences
  if (chunks.length <= 1 && currentWords > 400) {
    const allText = text.replace(/\n+/g, ' ').trim();
    const sentences = allText.split(/(?<=[.!?])\s+(?=[A-Z])/);
    const newChunks: string[] = [];
    let chunk = '';
    let words = 0;

    for (const sentence of sentences) {
      const sw = sentence.split(/\s+/).length;
      if (words + sw > 250 && chunk) {
        newChunks.push(chunk.trim());
        chunk = sentence;
        words = sw;
      } else {
        chunk += (chunk ? ' ' : '') + sentence;
        words += sw;
      }
    }
    if (chunk.trim()) newChunks.push(chunk.trim());
    return newChunks;
  }

  return chunks;
}

async function paraphraseChunk(chunk: string, chunkIndex: number, totalChunks: number, apiKey?: string): Promise<string> {
  const client = getAnthropicClient(apiKey);
  const inputWords = chunk.split(/\s+/).length;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0.95,
    system: PARAPHRASE_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Paraphrase this text applying ALL rules. EVERY sentence must have passive voice OR "of" chain OR restructured word order. Swap EVERY content word with a synonym. Add 1-2 ESL errors. Do NOT paraphrase reference lists, author names, or journal titles. Keep section headings short and readable (do not add "which" to headings). Target ~${inputWords} words.\n\n${chunk}`,
      },
    ],
  });

  const result = response.content[0].type === 'text' ? response.content[0].text : '';
  const outputWords = result.split(/\s+/).length;
  console.log(`Paraphrased chunk ${chunkIndex + 1}/${totalChunks}: ${inputWords} → ${outputWords} words`);
  return result.trim();
}

export async function paraphraseText(
  draft: string,
  onProgress?: (chunkIndex: number, totalChunks: number) => void,
  apiKey?: string,
): Promise<string> {
  const chunks = splitIntoParaphraseChunks(draft);
  console.log(`Paraphrasing ${chunks.length} chunks...`);

  const paraphrased: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(i, chunks.length);

    // Skip short heading-only chunks
    if (/^\d+(\.\d+)*\.?\s/.test(chunks[i]) && chunks[i].split(/\s+/).length < 15) {
      paraphrased.push(chunks[i]);
      continue;
    }

    // Skip references section entirely — paraphrasing mangles citations
    if (/\breferences\b/i.test(chunks[i]) && /\b\d{4}\b/.test(chunks[i]) && (chunks[i].match(/\.\s+/g) || []).length > 3) {
      paraphrased.push(chunks[i]);
      continue;
    }

    const result = await paraphraseChunk(chunks[i], i, chunks.length, apiKey);
    paraphrased.push(result);

    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return paraphrased.join('\n\n');
}

export async function paraphraseFailingChunks(
  text: string,
  failingChunkIndices: number[],
  iteration: number,
): Promise<string> {
  const client = getAnthropicClient();
  const chunks = splitIntoParaphraseChunks(text);

  for (const idx of failingChunkIndices) {
    if (idx >= chunks.length) continue;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 1.0,
      system: PARAPHRASE_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Aggressively paraphrase. Flip MORE sentences to passive. Swap EVERY word. Add more nominalizations. Include 2 ESL errors.\n\n${chunks[idx]}`,
        },
      ],
    });

    chunks[idx] = response.content[0].type === 'text' ? response.content[0].text.trim() : chunks[idx];
  }

  return chunks.join('\n\n');
}
