import { NextRequest, NextResponse } from 'next/server';
import { generateOutline } from '@/lib/pipeline/generate-outline';
import { classifyAnthropicError } from '@/lib/anthropic';
import type { ParsedBrief, PipelineConfig } from '@/lib/pipeline/types';

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body', code: 'VALIDATION' }, { status: 400 });
  }

  try {
    const { brief, config, apiKey } = body as {
      brief: ParsedBrief;
      config: PipelineConfig;
      apiKey?: string;
    };

    if (!brief || !config) {
      return NextResponse.json({ error: 'brief and config are required', code: 'VALIDATION' }, { status: 400 });
    }

    const outline = await generateOutline(brief, config, apiKey);
    return NextResponse.json(outline);
  } catch (error) {
    console.error('Generate outline error:', (error as Error).message);
    const classified = classifyAnthropicError(error);
    return NextResponse.json(
      { error: classified.message, code: classified.code },
      { status: classified.httpStatus }
    );
  }
}
