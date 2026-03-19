/**
 * Undetectable.ai API Integration
 *
 * Uses their humanization API to rewrite text so it passes AI detectors.
 * This replaces our Claude-based paraphrase step with a purpose-built
 * neural network trained specifically for bypassing detection.
 *
 * API Docs: https://help.undetectable.ai/en/article/humanization-api-v2-p28b2n/
 */

const BASE_URL = 'https://humanize.undetectable.ai';

interface SubmitResponse {
  status: string;
  id: string;
}

interface DocumentResponse {
  id: string;
  output: string | null;
  input: string;
  readability: string;
  purpose: string;
  createdDate: string;
}

function getApiKey(): string {
  const key = process.env.UNDETECTABLE_API_KEY;
  if (!key) throw new Error('UNDETECTABLE_API_KEY not set in .env.local');
  return key;
}

/**
 * Submit text for humanization.
 * Returns document ID for polling.
 */
async function submitForHumanization(
  text: string,
  readability: string = 'University',
  purpose: string = 'Essay',
  strength: string = 'More Human',
): Promise<string> {
  const response = await fetch(`${BASE_URL}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': getApiKey(),
    },
    body: JSON.stringify({
      content: text,
      readability,
      purpose,
      strength,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Undetectable submit failed (${response.status}): ${errText}`);
  }

  const data: SubmitResponse = await response.json();
  console.log(`Undetectable.ai: Submitted document, ID: ${data.id}`);
  return data.id;
}

/**
 * Poll for humanized document result.
 * Returns the humanized text when ready.
 */
async function pollForResult(documentId: string, maxWaitMs: number = 120000): Promise<string> {
  const startTime = Date.now();
  const pollInterval = 5000; // 5 seconds

  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(`${BASE_URL}/document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': getApiKey(),
      },
      body: JSON.stringify({ id: documentId }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Undetectable poll failed (${response.status}): ${errText}`);
    }

    const data: DocumentResponse = await response.json();

    if (data.output) {
      console.log(`Undetectable.ai: Document ready (${data.output.split(/\s+/).length} words)`);
      return data.output;
    }

    // Not ready yet, wait and poll again
    console.log(`Undetectable.ai: Still processing, waiting ${pollInterval / 1000}s...`);
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Undetectable.ai: Timed out after ${maxWaitMs / 1000}s waiting for humanization`);
}

/**
 * Check remaining word credits.
 */
export async function checkCredits(): Promise<number> {
  const response = await fetch(`${BASE_URL}/check-user-credits`, {
    method: 'GET',
    headers: {
      'apikey': getApiKey(),
    },
  });

  if (!response.ok) {
    console.error('Failed to check credits');
    return -1;
  }

  const data = await response.json();
  return data.credits || data.words || -1;
}

/**
 * Main humanization function.
 *
 * Submits text to Undetectable.ai, waits for processing, returns humanized text.
 * This is the replacement for our Claude paraphrase step.
 */
export async function humanizeWithUndetectable(
  text: string,
  options?: {
    readability?: 'High School' | 'University' | 'Doctorate' | 'Journalist' | 'Marketing';
    purpose?: 'General Writing' | 'Essay' | 'Article' | 'Marketing Material' | 'Story' | 'Cover Letter' | 'Report' | 'Business Material' | 'Legal Material';
    strength?: 'Quality' | 'Balanced' | 'More Human';
  },
  onProgress?: (status: string) => void,
): Promise<string> {
  const readability = options?.readability || 'University';
  const purpose = options?.purpose || 'Essay';
  const strength = options?.strength || 'More Human';

  onProgress?.('Submitting to Undetectable.ai...');

  // Submit
  const docId = await submitForHumanization(text, readability, purpose, strength);

  onProgress?.('Processing (typically 10-30 seconds)...');

  // Poll for result
  const result = await pollForResult(docId);

  onProgress?.('Humanization complete');

  return result;
}
