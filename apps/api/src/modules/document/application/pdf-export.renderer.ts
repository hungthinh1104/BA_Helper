import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import sanitizeHtml from 'sanitize-html';
import { AppError } from '../../../shared/app-error';
import { sanitizeReportFilename } from '../domain/sanitize-filename.util';
import { ApprovedReportMetadata } from '../domain/approved-report-metadata';
import { DocumentExportRenderer, RenderedExport } from './document-export.renderer';
import { PDF_REPORT_THEME } from './pdf-report-theme';

const MAX_MARKDOWN_CHARS = 120_000;
const RENDER_TIMEOUT_MS = 8_000;

type PageMargins = { top: number; right: number; bottom: number; left: number };

@Injectable()
export class PdfExportRenderer implements DocumentExportRenderer {
  async render(input: {
    markdown: string;
    metadata: ApprovedReportMetadata;
  }): Promise<RenderedExport> {
    if (input.markdown.length > MAX_MARKDOWN_CHARS) {
      throw new AppError(
        'PDF_RENDER_FAILED',
        'Approved report is too large to export as PDF.',
      );
    }

    let timeoutId: NodeJS.Timeout | null = null;

    try {
      return await Promise.race([
        this.renderPdf(input.markdown, input.metadata),
        new Promise<RenderedExport>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new AppError('PDF_RENDER_FAILED', 'PDF rendering timed out.'));
          }, RENDER_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private async renderPdf(
    markdown: string,
    metadata: ApprovedReportMetadata,
  ): Promise<RenderedExport> {
    const doc = new PDFDocument({
      autoFirstPage: true,
      bufferPages: true,
      margins: PDF_REPORT_THEME.page.margins,
      info: {
        Title: metadata.title,
        Author: 'BA Helper',
        Subject:
          metadata.reportScope === 'MULTI_REPO_RUN'
            ? `Merged multi-repo report ${metadata.runId ?? metadata.analysisId}`
            : `Impact analysis ${metadata.analysisId}`,
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));

    this.renderCover(doc, metadata);
    doc.addPage();
    this.renderMarkdown(doc, markdown);
    this.writeFooters(doc, metadata);

    doc.end();

    await new Promise<void>((resolve, reject) => {
      doc.on('end', () => resolve());
      doc.on('error', (error) =>
        reject(new AppError('PDF_RENDER_FAILED', `Failed to render PDF: ${error.message}`)),
      );
    });

    return {
      contentType: 'application/pdf',
      filename: sanitizeReportFilename(metadata.title, 'pdf'),
      buffer: Buffer.concat(buffers),
    };
  }

  private renderCover(doc: PDFKit.PDFDocument, metadata: ApprovedReportMetadata) {
    const margins = doc.page.margins as PageMargins;
    const innerWidth = this.contentWidth(doc);

    doc
      .save()
      .rect(margins.left, margins.top - 18, 62, 6)
      .fill(PDF_REPORT_THEME.colors.accent);
    doc.restore();

    doc
      .font(PDF_REPORT_THEME.font.sansBold)
      .fontSize(11)
      .fillColor(PDF_REPORT_THEME.colors.accent)
      .text('APPROVED REPORT EXPORT', margins.left, margins.top - 2, {
        width: innerWidth,
        characterSpacing: 1.2,
      });

    doc
      .moveDown(0.6)
      .font(PDF_REPORT_THEME.font.sansBold)
      .fontSize(PDF_REPORT_THEME.size.title)
      .fillColor(PDF_REPORT_THEME.colors.text)
      .text(metadata.title, {
        width: innerWidth,
        lineGap: 2,
      });

    doc
      .moveDown(0.25)
      .font(PDF_REPORT_THEME.font.sans)
      .fontSize(10)
      .fillColor(PDF_REPORT_THEME.colors.textMuted)
      .text(
        'Generated from the persisted approved Markdown snapshot. PDF is rendered on demand for print-friendly sharing.',
        {
          width: innerWidth,
          lineGap: 2,
        },
      );

    doc.moveDown(1.1);
    this.renderInfoGrid(doc, metadata);
    doc.moveDown(0.8);
    this.renderStatusBanner(doc, metadata);
  }

  private renderInfoGrid(doc: PDFKit.PDFDocument, metadata: ApprovedReportMetadata) {
    const cards =
      metadata.reportScope === 'MULTI_REPO_RUN'
        ? [
            { label: 'Run ID', value: metadata.runId ?? metadata.analysisId, mono: true },
            {
              label: 'Approved Report ID',
              value: metadata.generatedDocumentId,
              mono: true,
            },
            { label: 'Project ID', value: metadata.projectId, mono: true },
            {
              label: 'Requirement Revision ID',
              value: metadata.requirementRevisionId ?? 'N/A',
              mono: true,
            },
            {
              label: 'Child Analyses',
              value: String(metadata.childAnalysisCount ?? 0),
            },
            { label: 'Approved At', value: metadata.generatedAt },
          ]
        : [
            { label: 'Analysis ID', value: metadata.analysisId, mono: true },
            {
              label: 'Generated Document ID',
              value: metadata.generatedDocumentId,
              mono: true,
            },
            { label: 'Project ID', value: metadata.projectId, mono: true },
            { label: 'Repository ID', value: metadata.repositoryId ?? 'N/A', mono: true },
            { label: 'Target Ref', value: metadata.targetRef ?? 'N/A', mono: true },
            { label: 'Commit SHA', value: metadata.commitSha ?? 'N/A', mono: true },
          ];

    const innerWidth = this.contentWidth(doc);
    const gap = 12;
    const columns = 2;
    const cardWidth = (innerWidth - gap * (columns - 1)) / columns;
    let cursorY = doc.y;

    for (let index = 0; index < cards.length; index += columns) {
      const row = cards.slice(index, index + columns);
      const rowHeights = row.map((card) => this.measureInfoCardHeight(doc, card, cardWidth));
      const rowHeight = Math.max(...rowHeights);

      row.forEach((card, colIndex) => {
        const x = doc.page.margins.left + colIndex * (cardWidth + gap);
        this.drawInfoCard(doc, x, cursorY, cardWidth, rowHeight, card);
      });

      cursorY += rowHeight + gap;
    }

    doc.y = cursorY;
  }

  private measureInfoCardHeight(
    doc: PDFKit.PDFDocument,
    card: { label: string; value: string; mono?: boolean },
    width: number,
  ): number {
    const pad = 10;
    const innerWidth = width - pad * 2;
    const valueFont = card.mono ? PDF_REPORT_THEME.font.mono : PDF_REPORT_THEME.font.sans;
    doc.font(PDF_REPORT_THEME.font.sansBold).fontSize(9);
    const labelHeight = doc.heightOfString(card.label, { width: innerWidth, lineGap: 1 });
    doc.font(valueFont).fontSize(9);
    const valueHeight = doc.heightOfString(this.wrapLongTokens(card.value), {
      width: innerWidth,
      lineGap: 2,
    });
    return Math.max(44, pad * 2 + labelHeight + valueHeight + 4);
  }

  private drawInfoCard(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    height: number,
    card: { label: string; value: string; mono?: boolean },
  ) {
    const pad = 10;
    const valueFont = card.mono ? PDF_REPORT_THEME.font.mono : PDF_REPORT_THEME.font.sans;

    doc
      .save()
      .roundedRect(x, y, width, height, PDF_REPORT_THEME.borderRadius)
      .fillAndStroke(PDF_REPORT_THEME.colors.surface, PDF_REPORT_THEME.colors.border);
    doc.restore();

    doc
      .font(PDF_REPORT_THEME.font.sansBold)
      .fontSize(8.5)
      .fillColor(PDF_REPORT_THEME.colors.accent)
      .text(card.label.toUpperCase(), x + pad, y + pad, {
        width: width - pad * 2,
        characterSpacing: 0.8,
      });

    doc
      .font(valueFont)
      .fontSize(9)
      .fillColor(PDF_REPORT_THEME.colors.text)
      .text(this.wrapLongTokens(card.value), x + pad, y + pad + 14, {
        width: width - pad * 2,
        lineGap: 2,
      });
  }

  private renderStatusBanner(doc: PDFKit.PDFDocument, metadata: ApprovedReportMetadata) {
    const innerWidth = this.contentWidth(doc);
    const bannerHeight = 44;
    const statusText = metadata.staleStatusAtReadTime
      ? `Stale at read time: yes${metadata.staleReason ? ` • ${metadata.staleReason}` : ''}`
      : 'Stale at read time: no';

    doc
      .save()
      .roundedRect(doc.page.margins.left, doc.y, innerWidth, bannerHeight, PDF_REPORT_THEME.borderRadius)
      .fillAndStroke(PDF_REPORT_THEME.colors.surfaceSoft, PDF_REPORT_THEME.colors.accentSoft);
    doc.restore();

    doc
      .font(PDF_REPORT_THEME.font.sansBold)
      .fontSize(9.5)
      .fillColor(PDF_REPORT_THEME.colors.text)
      .text('Report posture', doc.page.margins.left + 12, doc.y + 10, {
        width: innerWidth - 24,
      });
    doc
      .font(PDF_REPORT_THEME.font.sans)
      .fontSize(9)
      .fillColor(PDF_REPORT_THEME.colors.textMuted)
      .text(statusText, doc.page.margins.left + 12, doc.y + 24, {
        width: innerWidth - 24,
      });

    doc.y += bannerHeight + 6;
  }

  private renderMarkdown(doc: PDFKit.PDFDocument, markdown: string) {
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
      this.writeParagraph(doc, this.sanitizeInline(paragraph.join(' ')));
    }
  }

  private writeHeading(doc: PDFKit.PDFDocument, depth: number, text: string) {
    this.ensureHeadingSpace(doc, depth);

    const safeText = this.sanitizeInline(text);
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
    const content = this.sanitizeInline(text);
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
        .text(this.sanitizeInline(line), {
          width,
          indent: 14,
          lineGap: 1,
        });
    });
    doc.moveDown(0.45);
  }

