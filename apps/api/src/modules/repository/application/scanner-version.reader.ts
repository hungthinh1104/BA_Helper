export function readScannerVersion(diagnostics: unknown): string | undefined {
  if (!Array.isArray(diagnostics)) return undefined;
  const health = diagnostics.find(item => isRecord(item) && item.code === 'SCAN_HEALTH');
  if (!isRecord(health) || !isRecord(health.payload)) return undefined;
  return typeof health.payload.scannerVersion === 'string' ? health.payload.scannerVersion : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
