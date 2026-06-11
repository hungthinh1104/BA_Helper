import { AppError } from '../../../shared/app-error';
import { PdfExportRenderer } from './pdf-export.renderer';

describe('PdfExportRenderer', () => {
  const renderer = new PdfExportRenderer();

  const metadata = {
    analysisId: 'analysis-1',
    title: 'Refund paid bookings',
    projectId: 'project-1',
    repositoryId: 'repo-1',
    targetRef: 'main',
    commitSha: 'abc1234',
    snapshotId: 'snapshot-1',
    analyzerVersion: '1.0.0',
    generatedDocumentId: 'doc-1',
    generatedAt: '2026-06-06T00:00:00.000Z',
    finalizedAt: '2026-06-06T00:00:00.000Z',
    staleStatusAtReadTime: false,
  };

  it('renders a deterministic PDF buffer', async () => {
    const result = await renderer.render({
      markdown: '# Approved report\n\n## Evidence Appendix\n\n- persisted',
      metadata,
    });

    expect(result.contentType).toBe('application/pdf');
    expect(result.filename).toBe('refund-paid-bookings-impact-report.pdf');
    expect(result.buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('rejects oversized markdown', async () => {
    await expect(
      renderer.render({
        markdown: 'a'.repeat(120_001),
        metadata,
      }),
    ).rejects.toMatchObject({
      code: 'PDF_RENDER_FAILED',
    } satisfies Partial<AppError>);
  });
});
