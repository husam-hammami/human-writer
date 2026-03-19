import { NextRequest, NextResponse } from 'next/server';
import { paraphraseText } from '@/lib/pipeline/paraphrase';

export async function POST(req: NextRequest) {
  try {
    const { draft } = await req.json();
    if (!draft || typeof draft !== 'string') {
      return NextResponse.json({ error: 'draft text is required' }, { status: 400 });
    }

    // Claude-based paraphrase with StealthWriter-learned transformations
    const result = await paraphraseText(draft);
    const wordCount = result.split(/\s+/).filter(Boolean).length;

    return NextResponse.json({ paraphrasedText: result, wordCount, provider: 'claude-paraphrase' });
  } catch (error) {
    console.error('Paraphrase error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Paraphrase failed' },
      { status: 500 }
    );
  }
}
