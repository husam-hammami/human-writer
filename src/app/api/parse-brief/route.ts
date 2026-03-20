import { NextRequest, NextResponse } from 'next/server';
import { parseBrief } from '@/lib/pipeline/parse-brief';
import { classifyAnthropicError } from '@/lib/anthropic';

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body', code: 'VALIDATION' }, { status: 400 });
  }

  try {
    const { briefText, apiKey } = body;
    if (!briefText || typeof briefText !== 'string') {
      return NextResponse.json({ error: 'briefText is required', code: 'VALIDATION' }, { status: 400 });
    }

    const parsed = await parseBrief(briefText, apiKey);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Parse brief error:', (error as Error).message);
    const classified = classifyAnthropicError(error);
    return NextResponse.json(
      { error: classified.message, code: classified.code },
      { status: classified.httpStatus }
    );
  }
}
