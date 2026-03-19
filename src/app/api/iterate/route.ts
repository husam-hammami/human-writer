import { NextRequest } from 'next/server';
import { iterateUntilPassing } from '@/lib/pipeline/iterate';
import type { PipelineConfig } from '@/lib/pipeline/types';

export async function POST(req: NextRequest) {
  try {
    const { text, config } = await req.json() as {
      text: string;
      config: PipelineConfig;
    };

    if (!text || !config) {
      return new Response(
        JSON.stringify({ error: 'text and config are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Use SSE streaming for iteration progress
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await iterateUntilPassing(text, config, (state) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'progress', state })}\n\n`
              )
            );
          });

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'complete',
                finalText: result.finalText,
                detection: result.finalDetection,
                iterations: result.iterations,
                history: result.iterationHistory,
              })}\n\n`
            )
          );

          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                error: error instanceof Error ? error.message : 'Iteration failed',
              })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Iterate error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Iteration failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
