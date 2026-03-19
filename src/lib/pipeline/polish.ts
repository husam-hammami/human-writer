/**
 * Programmatic Post-Processor v3
 *
 * Optimized based on stealthwriter.ai strict mode analysis:
 * - Only 3-8 word sentences passed as human
 * - Every sentence >12 words was flagged AI
 * - Token-level probability is the primary signal
 *
 * Strategy: Break everything into choppy fragments + inject unexpected words
 */

import { BANNED_PHRASES, PHRASE_REPLACEMENTS } from '../prompts/banned-phrases';
import type { PolishResult, PolishChange } from './types';

function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

function splitSentences(text: string): string[] {
  let temp = text;
  const abbrevs: string[] = [];
  temp = temp.replace(/(?:Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|etc|vs|e\.g|i\.e|al|Fig|Vol|No|pp|ed|Ltd|Inc|Corp|U\.S|U\.K)\./gi, (match) => {
    abbrevs.push(match);
    return `__ABBREV${abbrevs.length - 1}__`;
  });
  temp = temp.replace(/(\d)\.(\d)/g, '$1__DOT__$2');

  const parts = temp.split(/(?<=[.!?])\s+(?=[A-Z"(])/);
  return parts.map(part => {
    let restored = part;
    restored = restored.replace(/__ABBREV(\d+)__/g, (_, idx) => abbrevs[parseInt(idx)]);
    restored = restored.replace(/__DOT__/g, '.');
    return restored.trim();
  }).filter(s => s.length > 0);
}

// ─── Pass 1: Markdown to Plain Text ──────────────────────────────────

function passMarkdownClean(text: string, changes: PolishChange[]): string {
  let result = text;
  let count = 0;

  // Remove all markdown heading markers
  result = result.replace(/^#{1,4}\s*/gm, () => { count++; return ''; });

  // Ensure headings (lines starting with numbers like "1." "2.1") have blank lines around them
  result = result.replace(/\n?(\d+(\.\d+)*\.?\s+[A-Z][^\n]{3,80})\n?/g, '\n\n$1\n\n');

  if (count > 0) {
    changes.push({ pass: 'markdownClean', original: `${count} markers`, replacement: 'removed', position: 0 });
  }
  return result;
}

// ─── Pass 2: Banned Phrase Strip ─────────────────────────────────────

function passBannedPhraseStrip(text: string, changes: PolishChange[]): string {
  let result = text;
  let count = 0;

  for (const phrase of BANNED_PHRASES) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = escaped.replace(/'/g, "['''`]");
    const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
    const matches = result.match(regex);
    if (matches) {
      count += matches.length;
      const replacement = PHRASE_REPLACEMENTS[phrase.toLowerCase()] || '';
      result = result.replace(regex, replacement);
    }
  }

  result = result.replace(/\s{2,}/g, ' ').replace(/\.\s*\./g, '.').trim();
  if (count > 0) {
    changes.push({ pass: 'bannedPhraseStrip', original: `${count} phrases`, replacement: 'removed', position: 0 });
  }
  return result;
}

// ─── Pass 3: Contraction Expansion ───────────────────────────────────

function passContractionExpansion(text: string, changes: PolishChange[]): string {
  const map: Record<string, string> = {
    "don't": "do not", "doesn't": "does not", "didn't": "did not",
    "isn't": "is not", "aren't": "are not", "wasn't": "was not",
    "weren't": "were not", "can't": "cannot", "couldn't": "could not",
    "won't": "will not", "wouldn't": "would not", "shouldn't": "should not",
    "hasn't": "has not", "haven't": "have not", "hadn't": "had not",
    "it's": "it is", "that's": "that is", "there's": "there is",
    "they're": "they are", "we're": "we are", "you're": "you are",
    "he's": "he is", "she's": "she is", "let's": "let us",
  };

  let result = text;
  let count = 0;
  for (const [contraction, expansion] of Object.entries(map)) {
    const regex = new RegExp(`\\b${contraction.replace("'", "['''`]")}\\b`, 'gi');
    if (regex.test(result)) {
      count++;
      result = result.replace(regex, (m) =>
        m[0] === m[0].toUpperCase() ? expansion.charAt(0).toUpperCase() + expansion.slice(1) : expansion
      );
    }
  }
  if (count > 0) {
    changes.push({ pass: 'contractionExpansion', original: `${count}`, replacement: 'expanded', position: 0 });
  }
  return result;
}

// ─── Pass 4: AGGRESSIVE Sentence Breaking (HIGHEST IMPACT) ──────────

function passAggressiveSentenceBreaking(text: string, changes: PolishChange[]): string {
  const paragraphs = text.split(/\n\n+/);
  const processed: string[] = [];
  let breaks = 0;

  for (const paragraph of paragraphs) {
    // Skip headings
    if (/^\d+(\.\d+)*\.?\s/.test(paragraph) && countWords(paragraph) < 20) {
      processed.push(paragraph);
      continue;
    }

    const sentences = splitSentences(paragraph);
    const broken: string[] = [];

    for (const sentence of sentences) {
      const words = countWords(sentence);

      if (words <= 12) {
        // Already short enough
        broken.push(sentence);
        continue;
      }

      // Try to break at various split points
      let didBreak = false;

      // Split at ", and ", ", but ", ", which ", ", where ", ", while "
      const conjSplit = sentence.match(/^(.{15,}?),\s+(and|but|which|where|while|as|since|because|although)\s+(.+)$/i);
      if (conjSplit && countWords(conjSplit[1]) >= 5 && countWords(conjSplit[3]) >= 4) {
        broken.push(conjSplit[1].trim() + '.');
        const rest = conjSplit[3].charAt(0).toUpperCase() + conjSplit[3].slice(1);
        // If the rest is still long, try to break it too
        if (countWords(rest) > 15) {
          const subSplit = rest.match(/^(.{10,}?),\s+(and|but|which|where)\s+(.+)$/i);
          if (subSplit) {
            broken.push(subSplit[1].trim() + '.');
            broken.push(subSplit[3].charAt(0).toUpperCase() + subSplit[3].slice(1));
          } else {
            broken.push(rest);
          }
        } else {
          broken.push(rest);
        }
        breaks++;
        didBreak = true;
        continue;
      }

      // Split at semicolons
      if (sentence.includes(';')) {
        const parts = sentence.split(/;\s*/);
        for (const part of parts) {
          if (part.trim()) {
            const p = part.trim();
            broken.push(p.charAt(0).toUpperCase() + p.slice(1) + (p.endsWith('.') ? '' : '.'));
          }
        }
        breaks++;
        didBreak = true;
        continue;
      }

      // Split at " that " or " to " midway through long sentences
      if (words > 20 && !didBreak) {
        const midpoint = Math.floor(sentence.length / 2);
        const nearMid = sentence.substring(midpoint - 30, midpoint + 30);
        const thatMatch = nearMid.match(/,?\s+(that|to|for|from|into|through)\s+/i);
        if (thatMatch && thatMatch.index !== undefined) {
          const actualPos = midpoint - 30 + thatMatch.index;
          const first = sentence.substring(0, actualPos).trim();
          const second = sentence.substring(actualPos + thatMatch[0].length).trim();
          if (countWords(first) >= 5 && countWords(second) >= 4) {
            broken.push(first + '.');
            broken.push(second.charAt(0).toUpperCase() + second.slice(1));
            breaks++;
            didBreak = true;
            continue;
          }
        }
      }

      if (!didBreak) {
        broken.push(sentence);
      }
    }

    // Now group into 2-4 sentence paragraphs
    const paraGroups: string[] = [];
    let group: string[] = [];
    for (const s of broken) {
      group.push(s);
      const r = Math.random();
      const maxSize = r < 0.3 ? 2 : r < 0.7 ? 3 : 4;
      if (group.length >= maxSize) {
        paraGroups.push(group.join(' '));
        group = [];
      }
    }
    if (group.length > 0) {
      paraGroups.push(group.join(' '));
    }

    for (const pg of paraGroups) {
      processed.push(pg);
    }
  }

  if (breaks > 0) {
    changes.push({ pass: 'aggressiveSentenceBreaking', original: `${breaks} long sentences`, replacement: 'broken into shorter fragments', position: 0 });
  }

  return processed.join('\n\n');
}

// ─── Pass 5: Perplexity Disruption (swap predictable → unexpected) ──

function passPerplexityDisruption(text: string, changes: PolishChange[]): string {
  let result = text;
  let count = 0;

  // Map of predictable academic words to less expected alternatives
  const swaps: [RegExp, string[]][] = [
    // Verbs
    [/\bdemonstrated\b/gi, ['showed', 'confirmed', 'made clear']],
    [/\bdemonstrates\b/gi, ['shows', 'confirms', 'makes clear']],
    [/\bindicates\b/gi, ['shows', 'points to', 'tells us']],
    [/\bindicated\b/gi, ['showed', 'pointed to', 'told us']],
    [/\bimplemented\b/gi, ['put in place', 'set up', 'started']],
    [/\bimplementation\b/gi, ['setup', 'rollout', 'introduction']],
    [/\bconducted\b/gi, ['done', 'carried out', 'run']],
    [/\bconducting\b/gi, ['doing', 'carrying out', 'running']],
    [/\bprovides\b/gi, ['gives', 'offers']],
    [/\bprovided\b/gi, ['gave', 'offered']],
    [/\brequires\b/gi, ['needs', 'calls for']],
    [/\brequired\b/gi, ['needed', 'called for']],
    [/\bensure\b/gi, ['make sure', 'confirm']],
    [/\bensuring\b/gi, ['making sure', 'confirming']],
    [/\butilize\b/gi, ['use']],
    [/\butilized\b/gi, ['used']],
    [/\bmaintain\b/gi, ['keep', 'hold']],
    [/\bmaintained\b/gi, ['kept', 'held']],
    [/\bfacilitate\b/gi, ['help', 'support']],
    [/\benhance\b/gi, ['improve', 'boost']],
    [/\benhanced\b/gi, ['improved', 'boosted']],
    [/\bmitigate\b/gi, ['cut down', 'lower', 'lessen']],
    [/\bidentify\b/gi, ['find', 'spot', 'pick out']],
    [/\bidentified\b/gi, ['found', 'spotted']],
    [/\bassess\b/gi, ['check', 'look at', 'measure']],
    [/\bassessed\b/gi, ['checked', 'looked at', 'measured']],
    [/\bassessment\b/gi, ['check', 'review', 'look']],
    [/\bmonitor\b/gi, ['track', 'watch', 'check on']],
    [/\bmonitoring\b/gi, ['tracking', 'watching', 'checking']],
    [/\bevaluate\b/gi, ['check', 'test', 'look at']],
    [/\bevaluated\b/gi, ['checked', 'tested', 'looked at']],
    [/\bevaluation\b/gi, ['check', 'test', 'review']],
    [/\bdetermine\b/gi, ['find out', 'figure out', 'work out']],
    [/\bdetermined\b/gi, ['found out', 'figured out']],
    [/\bestablish\b/gi, ['set up', 'create', 'build']],
    [/\bestablished\b/gi, ['set up', 'created', 'built']],
    // Adjectives/adverbs
    [/\bsignificant\b/gi, ['big', 'large', 'major', 'clear']],
    [/\bsignificantly\b/gi, ['a lot', 'much', 'greatly']],
    [/\bsubstantial\b/gi, ['big', 'large', 'major']],
    [/\bprimarily\b/gi, ['mainly', 'mostly']],
    [/\badditional\b/gi, ['more', 'extra']],
    [/\bsufficient\b/gi, ['enough']],
    [/\bappropriate\b/gi, ['right', 'proper', 'fitting']],
    [/\beffective\b/gi, ['good', 'strong', 'working']],
    [/\beffectively\b/gi, ['well', 'properly']],
    [/\bsubsequently\b/gi, ['then', 'after that', 'later']],
    [/\bapproximately\b/gi, ['about', 'around', 'roughly']],
    [/\bcurrently\b/gi, ['now', 'at this point', 'right now']],
    [/\bpreviously\b/gi, ['before', 'earlier']],
    // Nouns
    [/\bmethodology\b/gi, ['method', 'approach', 'way']],
    [/\bprocedures\b/gi, ['steps', 'methods']],
    [/\bconcentrations\b/gi, ['levels', 'amounts']],
    [/\bexposure\b/gi, ['contact']],
    [/\bexposures\b/gi, ['contacts']],
    // Phrases
    [/\bin order to\b/gi, ['to']],
    [/\bdue to the fact that\b/gi, ['because']],
    [/\ba wide range of\b/gi, ['many', 'lots of']],
    [/\bplay a role\b/gi, ['matter', 'factor in']],
    [/\bplays a role\b/gi, ['matters', 'factors in']],
    [/\bit is important to\b/gi, ['']],
    [/\bit is necessary to\b/gi, ['']],
    [/\bin the context of\b/gi, ['in', 'for']],
    [/\bwith respect to\b/gi, ['about', 'for']],
    [/\bon a regular basis\b/gi, ['regularly', 'often']],
    [/\bat this point in time\b/gi, ['now']],
    [/\bthe fact that\b/gi, ['that']],
    [/\bin close proximity to\b/gi, ['near', 'close to']],
  ];

  for (const [pattern, replacements] of swaps) {
    result = result.replace(pattern, () => {
      count++;
      return replacements[Math.floor(Math.random() * replacements.length)];
    });
  }

  if (count > 0) {
    changes.push({ pass: 'perplexityDisruption', original: `${count} predictable words`, replacement: 'swapped to unexpected alternatives', position: 0 });
  }
  return result;
}

// ─── Pass 5b: Break Compound Sentences at Commas ─────────────────────

function passBreakAtCommas(text: string, changes: PolishChange[]): string {
  const paragraphs = text.split(/\n\n+/);
  let breaks = 0;

  const processed = paragraphs.map(para => {
    if (/^\d+(\.\d+)*\.?\s/.test(para) && countWords(para) < 20) return para;

    const sentences = splitSentences(para);
    const broken: string[] = [];

    for (const sentence of sentences) {
      // Only break sentences that have commas AND are over 12 words
      if (countWords(sentence) > 12 && sentence.includes(',')) {
        // Split at comma + conjunction pattern
        const parts = sentence.split(/,\s+(?:and|but|which|where|while|since|because|although|as)\s+/i);
        if (parts.length >= 2 && parts.every(p => countWords(p) >= 3)) {
          for (let i = 0; i < parts.length; i++) {
            let p = parts[i].trim();
            if (!p.match(/[.!?]$/)) p += '.';
            if (i > 0) p = p.charAt(0).toUpperCase() + p.slice(1);
            broken.push(p);
          }
          breaks++;
          continue;
        }

        // Split at any comma if sentence is very long
        if (countWords(sentence) > 18) {
          const commaParts = sentence.split(/,\s+/);
          if (commaParts.length >= 2) {
            let first = commaParts.slice(0, Math.ceil(commaParts.length / 2)).join(', ').trim();
            let second = commaParts.slice(Math.ceil(commaParts.length / 2)).join(', ').trim();
            if (!first.match(/[.!?]$/)) first += '.';
            second = second.charAt(0).toUpperCase() + second.slice(1);
            broken.push(first);
            broken.push(second);
            breaks++;
            continue;
          }
        }
      }
      broken.push(sentence);
    }

    return broken.join(' ');
  });

  if (breaks > 0) {
    changes.push({ pass: 'breakAtCommas', original: `${breaks} compound sentences`, replacement: 'broken at commas', position: 0 });
  }

  return processed.join('\n\n');
}

// ─── Pass 6: Article Dropping ────────────────────────────────────────

function passArticleDropping(text: string, changes: PolishChange[]): string {
  const totalWords = countWords(text);
  const targetDrops = Math.max(3, Math.floor(totalWords / 150));

  let dropped = 0;
  // Drop "the" after sentence-internal positions (after period+space or comma+space)
  const result = text.replace(/(?<=\.\s+|,\s+|;\s+)([Tt])he\s+(?=[a-z])/g, (match, t) => {
    if (dropped < targetDrops && Math.random() < 0.25) {
      dropped++;
      return '';
    }
    return match;
  });

  if (dropped > 0) {
    changes.push({ pass: 'articleDropping', original: `${dropped} articles`, replacement: 'dropped', position: 0 });
  }
  return result;
}

// ─── Pass 7: Comma Splice Injection ──────────────────────────────────

function passCommaSpliceInjection(text: string, changes: PolishChange[]): string {
  const totalWords = countWords(text);
  const targetSplices = Math.max(2, Math.floor(totalWords / 300));

  const paragraphs = text.split(/\n\n+/);
  let injected = 0;

  const processed = paragraphs.map(para => {
    if (injected >= targetSplices) return para;
    if (/^\d+(\.\d+)*\.?\s/.test(para) && countWords(para) < 20) return para;

    const sentences = splitSentences(para);
    if (sentences.length < 2) return para;

    for (let i = 0; i < sentences.length - 1; i++) {
      const w1 = countWords(sentences[i]);
      const w2 = countWords(sentences[i + 1]);

      if (w1 >= 4 && w1 <= 14 && w2 >= 4 && w2 <= 14 && injected < targetSplices) {
        const first = sentences[i].replace(/\.\s*$/, '');
        const second = sentences[i + 1].charAt(0).toLowerCase() + sentences[i + 1].slice(1);
        sentences[i] = first + ', ' + second;
        sentences.splice(i + 1, 1);
        injected++;
        break;
      }
    }

    return sentences.join(' ');
  });

  if (injected > 0) {
    changes.push({ pass: 'commaSpliceInjection', original: `${injected} splices`, replacement: 'injected', position: 0 });
  }
  return processed.join('\n\n');
}

// ─── Pass 8: Wrong Preposition Injection ─────────────────────────────

function passWrongPreposition(text: string, changes: PolishChange[]): string {
  let result = text;
  let count = 0;
  const maxFixes = 3;

  const swaps: [RegExp, string][] = [
    [/\bcomply with\b/i, 'comply to'],
    [/\bresult in\b/i, 'result to'],
    [/\bdepend on\b/i, 'depend to'],
    [/\bconsist of\b/i, 'consist from'],
    [/\bexposed to\b/i, 'exposed with'],
    [/\bfocus on\b/i, 'focus to'],
    [/\bbased on\b/i, 'based in'],
    [/\baccording to\b/i, 'according with'],
  ];

  for (const [pattern, replacement] of swaps) {
    if (count >= maxFixes) break;
    if (pattern.test(result)) {
      result = result.replace(pattern, replacement);
      count++;
    }
  }

  if (count > 0) {
    changes.push({ pass: 'wrongPreposition', original: `${count} prepositions`, replacement: 'made incorrect (ESL)', position: 0 });
  }
  return result;
}

// ─── Pass 9: Nominalization Chains ───────────────────────────────────

function passNominalization(text: string, changes: PolishChange[]): string {
  let result = text;
  let count = 0;

  const swaps: [RegExp, string][] = [
    [/\brisk management\b/gi, 'management of risk'],
    [/\bexposure control\b/gi, 'control of contact'],
    [/\bair quality\b/gi, 'quality of air'],
    [/\bnoise reduction\b/gi, 'reduction of noise'],
    [/\bventilation system\b/gi, 'system of ventilation'],
    [/\bcontrol measures\b/gi, 'measures of control'],
    [/\bhealth effects\b/gi, 'effects on health'],
    [/\bsafety standards\b/gi, 'standards of safety'],
    [/\bwork environment\b/gi, 'environment of work'],
    [/\btest results\b/gi, 'results of test'],
  ];

  for (const [pattern, replacement] of swaps) {
    if (count >= 4) break;
    if (pattern.test(result)) {
      result = result.replace(pattern, replacement);
      count++;
    }
  }

  if (count > 0) {
    changes.push({ pass: 'nominalization', original: `${count} phrases`, replacement: '"of" chains', position: 0 });
  }
  return result;
}

// ─── Pass 10: Remove First Person ────────────────────────────────────

function passFirstPersonRemoval(text: string, changes: PolishChange[]): string {
  let result = text;
  const swaps: [RegExp, string][] = [
    [/\bI think\b/gi, 'The data shows'],
    [/\bI believe\b/gi, 'The data shows'],
    [/\bwe can see\b/gi, 'it is clear'],
    [/\bwe find\b/gi, 'findings show'],
    [/\bour\b/gi, 'the'],
  ];

  let count = 0;
  for (const [p, r] of swaps) {
    if (p.test(result)) { count++; result = result.replace(p, r); }
  }
  if (count > 0) changes.push({ pass: 'firstPersonRemoval', original: `${count}`, replacement: 'removed', position: 0 });
  return result;
}

// ─── Pass 11: Hedging Removal ────────────────────────────────────────

function passHedgingRemoval(text: string, changes: PolishChange[]): string {
  let result = text;
  let count = 0;
  const swaps: [RegExp, string][] = [
    [/\bmight\b/gi, 'can'],
    [/\bcould potentially\b/gi, 'can'],
    [/\bperhaps\b/gi, ''],
    [/\bpossibly\b/gi, ''],
    [/\bseems to\b/gi, ''],
    [/\bappears to\b/gi, ''],
    [/\bmay\b/gi, 'can'],
  ];
  for (const [p, r] of swaps) {
    if (p.test(result)) { count++; result = result.replace(p, r); }
  }
  result = result.replace(/\s{2,}/g, ' ');
  if (count > 0) changes.push({ pass: 'hedgingRemoval', original: `${count}`, replacement: 'removed', position: 0 });
  return result;
}

// ─── Pass 12: Final Cleanup ──────────────────────────────────────────

function passFinalCleanup(text: string): string {
  let result = text;
  result = result.replace(/\s{2,}/g, ' ');
  result = result.replace(/\.\s*\./g, '.');
  result = result.replace(/\.([A-Z])/g, '. $1');
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.split('\n\n').map(p => p.trim()).filter(p => p).join('\n\n');
  return result;
}

// ─── Pass: "Which" Clause Reducer ─────────────────────────────────────
// Converts excess "which are/is/were + adjective/participle" to simpler forms
// to prevent the repetitive "which" pattern from becoming its own detectable signal

function passWhichClauseReducer(text: string, changes: PolishChange[]): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const whichSentences: number[] = [];

  // Find all sentences with "which" clauses
  sentences.forEach((s, i) => {
    if (/\bwhich\s+(are|is|was|were|has|have|had)\b/i.test(s)) {
      whichSentences.push(i);
    }
  });

  // Target: max 25% of sentences should have "which" clauses
  const maxWhich = Math.ceil(sentences.length * 0.25);
  const toConvert = whichSentences.length - maxWhich;

  if (toConvert <= 0) {
    return text;
  }

  // Convert excess "which" clauses, starting from the end
  let converted = 0;
  const indicesToConvert = whichSentences.slice(maxWhich); // keep first maxWhich, convert the rest

  for (const idx of indicesToConvert) {
    let s = sentences[idx];

    // "which are/is + adjective" → pre-positioned adjective
    // e.g., "species which are threatened" → "threatened species"
    s = s.replace(/(\w+)\s+which\s+(?:are|is|was|were)\s+(\w+ed)\b/gi, '$2 $1');

    // "which are/is + adjective (not -ed)" → pre-positioned
    // e.g., "systems which are local" → "local systems"
    s = s.replace(/(\w+)\s+which\s+(?:are|is|was|were)\s+(available|optimal|adequate|practical|regional|current|selective|viable|seasonal|automated|operational|ecological|hydrological|qualified|strategic|adjacent|comparable|conventional)\b/gi, '$2 $1');

    // "which are designed to" → "designed to"
    s = s.replace(/\bwhich\s+(?:are|is|was|were)\s+(designed|intended|aimed|meant|required|needed|used|employed|conducted|established|positioned|distributed|triggered|transmitted|mandated|incorporated|aligned)\s/gi, '$1 ');

    // "of X which is/are Y" → "of Y X"
    s = s.replace(/\bof\s+(\w+)\s+which\s+(?:are|is|was|were)\s+(\w+)\b/gi, 'of $2 $1');

    if (s !== sentences[idx]) {
      sentences[idx] = s;
      converted++;
    }
  }

  if (converted > 0) {
    changes.push({
      pass: 'whichClauseReducer',
      original: `${converted} excess "which" clauses`,
      replacement: 'converted to simpler forms',
      position: 0,
    });
  }

  return sentences.join(' ');
}

// ─── Pass: ESL Uncountable Noun Errors ────────────────────────────────
// Classic ESL errors: making uncountable nouns plural. Strong human signal.

function passESLUncountableErrors(text: string, changes: PolishChange[]): string {
  let result = text;
  let count = 0;
  const maxErrors = 4;

  const swaps: [RegExp, string][] = [
    [/\bequipment\b/i, 'equipments'],
    [/\binformation\b/i, 'informations'],
    [/\bresearch\b(?!\s+(and|by|from|conducted|team|group|centre|center|institute))/i, 'researches'],
    [/\bfeedback\b/i, 'feedbacks'],
    [/\bknowledge\b/i, 'knowledges'],
    [/\bliterature\b(?!\s+review)/i, 'literatures'],
    [/\bevidence\b/i, 'evidences'],
    [/\bguidance\b/i, 'guidances'],
  ];

  for (const [pattern, replacement] of swaps) {
    if (count >= maxErrors) break;
    if (pattern.test(result)) {
      // Only replace first occurrence
      result = result.replace(pattern, replacement);
      count++;
    }
  }

  if (count > 0) {
    changes.push({ pass: 'eslUncountableErrors', original: `${count} nouns`, replacement: 'made plural (ESL error)', position: 0 });
  }
  return result;
}

// ─── Pass: Citation & → and fix ───────────────────────────────────────

function passCitationAndFix(text: string, changes: PolishChange[]): string {
  let result = text;
  let count = 0;

  // Replace & with "and" in citations: (Chen & Rodriguez, 2023) → (Chen and Rodriguez, 2023)
  result = result.replace(/\(([^)]*?)&([^)]*?\d{4}[^)]*?)\)/g, (match, before, after) => {
    count++;
    return `(${before}and${after})`;
  });

  if (count > 0) {
    changes.push({ pass: 'citationAndFix', original: `${count} citations`, replacement: '& → and', position: 0 });
  }
  return result;
}

// ─── Main ────────────────────────────────────────────────────────────

export function polishText(draft: string): PolishResult {
  const changes: PolishChange[] = [];
  let text = draft;

  text = passMarkdownClean(text, changes);
  text = passBannedPhraseStrip(text, changes);       // Remove any AI phrases paraphrase missed
  text = passContractionExpansion(text, changes);    // Expand any contractions
  text = passFirstPersonRemoval(text, changes);      // Remove first person
  text = passHedgingRemoval(text, changes);          // Remove hedging
  text = passWhichClauseReducer(text, changes);      // Cap "which" clauses at ~25%
  text = passFinalCleanup(text);

  // Stats
  const allSentences = splitSentences(text);
  const sentenceLengths = allSentences.map(s => countWords(s));
  const total = sentenceLengths.length || 1;
  const shortCount = sentenceLengths.filter(l => l <= 10).length;
  const mediumCount = sentenceLengths.filter(l => l > 10 && l <= 20).length;
  const longCount = sentenceLengths.filter(l => l > 20 && l <= 40).length;
  const veryLongCount = sentenceLengths.filter(l => l > 40).length;
  const theStarters = allSentences.filter(s => /^The\s/i.test(s)).length;

  const bodyParas = text.split(/\n\n+/)
    .filter(p => p.trim() && countWords(p) >= 10)
    .map(p => splitSentences(p).length);
  const avgSPP = bodyParas.length > 0 ? bodyParas.reduce((a, b) => a + b, 0) / bodyParas.length : 0;

  const passiveCount = allSentences.filter(s =>
    /\b(is|was|were|are|been|being|be)\s+\w+(ed|en|wn|ught)\b/i.test(s)
  ).length;

  return {
    polishedText: text,
    changes,
    stats: {
      sentenceLengthDistribution: {
        short: Math.round((shortCount / total) * 100),
        medium: Math.round((mediumCount / total) * 100),
        long: Math.round((longCount / total) * 100),
        veryLong: Math.round((veryLongCount / total) * 100),
      },
      theStarterPercentage: Math.round((theStarters / total) * 100),
      avgSentencesPerParagraph: Math.round(avgSPP * 10) / 10,
      passiveVoicePercentage: Math.round((passiveCount / total) * 100),
      bannedPhrasesRemoved: changes.filter(c => c.pass === 'bannedPhraseStrip').reduce((s, c) => {
        const m = c.original.match(/(\d+)/); return s + (m ? parseInt(m[1]) : 0);
      }, 0),
      contractionsExpanded: changes.filter(c => c.pass === 'contractionExpansion').length,
    },
  };
}
