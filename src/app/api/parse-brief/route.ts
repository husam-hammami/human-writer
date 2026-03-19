import { NextRequest, NextResponse } from 'next/server';
import { parseBrief } from '@/lib/pipeline/parse-brief';

export async function POST(req: NextRequest) {
  try {
    const { briefText, apiKey } = await req.json();
    if (!briefText || typeof briefText !== 'string') {
      return NextResponse.json({ error: 'briefText is required' }, { status: 400 });
    }

    const parsed = await parseBrief(briefText, apiKey);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Parse brief error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse brief' },
      { status: 500 }
    );
  }
}
