import { NextRequest, NextResponse } from 'next/server';
import { paraphraseText } from '@/lib/pipeline/paraphrase';
import { classifyAnthropicError } from '@/lib/anthropic';

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body', code: 'VALIDATION' }, { status: 400 });
  }

  try {
    const { draft, apiKey } = body;
    if (!draft || typeof draft !== 'string') {
      return NextResponse.json({ error: 'draft text is required', code: 'VALIDATION' }, { status: 400 });
    }

    const result = await paraphraseText(draft, undefined, apiKey);
    const wordCount = result.split(/\s+/).filter(Boolean).length;
    return NextResponse.json({ paraphrasedText: result, wordCount, provider: 'claude-paraphrase' });
  } catch (error) {
    console.error('Paraphrase error:', (error as Error).message);
    const classified = classifyAnthropicError(error);
    return NextResponse.json(
      { error: classified.message, code: classified.code },
      { status: classified.httpStatus }
    );
  }
}
