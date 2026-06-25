import { AppError } from '@ba-helper/shared';
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

  it('renders a deterministic PDF buffer with various markdown elements', async () => {
    const markdownWithElements = `
# Approved report

This is a paragraph with some text.

## Details

> This is a blockquote.

- List item 1
- List item 2

\`\`\`typescript
const foo = "bar";
\`\`\`

| Domain | Repository | Risk |
|---|---|---|
| Payments | payment-service | High |
| Booking | booking-service | Low |
`;

    const result = await renderer.render({
      markdown: markdownWithElements,
      metadata,
    });

    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.buffer.length).toBeGreaterThan(0);
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
