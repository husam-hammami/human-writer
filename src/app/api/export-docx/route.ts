import { NextRequest } from 'next/server';
import { generateDocx } from '@/lib/docx-export';
import type { PipelineConfig } from '@/lib/pipeline/types';

export async function POST(req: NextRequest) {
  try {
    const { text, title, config } = await req.json() as {
      text: string;
      title: string;
      config: PipelineConfig;
    };

    if (!text || !title) {
      return new Response(JSON.stringify({ error: 'text and title are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const buffer = await generateDocx(title, text, config);

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${title.replace(/[^a-zA-Z0-9 ]/g, '')}.docx"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Export failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
