import { EvaluationPaths } from '../core/paths';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { validateCasesDataset } from './validate-cases';
import { loadDataset } from '../../io';

describe('validateCasesDataset', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'reqimpact-eval-'));

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('treats a missing dataset file as a non-fatal skip path', () => {
    const result = validateCasesDataset(join(tempDir, 'missing.json'));

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([
      expect.stringContaining('Dataset file not found'),
    ]);
  });

  it('validates a structurally valid dataset', () => {
    const datasetPath = join(tempDir, 'valid.json');
    writeFileSync(
      datasetPath,
      JSON.stringify({
        version: 'cases.v0',
        generatedBy: 'test',
        cases: [
          {
            id: 'case-001',
            repo: 'owner/repo',
            baseSha: 'abc123',
            requirementText: 'Cancel paid booking and refund payment.',
            groundTruth: {
              files: ['src/booking/booking.service.ts'],
            },
            candidateArtifacts: [
              {
                artifactKey: 'service:booking.cancel',
                filePath: 'src/booking/booking.service.ts',
                artifactName: 'cancelBooking',
                artifactType: 'SERVICE_METHOD',
              },
              {
                artifactKey: 'service:payment.refund',
                filePath: 'src/payment/payment.service.ts',
                artifactName: 'refundPayment',
                artifactType: 'SERVICE_METHOD',
              },
            ],
          },
        ],
      }),
      'utf8',
    );

    const result = validateCasesDataset(datasetPath);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('warns when candidateArtifacts file set equals groundTruth.files exactly', () => {
    const datasetPath = join(tempDir, 'prefiltered.json');
    writeFileSync(
      datasetPath,
      JSON.stringify({
        cases: [
          {
            id: 'case-002',
            repo: 'owner/repo',
            baseSha: 'def456',
            requirementText: 'Refund cancellation.',
            groundTruth: {
              files: ['src/payment/payment.service.ts'],
            },
            candidateArtifacts: [
              {
                artifactKey: 'service:payment.refund',
                filePath: 'src/payment/payment.service.ts',
                artifactName: 'refundPayment',
                artifactType: 'SERVICE_METHOD',
              },
            ],
          },
        ],
      }),
      'utf8',
    );

    const result = validateCasesDataset(datasetPath);

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        caseId: 'case-002',
      }),
    ]);
  });

  it('labels Case 006 as scanner-aligned clean retrieval metadata', () => {
    const dataset = loadDataset(EvaluationPaths.datasetV0.cases);
    const case006 = dataset.cases.find(
      (item) => item.id === 'reqimpact-case-006-squareboat-default-includes',
    );

    expect(case006?.evaluationScope).toBeUndefined();
    expect(case006?.scannerCoverageNote).toMatch(/persisted as a FILE CodeArtifact/i);
    expect(case006?.candidateArtifacts[0]).toEqual(
      expect.objectContaining({
        artifactKey: 'file:libs.boat.src.transformers.transformer.ts',
        artifactType: 'FILE',
      }),
    );
  });
});
