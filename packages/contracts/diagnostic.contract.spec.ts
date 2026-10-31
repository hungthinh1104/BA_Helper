import { scanHealthDiagnosticPayloadSchema } from './src';

const validScanHealthPayload = {
  coverageStatus: 'FULL',
  scannerVersion: 'scanner@0.7.1',
  analyzerVersion: 'analyzer@0.16.0',
  scannedFileCount: 12,
  skippedFileCount: 1,
  artifactCount: 5,
  skippedSummary: { BINARY_FILE: 1 },
  skippedFilesSample: [{ path: 'assets/archive.bin', reason: 'BINARY_FILE' }],
  limits: { maxFiles: 100, maxFileBytes: 1024 },
  limitHits: { fileLimitHit: false, repoSizeLimitHit: false },
};

describe('scan health diagnostic payload contract', () => {
  it('accepts the persisted scanner diagnostic shape', () => {
    expect(scanHealthDiagnosticPayloadSchema.parse(validScanHealthPayload)).toEqual(
      validScanHealthPayload,
    );
  });

  it('rejects incomplete or invalid scan-health data', () => {
    expect(scanHealthDiagnosticPayloadSchema.safeParse({
      ...validScanHealthPayload,
      coverageStatus: 'UNKNOWN',
      skippedFilesSample: [{ path: 42, reason: 'BINARY_FILE' }],
    }).success).toBe(false);
  });
});
