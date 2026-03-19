import { NextRequest, NextResponse } from 'next/server';
import { polishText } from '@/lib/pipeline/polish';

export async function POST(req: NextRequest) {
  try {
    const { draft } = await req.json();
    if (!draft || typeof draft !== 'string') {
      return NextResponse.json({ error: 'draft text is required' }, { status: 400 });
    }

    // Programmatic post-processing — NO LLM calls, fast
    const result = polishText(draft);

    return NextResponse.json({
      polishedText: result.polishedText,
      stats: result.stats,
      changesCount: result.changes.length,
    });
  } catch (error) {
    console.error('Polish error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to polish text' },
      { status: 500 }
    );
  }
}
