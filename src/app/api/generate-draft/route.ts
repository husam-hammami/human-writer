import { NextRequest, NextResponse } from 'next/server';
import { generateDraft, generateLongDraft } from '@/lib/pipeline/generate-draft';
import type { Outline, PipelineConfig } from '@/lib/pipeline/types';

export async function POST(req: NextRequest) {
  try {
    const { outline, config, apiKey } = await req.json() as {
      outline: Outline;
      config: PipelineConfig;
      apiKey?: string;
    };

    if (!outline || !config) {
      return NextResponse.json({ error: 'outline and config are required' }, { status: 400 });
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
    console.error('Generate draft error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate draft' },
      { status: 500 }
    );
  }
}
