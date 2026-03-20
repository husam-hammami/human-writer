import { NextRequest, NextResponse } from 'next/server';
import { generateDraft, generateLongDraft } from '@/lib/pipeline/generate-draft';
import { classifyAnthropicError } from '@/lib/anthropic';
import type { Outline, PipelineConfig } from '@/lib/pipeline/types';

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body', code: 'VALIDATION' }, { status: 400 });
  }

  try {
    const { outline, config, apiKey } = body as {
      outline: Outline;
      config: PipelineConfig;
      apiKey?: string;
    };

    if (!outline || !config) {
      return NextResponse.json({ error: 'outline and config are required', code: 'VALIDATION' }, { status: 400 });
    }

    let fullDraft: string;
    if (config.wordCount > 6000) {
      fullDraft = await generateLongDraft(outline, config, undefined, apiKey);
    } else {
      fullDraft = await generateDraft(outline, config, apiKey);
    }

    const wordCount = fullDraft.split(/\s+/).filter(Boolean).length;
    return NextResponse.json({ fullDraft, wordCount });
  } catch (error) {
    console.error('Generate draft error:', (error as Error).message);
    const classified = classifyAnthropicError(error);
    return NextResponse.json(
      { error: classified.message, code: classified.code },
      { status: classified.httpStatus }
    );
  }
}
