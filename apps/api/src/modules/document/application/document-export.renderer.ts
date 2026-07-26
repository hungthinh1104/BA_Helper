import { ApprovedReportMetadata } from "@ba-helper/backend-runtime";

export type ExportFormat = 'markdown' | 'pdf';

export type RenderedExport = {
  contentType: string;
  filename: string;
  buffer: Buffer;
};

export interface DocumentExportRenderer {
  render(input: {
    markdown: string;
    metadata: ApprovedReportMetadata;
  }): Promise<RenderedExport>;
}
