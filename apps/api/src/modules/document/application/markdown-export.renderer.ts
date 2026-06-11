import { Injectable } from '@nestjs/common';
import { sanitizeReportFilename } from '../domain/sanitize-filename.util';
import { ApprovedReportMetadata } from '../domain/approved-report-metadata';
import { DocumentExportRenderer, RenderedExport } from './document-export.renderer';

@Injectable()
export class MarkdownExportRenderer implements DocumentExportRenderer {
  async render(input: {
    markdown: string;
    metadata: ApprovedReportMetadata;
  }): Promise<RenderedExport> {
    return {
      contentType: 'text/markdown; charset=utf-8',
      filename: sanitizeReportFilename(input.metadata.title, 'md'),
      buffer: Buffer.from(input.markdown, 'utf-8'),
    };
  }
}
