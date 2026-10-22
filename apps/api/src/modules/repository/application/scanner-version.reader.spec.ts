import { readScannerVersion } from './scanner-version.reader';

describe('readScannerVersion', () => {
  it('reads the scanner version from the persisted scan health diagnostic', () => {
    expect(readScannerVersion([{ code: 'SCAN_HEALTH', payload: { scannerVersion: 'scanner@0.4.0' } }]))
      .toBe('scanner@0.4.0');
  });

  it('returns undefined for missing or malformed historical diagnostics', () => {
    expect(readScannerVersion(undefined)).toBeUndefined();
    expect(readScannerVersion([{ code: 'SCAN_HEALTH', payload: { scannerVersion: 4 } }])).toBeUndefined();
  });
});
