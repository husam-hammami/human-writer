import { HfInference } from '@huggingface/inference';
import type { DetectionResult } from './types';

interface HFClassificationResult {
  label: string;
  score: number;
}

// ─── ZeroGPT API (Primary — strict, accurate) ───────────────────────

interface ZeroGPTResponse {
  success: boolean;
  data: {
    is_human_written: number;
    is_gpt_generated: number;
    feedback_message: string;
    gpt_generated_sentences: string[];
    words_count: number;
  };
}

/**
 * Detect using ZeroGPT via RapidAPI.
 * Sends the FULL text in one call — ZeroGPT handles chunking internally.
 * Returns sentence-level AI flagging.
 */
async function detectWithZeroGPT(text: string): Promise<DetectionResult> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    throw new Error('RAPIDAPI_KEY not set');
  }

  const response = await fetch('https://zerogpt.p.rapidapi.com/api/v1/detectText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-host': 'zerogpt.p.rapidapi.com',
      'x-rapidapi-key': apiKey,
    },
    body: JSON.stringify({ input_text: text }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ZeroGPT API error ${response.status}: ${errText}`);
  }

  const result: ZeroGPTResponse = await response.json();

  if (!result.success) {
    throw new Error('ZeroGPT returned unsuccessful response');
  }

  const humanScore = Math.round(result.data.is_human_written);
  const aiScore = Math.round(result.data.is_gpt_generated);

  // Build paragraph-level scores from flagged sentences
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim() && p.split(/\s+/).length >= 10);
  const flaggedSentences = new Set(result.data.gpt_generated_sentences.map(s => s.trim().toLowerCase()));

  const paragraphScores = paragraphs.map((para, i) => {
    // Check how many sentences in this paragraph are flagged
    const sentences = para.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 5);
    const totalSentences = sentences.length || 1;
    const flaggedCount = sentences.filter(s =>
      flaggedSentences.has(s.trim().toLowerCase()) ||
      // Partial match — flagged sentence might be slightly different
      [...flaggedSentences].some(f => f.includes(s.trim().toLowerCase().substring(0, 30)))
    ).length;

    const paraHumanScore = Math.round(((totalSentences - flaggedCount) / totalSentences) * 100);

    return {
      text: para.substring(0, 150) + (para.length > 150 ? '...' : ''),
      humanScore: paraHumanScore,
      index: i,
    };
  });

  console.log(`ZeroGPT result: ${humanScore}% human, ${aiScore}% AI, ${result.data.gpt_generated_sentences.length} flagged sentences`);

  return {
    humanScore,
    aiScore,
    provider: 'zerogpt',
    paragraphScores,
  };
}

// ─── HuggingFace Fallback ────────────────────────────────────────────

function splitIntoChunks(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  const sentences = normalized.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(s => s.trim().length > 0);

  const chunks: string[] = [];
  let current = '';
  let currentWords = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.split(/\s+/).length;
    if (currentWords + sentenceWords > 200 && current) {
      chunks.push(current.trim());
      current = sentence;
      currentWords = sentenceWords;
    } else {
      current += (current ? ' ' : '') + sentence;
      currentWords += sentenceWords;
    }
  }

  if (current.trim() && current.split(/\s+/).length >= 15) {
    chunks.push(current.trim());
  }

  return chunks;
}

async function detectWithHuggingFace(text: string): Promise<DetectionResult> {
  const hf = new HfInference(process.env.HF_ACCESS_TOKEN);
  const chunks = splitIntoChunks(text);

  if (chunks.length === 0) {
    return { humanScore: 50, aiScore: 50, provider: 'no-content', paragraphScores: [] };
  }

  const model = 'Hello-SimpleAI/chatgpt-detector-roberta';
  const fallbackModel = 'openai-community/roberta-large-openai-detector';
  const paragraphScores: { text: string; humanScore: number; index: number }[] = [];
  let activeModel = model;

  for (let i = 0; i < chunks.length; i++) {
    try {
      const result = await hf.textClassification({ model: activeModel, inputs: chunks[i] });
      const resultArray = result as unknown as HFClassificationResult[];
      let humanScore = 50;
      for (const r of resultArray) {
        const label = r.label.toLowerCase();
        if (label === 'real' || label === 'label_1' || label === 'human') humanScore = Math.round(r.score * 100);
        else if (label === 'fake' || label === 'label_0' || label === 'chatgpt') humanScore = Math.round((1 - r.score) * 100);
      }
      paragraphScores.push({ text: chunks[i].substring(0, 150) + '...', humanScore, index: i });
    } catch (error) {
      if (activeModel === model && i === 0) {
        activeModel = fallbackModel;
        i--;
        continue;
      }
      paragraphScores.push({ text: chunks[i].substring(0, 150) + '...', humanScore: 50, index: i });
    }
    if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 300));
  }

  const avg = Math.round(paragraphScores.reduce((s, p) => s + p.humanScore, 0) / paragraphScores.length);
  return { humanScore: avg, aiScore: 100 - avg, provider: 'huggingface-' + activeModel.split('/')[1], paragraphScores };
}

// ─── Main Detection Function ─────────────────────────────────────────

/**
 * Primary: ZeroGPT (strict, matches stealthwriter-level detection)
 * Fallback: HuggingFace (weaker but free unlimited)
 */
export async function detectAI(text: string): Promise<DetectionResult> {
  // Try ZeroGPT first (strict, accurate)
  try {
    console.log('Using ZeroGPT for detection...');
    return await detectWithZeroGPT(text);
  } catch (error) {
    console.error('ZeroGPT detection failed:', error instanceof Error ? error.message : error);
  }

  // Fallback to HuggingFace
  try {
    console.log('Falling back to HuggingFace...');
    return await detectWithHuggingFace(text);
  } catch (error) {
    console.error('HuggingFace detection also failed:', error);
  }

  return { humanScore: -1, aiScore: -1, provider: 'manual', paragraphScores: [] };
}
