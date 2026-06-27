import type PDFKit from 'pdfkit';
import { PDF_REPORT_THEME } from './pdf-report-theme';
import { sanitizeCode, sanitizeInline, wrapLongTokens } from './pdf-renderer-sanitizer';
import type { PageMargins } from './pdf-renderer.types';

export class PdfMarkdownRenderer {
  renderMarkdown(doc: PDFKit.PDFDocument, markdown: string) {
    const lines = markdown.split('\n');
    let index = 0;
    let inCodeBlock = false;
    const codeLines: string[] = [];

    while (index < lines.length) {
      const line = lines[index];

      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          this.writeCodeBlock(doc, codeLines.join('\n'));
          codeLines.length = 0;
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        index += 1;
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        index += 1;
        continue;
      }

      if (!line.trim()) {
        index += 1;
        continue;
      }

      if (line.startsWith('#')) {
        const depth = line.match(/^#+/)?.[0].length ?? 1;
        const text = line.replace(/^#+\s*/, '');
        this.writeHeading(doc, depth, text);
        index += 1;
        continue;
      }

      if (line.startsWith('>')) {
        const blockquote: string[] = [];
        while (index < lines.length && lines[index].trim().startsWith('>')) {
          blockquote.push(lines[index].replace(/^>\s?/, ''));
          index += 1;
        }
        this.writeBlockquote(doc, blockquote.join(' '));
        continue;
      }

      if (/^\s*(?:-|\*|\d+\.)\s+/.test(line)) {
        const listLines: string[] = [];
        while (index < lines.length && /^\s*(?:-|\*|\d+\.)\s+/.test(lines[index])) {
          listLines.push(lines[index]);
          index += 1;
        }
        this.writeList(doc, listLines);
        continue;
      }

      if (line.includes('|')) {
        const tableLines: string[] = [];
        while (index < lines.length && lines[index].includes('|')) {
          tableLines.push(lines[index]);
          index += 1;
        }
        this.writeTable(doc, tableLines);
        continue;
      }

      const paragraph: string[] = [];
      while (
        index < lines.length &&
        lines[index].trim() &&
        !lines[index].trim().startsWith('```') &&
        !lines[index].startsWith('#') &&
        !lines[index].trim().startsWith('>') &&
        !/^\s*(?:-|\*|\d+\.)\s+/.test(lines[index]) &&
        !lines[index].includes('|')
      ) {
        paragraph.push(lines[index]);
        index += 1;
      }
      this.writeParagraph(doc, sanitizeInline(paragraph.join(' ')));
    }
  }

  private writeHeading(doc: PDFKit.PDFDocument, depth: number, text: string) {
    this.ensureHeadingSpace(doc, depth);

    const safeText = sanitizeInline(text);
    const size =
      depth === 1
        ? PDF_REPORT_THEME.size.h1
        : depth === 2
          ? PDF_REPORT_THEME.size.h2
          : PDF_REPORT_THEME.size.h3;
    const accentWidth = depth === 1 ? 42 : depth === 2 ? 28 : 18;

    doc.moveDown(depth === 1 ? 0.7 : 0.35);

    doc
      .save()
      .roundedRect(
        doc.page.margins.left,
        doc.y + 2,
        accentWidth,
        4,
        2,
      )
      .fill(PDF_REPORT_THEME.colors.accent);
    doc.restore();

    doc
      .font(PDF_REPORT_THEME.font.sansBold)
      .fontSize(size)
      .fillColor(PDF_REPORT_THEME.colors.text)
      .text(safeText, {
        width: this.contentWidth(doc),
        lineGap: 2,
      });

    doc.moveDown(depth === 1 ? 0.35 : 0.25);
  }

  private writeParagraph(doc: PDFKit.PDFDocument, text: string) {
    doc
      .font(PDF_REPORT_THEME.font.sans)
      .fontSize(PDF_REPORT_THEME.size.body)
      .fillColor(PDF_REPORT_THEME.colors.textMuted)
      .text(text, {
        width: this.contentWidth(doc),
        align: 'left',
        lineGap: 2,
      });
    doc.moveDown(0.45);
  }

  private writeBlockquote(doc: PDFKit.PDFDocument, text: string) {
    const content = sanitizeInline(text);
    const width = this.contentWidth(doc);
    const pad = 10;
    const height =
      doc.heightOfString(content, {
        width: width - pad * 2 - 8,
        lineGap: 2,
      }) +
      pad * 2;

    doc
      .save()
      .roundedRect(doc.page.margins.left, doc.y, width, Math.max(34, height), PDF_REPORT_THEME.borderRadius)
      .fillAndStroke(PDF_REPORT_THEME.colors.surfaceSoft, PDF_REPORT_THEME.colors.accentSoft);
    doc.restore();

    doc
      .save()
      .rect(doc.page.margins.left, doc.y, 4, Math.max(34, height))
      .fill(PDF_REPORT_THEME.colors.accent);
    doc.restore();

    doc
      .font(PDF_REPORT_THEME.font.sansItalic)
      .fontSize(PDF_REPORT_THEME.size.body)
      .fillColor(PDF_REPORT_THEME.colors.textMuted)
      .text(content, doc.page.margins.left + pad + 2, doc.y + pad, {
        width: width - pad * 2 - 8,
        lineGap: 2,
      });

    doc.y += Math.max(34, height) + 6;
  }

  private writeList(doc: PDFKit.PDFDocument, lines: string[]) {
    const width = this.contentWidth(doc);
    lines.forEach((item, index) => {
      const ordered = /^\s*\d+\.\s+/.test(item);
      const bullet = ordered ? `${index + 1}.` : '•';
      const content = item.replace(/^\s*(?:-|\*|\d+\.)\s+/, '');
      const line = `${bullet} ${content}`;
      doc
        .font(PDF_REPORT_THEME.font.sans)
        .fontSize(PDF_REPORT_THEME.size.body)
        .fillColor(PDF_REPORT_THEME.colors.textMuted)
        .text(sanitizeInline(line), {
          width,
          indent: 14,
          lineGap: 1,
        });
    });
    doc.moveDown(0.45);
  }

  private writeCodeBlock(doc: PDFKit.PDFDocument, text: string) {
    const sanitized = wrapLongTokens(sanitizeCode(text));
    const width = this.contentWidth(doc);
    const pad = 12;
    const boxWidth = width;
    const textHeight = doc.heightOfString(sanitized, {
      width: boxWidth - pad * 2,
      lineGap: 2,
    });
    const boxHeight = Math.max(30, textHeight + pad * 2);

    doc
      .save()
      .roundedRect(doc.page.margins.left, doc.y, boxWidth, boxHeight, PDF_REPORT_THEME.borderRadius)
      .fillAndStroke(PDF_REPORT_THEME.colors.surfaceMuted, PDF_REPORT_THEME.colors.border);
    doc.restore();

    doc
      .font(PDF_REPORT_THEME.font.mono)
      .fontSize(PDF_REPORT_THEME.size.mono)
      .fillColor(PDF_REPORT_THEME.colors.text)
      .text(sanitized, doc.page.margins.left + pad, doc.y + pad, {
        width: boxWidth - pad * 2,
        lineGap: 2,
      });

    doc.y += boxHeight + 8;
  }

  private writeTable(doc: PDFKit.PDFDocument, lines: string[]) {
    const width = this.contentWidth(doc);
    const pad = 12;
    const filtered = lines.filter((line) => !/^\|\s*-/.test(line.trim()));
    const cleaned = filtered.map((line) => sanitizeInline(line));
    const text = wrapLongTokens(cleaned.join('\n'));
    const textHeight = doc.heightOfString(text, {
      width: width - pad * 2,
      lineGap: 2,
    });
    const boxHeight = Math.max(36, textHeight + pad * 2);

    doc
      .save()
      .roundedRect(doc.page.margins.left, doc.y, width, boxHeight, PDF_REPORT_THEME.borderRadius)
      .fillAndStroke(PDF_REPORT_THEME.colors.surface, PDF_REPORT_THEME.colors.border);
    doc.restore();

    const rows = cleaned;
    rows.forEach((row, index) => {
      const font = index === 0 ? PDF_REPORT_THEME.font.monoBold : PDF_REPORT_THEME.font.mono;
      doc
        .font(font)
        .fontSize(index === 0 ? 8.5 : 8)
        .fillColor(index === 0 ? PDF_REPORT_THEME.colors.text : PDF_REPORT_THEME.colors.textMuted)
        .text(row, doc.page.margins.left + pad, doc.y + pad + index * 13, {
          width: width - pad * 2,
          lineGap: 1,
        });
    });

    doc.y += boxHeight + 8;
  }

  private ensureHeadingSpace(doc: PDFKit.PDFDocument, depth: number) {
    const minHeight = depth === 1 ? 80 : depth === 2 ? 64 : 52;
    const remaining =
      doc.page.height - doc.page.margins.bottom - doc.y;
    if (remaining < minHeight) {
      doc.addPage();
    }
  }

  private contentWidth(doc: PDFKit.PDFDocument): number {
    const margins = doc.page.margins as PageMargins;
    return doc.page.width - margins.left - margins.right;
  }
}
