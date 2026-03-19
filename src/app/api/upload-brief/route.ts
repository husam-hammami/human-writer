import { NextRequest, NextResponse } from 'next/server';
import { parseDocxUpload } from '@/lib/upload-parser';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const text = await parseDocxUpload(buffer);

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Upload parse error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse uploaded file' },
      { status: 500 }
    );
  }
}
