/**
 * Detection and iteration loop.
 *
 * Uses ZeroGPT as primary detector.
 * If score is below threshold, re-paraphrases the flagged sentences
 * and re-checks. Max 2 iterations to conserve API calls.
 */

import { getAnthropicClient } from '../anthropic';
import { buildSystemWriterPrompt } from '../prompts/system-writer';
import { polishText } from './polish';
import { detectAI } from './detect';
import { paraphraseText } from './paraphrase';
import type { PipelineConfig, IterationState } from './types';

const HUMAN_SCORE_THRESHOLD = 75; // Target 75%+ on ZeroGPT
const MAX_ITERATIONS = 2; // Conserve API calls

interface IterationResult {
  finalText: string;
  finalDetection: Awaited<ReturnType<typeof detectAI>>;
  iterations: number;
  iterationHistory: {
    iteration: number;
    failingParagraphs: number[];
    scores: number[];
  }[];
}

export async function iterateUntilPassing(
  text: string,
  config: PipelineConfig,
  onProgress?: (state: IterationState) => void,
): Promise<IterationResult> {
  const iterationHistory: IterationResult['iterationHistory'] = [];
  let currentText = text;

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    onProgress?.({
      iteration,
      maxIterations: MAX_ITERATIONS,
      failingParagraphs: [],
      scores: [],
      status: 'checking',
    });

    const detection = await detectAI(currentText);

    const scores = detection.paragraphScores.map((p: { humanScore: number }) => p.humanScore);
    const failingIndices = detection.paragraphScores
      .filter((p: { humanScore: number }) => p.humanScore < HUMAN_SCORE_THRESHOLD)
      .map((p: { index: number }) => p.index);

    iterationHistory.push({ iteration, failingParagraphs: failingIndices, scores });

    onProgress?.({
      iteration,
      maxIterations: MAX_ITERATIONS,
      failingParagraphs: failingIndices,
      scores,
      status: detection.humanScore >= HUMAN_SCORE_THRESHOLD ? 'complete' : 'regenerating',
    });

    // If passing, we're done
    if (detection.humanScore >= HUMAN_SCORE_THRESHOLD) {
      return { finalText: currentText, finalDetection: detection, iterations: iteration, iterationHistory };
    }

    // If failing, re-paraphrase the entire text with more aggressive settings
    onProgress?.({
      iteration,
      maxIterations: MAX_ITERATIONS,
      failingParagraphs: failingIndices,
      scores,
      status: 'regenerating',
    });

    console.log(`Iteration ${iteration}: Score ${detection.humanScore}%, re-paraphrasing...`);

    // Re-paraphrase (this uses Claude at temp 1.0 again, further shifting token distributions)
    const reParaphrased = await paraphraseText(currentText);

    // Re-polish
    onProgress?.({
      iteration,
      maxIterations: MAX_ITERATIONS,
      failingParagraphs: failingIndices,
      scores,
      status: 'polishing',
    });

    const rePolished = polishText(reParaphrased);
    currentText = rePolished.polishedText;
  }

  // Final detection
  onProgress?.({
    iteration: MAX_ITERATIONS,
    maxIterations: MAX_ITERATIONS,
    failingParagraphs: [],
    scores: [],
    status: 'rechecking',
  });

  const finalDetection = await detectAI(currentText);

  onProgress?.({
    iteration: MAX_ITERATIONS,
    maxIterations: MAX_ITERATIONS,
    failingParagraphs: [],
    scores: finalDetection.paragraphScores.map((p: { humanScore: number }) => p.humanScore),
    status: 'complete',
  });

  return {
    finalText: currentText,
    finalDetection,
    iterations: MAX_ITERATIONS,
    iterationHistory,
  };
}
