import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import sanitizeHtml from 'sanitize-html';
import { AppError } from '@ba-helper/shared';
import { sanitizeReportFilename } from '../domain/sanitize-filename.util';
import { DocumentExportRenderer, RenderedExport } from './document-export.renderer';
import { PDF_REPORT_THEME } from './pdf-report-theme';
import { PageMargins } from './pdf-renderer.types';
import { wrapLongTokens } from './pdf-renderer-sanitizer';
import { PdfMarkdownRenderer } from './pdf-markdown.renderer';
import { ApprovedReportMetadata } from "@ba-helper/backend-runtime";

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
    new PdfMarkdownRenderer().renderMarkdown(doc, markdown);
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
    const valueHeight = doc.heightOfString(wrapLongTokens(card.value), {
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
      .text(wrapLongTokens(card.value), x + pad, y + pad + 14, {
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

  private contentWidth(doc: PDFKit.PDFDocument): number {
    const margins = doc.page.margins as PageMargins;
    return doc.page.width - margins.left - margins.right;
  }

}