  private writeCodeBlock(doc: PDFKit.PDFDocument, text: string) {
    const sanitized = this.wrapLongTokens(this.sanitizeCode(text));
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
    const cleaned = filtered.map((line) => this.sanitizeInline(line));
    const text = this.wrapLongTokens(cleaned.join('\n'));
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

  private writeFooters(doc: PDFKit.PDFDocument, metadata: ApprovedReportMetadata) {
    const range = doc.bufferedPageRange();
    const pageCount = range.count;

    for (let i = 0; i < pageCount; i += 1) {
      doc.switchToPage(i);
      const footerY = doc.page.height - doc.page.margins.bottom + 10;
      const innerWidth = this.contentWidth(doc);

      doc
        .save()
        .moveTo(doc.page.margins.left, footerY - 8)
        .lineTo(doc.page.width - doc.page.margins.right, footerY - 8)
        .lineWidth(0.5)
        .strokeColor(PDF_REPORT_THEME.colors.border)
        .stroke();
      doc.restore();

      doc
        .font(PDF_REPORT_THEME.font.sans)
        .fontSize(7.8)
        .fillColor(PDF_REPORT_THEME.colors.textSubtle)
        .text(
          `${metadata.reportScope === 'MULTI_REPO_RUN' ? 'Merged report' : 'Report'} ${metadata.generatedDocumentId} • Page ${i + 1} of ${pageCount}`,
          doc.page.margins.left,
          footerY,
          { width: innerWidth, align: 'left' },
        );
    }
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

  private sanitizeCode(value: string) {
    return sanitizeHtml(value, {
      allowedTags: [],
      allowedAttributes: {},
    }).trim();
  }

  private sanitizeInline(value: string) {
    return this.wrapLongTokens(
      sanitizeHtml(value, {
        allowedTags: [],
        allowedAttributes: {},
      })
        .replace(/\s+/g, ' ')
        .trim(),
    );
  }

  private wrapLongTokens(value: string) {
    return value
      .split(/\s+/)
      .map((token) => {
        if (token.length < 28) {
          return token;
        }

        return token.replace(/([/\\._:\-?&=])/g, '$1\u200b');
      })
      .join(' ');
  }
}
