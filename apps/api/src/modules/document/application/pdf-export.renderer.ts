import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import sanitizeHtml from 'sanitize-html';
import { AppError } from '../../../shared/app-error';
import { sanitizeReportFilename } from '../domain/sanitize-filename.util';
import { ApprovedReportMetadata } from '../domain/approved-report-metadata';
import { DocumentExportRenderer, RenderedExport } from './document-export.renderer';

const MAX_MARKDOWN_CHARS = 120_000;
const RENDER_TIMEOUT_MS = 8_000;

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

    return Promise.race([
      this.renderPdf(input.markdown, input.metadata),
      new Promise<RenderedExport>((_, reject) => {
        setTimeout(() => {
          reject(new AppError('PDF_RENDER_FAILED', 'PDF rendering timed out.'));
        }, RENDER_TIMEOUT_MS);
      }),
    ]);
  }

  private async renderPdf(
    markdown: string,
    metadata: ApprovedReportMetadata,
  ): Promise<RenderedExport> {
    const doc = new PDFDocument({
      autoFirstPage: true,
      bufferPages: true,
      margins: { top: 48, right: 48, bottom: 48, left: 48 },
      info: {
        Title: metadata.title,
        Author: 'BA Helper',
        Subject: `Impact analysis ${metadata.analysisId}`,
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));

    this.writeTitle(doc, metadata.title);
    this.writeMetadata(doc, metadata);
    this.renderMarkdown(doc, markdown);

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
        this.writeHeading(doc, depth, line.replace(/^#+\s*/, ''));
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

  private writeTitle(doc: PDFKit.PDFDocument, title: string) {
    doc.font('Helvetica-Bold').fontSize(20).text(title, { align: 'left' });
    doc.moveDown(0.5);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#555555')
      .text('Approved report export generated from the persisted Markdown snapshot.', {
        align: 'left',
      });
    doc.fillColor('#000000');
    doc.moveDown(1);
  }

  private writeMetadata(doc: PDFKit.PDFDocument, metadata: ApprovedReportMetadata) {
    doc.font('Courier').fontSize(9);
    [
      `Analysis ID: ${metadata.analysisId}`,
      `Generated Document ID: ${metadata.generatedDocumentId}`,
      `Project ID: ${metadata.projectId}`,
      `Repository ID: ${metadata.repositoryId}`,
      `Target Ref: ${metadata.targetRef}`,
      `Snapshot ID: ${metadata.snapshotId}`,
      `Commit SHA: ${metadata.commitSha}`,
      `Analyzer Version: ${metadata.analyzerVersion}`,
      `Finalized At: ${metadata.finalizedAt ?? metadata.generatedAt}`,
      `Generated At: ${metadata.generatedAt}`,
      `Stale At Read Time: ${metadata.staleStatusAtReadTime ? 'yes' : 'no'}`,
    ].forEach((line) => doc.text(line));
    doc.moveDown(1);
  }

  private writeHeading(doc: PDFKit.PDFDocument, depth: number, text: string) {
    const size = depth === 1 ? 18 : depth === 2 ? 15 : 12;
    doc.moveDown(depth === 1 ? 0.8 : 0.4);
    doc.font('Helvetica-Bold').fontSize(size).text(this.sanitizeInline(text));
    doc.font('Helvetica').fontSize(10);
    doc.moveDown(0.4);
  }

  private writeParagraph(doc: PDFKit.PDFDocument, text: string) {
    doc.font('Helvetica').fontSize(10).text(text, {
      align: 'left',
      lineGap: 2,
    });
    doc.moveDown(0.6);
  }

  private writeBlockquote(doc: PDFKit.PDFDocument, text: string) {
    doc.save();
    const startX = doc.x;
    const startY = doc.y;
    doc.lineWidth(2).strokeColor('#999999').moveTo(startX, startY).lineTo(startX, startY + 28).stroke();
    doc.restore();
    doc.x = startX + 10;
    doc.font('Helvetica-Oblique').fontSize(10).fillColor('#444444').text(this.sanitizeInline(text), {
      width: 470,
      indent: 4,
    });
    doc.fillColor('#000000');
    doc.moveDown(0.6);
  }

  private writeList(doc: PDFKit.PDFDocument, lines: string[]) {
    lines.forEach((item, index) => {
      const ordered = /^\s*\d+\.\s+/.test(item);
      const bullet = ordered ? `${index + 1}.` : '•';
      const content = item.replace(/^\s*(?:-|\*|\d+\.)\s+/, '');
      const line = `${bullet} ${content}`;
      doc.font('Helvetica').fontSize(10).text(this.sanitizeInline(line), {
        indent: 12,
        lineGap: 1,
      });
    });
    doc.moveDown(0.6);
  }

  private writeCodeBlock(doc: PDFKit.PDFDocument, text: string) {
    doc.font('Courier').fontSize(9).fillColor('#1f2937').text(text, {
      width: 500,
      lineGap: 1,
    });
    doc.fillColor('#000000');
    doc.moveDown(0.8);
  }

  private writeTable(doc: PDFKit.PDFDocument, lines: string[]) {
    lines.forEach((line, index) => {
      if (/^\|\s*-/.test(line.trim())) {
        return;
      }
      doc.font(index === 0 ? 'Courier-Bold' : 'Courier').fontSize(8).text(this.sanitizeInline(line));
    });
    doc.moveDown(0.8);
  }

  private sanitizeInline(value: string) {
    return sanitizeHtml(value, {
      allowedTags: [],
      allowedAttributes: {},
    }).replace(/\s+/g, ' ').trim();
  }
}
