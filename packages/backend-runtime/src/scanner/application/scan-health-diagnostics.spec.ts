import { ANALYZER_VERSION, SCANNER_VERSION } from '@ba-helper/analyzer';
import { addScanHealthDiagnostic } from './scan-persistence-mappers';

describe('scan health diagnostics', () => {
  it('reports source file count and artifact count separately with the current scanner version', () => {
    const collector = { add: jest.fn(), addSecretRedacted: jest.fn(), getItems: () => [] };
    addScanHealthDiagnostic({
      collector,
      scanResult: {
        analyzerVersion: ANALYZER_VERSION,
        scannedFileCount: 3,
        artifacts: [
          { stableId: 'a', type: 'SERVICE_METHOD', filePath: 'src/a.ts', symbolName: 'A.run', startLine: 1, endLine: 1, excerpt: '' },
          { stableId: 'b', type: 'SERVICE_METHOD', filePath: 'src/a.ts', symbolName: 'A.stop', startLine: 2, endLine: 2, excerpt: '' },
        ],
        coverage: { status: 'FULL', skippedSummary: {} },
      } as any,
    });

    expect(collector.add).toHaveBeenCalledWith(expect.objectContaining({
      code: 'SCAN_HEALTH',
      payload: expect.objectContaining({
        scannerVersion: SCANNER_VERSION,
        analyzerVersion: ANALYZER_VERSION,
        scannedFileCount: 3,
        artifactCount: 2,
      }),
    }));
  });
});
