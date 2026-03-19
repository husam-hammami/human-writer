import { NextRequest, NextResponse } from 'next/server';
import { generateOutline } from '@/lib/pipeline/generate-outline';
import type { ParsedBrief, PipelineConfig } from '@/lib/pipeline/types';

export async function POST(req: NextRequest) {
  try {
    const { brief, config } = await req.json() as {
      brief: ParsedBrief;
      config: PipelineConfig;
    };

    if (!brief || !config) {
      return NextResponse.json({ error: 'brief and config are required' }, { status: 400 });
    }

    const outline = await generateOutline(brief, config);
    return NextResponse.json(outline);
  } catch (error) {
    console.error('Generate outline error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate outline' },
      { status: 500 }
    );
  }
}
