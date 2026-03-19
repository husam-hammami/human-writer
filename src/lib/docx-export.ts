import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
  PageBreak,
} from 'docx';
import type { PipelineConfig } from './pipeline/types';

export async function generateDocx(
  title: string,
  content: string,
  config: PipelineConfig
): Promise<Buffer> {
  const sections = parseContentToSections(content);

  const children: Paragraph[] = [];

  // Title page
  children.push(
    new Paragraph({ spacing: { before: 4000 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 48, // 24pt
          font: 'Times New Roman',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: config.discipline,
          size: 28,
          font: 'Times New Roman',
          italics: true,
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] })
  );

  // Content
  for (const section of sections) {
    if (section.heading) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 360, after: 200 },
          children: [
            new TextRun({
              text: section.heading,
              bold: true,
              size: 28, // 14pt
              font: 'Times New Roman',
            }),
          ],
        })
      );
    }

    for (const para of section.paragraphs) {
      children.push(
        new Paragraph({
          spacing: { after: 200, line: 360 }, // 1.5 spacing
          children: [
            new TextRun({
              text: para,
              size: 24, // 12pt
              font: 'Times New Roman',
            }),
          ],
        })
      );
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Times New Roman',
            size: 24,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 12240, // 8.5 inches
              height: 15840, // 11 inches
            },
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: title,
                    size: 20,
                    font: 'Times New Roman',
                    italics: true,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 20,
                    font: 'Times New Roman',
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

interface ContentSection {
  heading: string | null;
  paragraphs: string[];
}

function parseContentToSections(content: string): ContentSection[] {
  const lines = content.split('\n');
  const sections: ContentSection[] = [];
  let current: ContentSection = { heading: null, paragraphs: [] };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for markdown headings
    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      if (current.heading || current.paragraphs.length > 0) {
        sections.push(current);
      }
      current = { heading: headingMatch[1], paragraphs: [] };
    } else {
      current.paragraphs.push(trimmed);
    }
  }

  if (current.heading || current.paragraphs.length > 0) {
    sections.push(current);
  }

  return sections;
}
