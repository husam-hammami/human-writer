import { NextRequest, NextResponse } from 'next/server';
import { detectAI } from '@/lib/pipeline/detect';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    const result = await detectAI(text);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Detection check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Detection check failed' },
      { status: 500 }
    );
  }
}
