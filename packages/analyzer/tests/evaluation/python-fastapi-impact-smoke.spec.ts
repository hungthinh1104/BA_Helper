import { join } from 'node:path';
import { ScannerAdapterRegistry } from '../../src/scanner/scanner-adapter.registry';
import { SafeFileEnumerator } from '../../src/scanner/core/safe-file-enumerator';

describe('Python/FastAPI Impact Analysis Smoke Evaluation', () => {
  const fixturePath = join(__dirname, '../../../../tests/fixtures/python-fastapi-basic');
  const registry = new ScannerAdapterRegistry();

  it('runs a deterministic scan-to-impact evaluation for Python/FastAPI HTTP endpoints', async () => {
    // 1. Profile Detection Simulation
    const language = 'python';
    
    // 2. Ensure adapter is selected correctly
    const adapter = registry.getAdapter(language, 'fastapi');
    expect(adapter).toBeDefined();
    expect(adapter.language).toBe('python');
    expect(adapter.framework).toBe('fastapi');

    // 3. Enumerate & Scan
    const enumerator = new SafeFileEnumerator(fixturePath);
    const enumResult = await enumerator.enumerate();
    
    expect(enumResult.pyFiles).toBeDefined();
    expect(enumResult.pyFiles.length).toBeGreaterThan(0);

    const scanResult = await adapter.scan({
      rootDir: fixturePath,
      fixturePath,
      goFiles: enumResult.goFiles,
      tsFiles: enumResult.tsFiles,
      javaFiles: enumResult.javaFiles,
      pyFiles: enumResult.pyFiles,
      coverage: {
        status: 'PARTIAL',
        skippedFiles: [],
        skippedSummary: enumResult.skippedSummary,
        limits: enumResult.limits,
        limitHits: enumResult.limitHits,
      }
    });

    // 4. Assert capability payload
    const capabilityCode = scanResult.diagnostics?.find(d => d.code === 'SCANNER_CAPABILITY_SUMMARY');
    expect(capabilityCode).toBeDefined();
    expect(capabilityCode?.payload).toMatchObject({
      language: 'python',
      status: 'EXPERIMENTAL',
      confidence: 'LOW',
    });

    // 5. Assert diagnostics for unsupported patterns do not create fake impact
    const diagnosticsKeys = scanResult.diagnostics?.map(d => d.code) || [];

    // prefix.py contributes this — APIRouter(prefix=...) detected
    expect(diagnosticsKeys).toContain('PY_ROUTER_PREFIX_UNSUPPORTED');
    // main.py f-string route contributes this
    expect(diagnosticsKeys).toContain('PY_DYNAMIC_ROUTE_UNSUPPORTED');
    // main.py Depends(...) on delete route contributes this
    expect(diagnosticsKeys).toContain('PY_DEPENDENCY_INJECTION_BOUNDARY');

    // Assert artifacts exist (supported routes only)
    expect(scanResult.artifacts.length).toBeGreaterThan(0);

    // Filter out unsupported routes
    const artifactsNames = scanResult.artifacts.map(a => a.symbolName);
    expect(artifactsNames).not.toContain('POST /unsupported_prefix -> unsupported_prefix_route');
    expect(artifactsNames).not.toContain('GET /refunds/{dynamic} -> dynamic_refund_status');

    // Check supported routes
    expect(artifactsNames).toContain('GET /refunds/{refund_id} -> get_refund');
    expect(artifactsNames).toContain('POST /refunds -> create_refund');
    expect(artifactsNames).toContain('GET /bookings -> get_bookings');
    expect(artifactsNames).toContain('DELETE /refunds/{refund_id} -> delete_refund');

    // 6. Deterministic Retrieval / Impact Analysis
    const requirementText = "Allow users to cancel paid bookings and receive refunds.";
    
    // Tokenize function matching our lexical retrieval logic
    const tokenize = (text: string): string[] => {
      const uncamelled = text.replace(/([a-z])([A-Z])/g, '$1 $2');
      const separated = uncamelled.replace(/[-_/\.]/g, ' ');
      const cleaned = separated.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const stops = new Set(['the', 'and', 'for', 'that', 'this', 'with', 'from', 'a', 'an', 'when', 'is', 'or', 'must', 'to', 'receive']);
      return Array.from(new Set(cleaned.split(' ').filter(t => t.length > 2 && !stops.has(t))));
    };

    const queryTokens = tokenize(requirementText);

    // Score Artifacts
    const scoredArtifacts = scanResult.artifacts.map(artifact => {
      const artifactTokens = new Set([
        ...tokenize(artifact.stableId),
        ...tokenize(artifact.symbolName || ''),
        ...tokenize(artifact.filePath || ''),
        ...tokenize(artifact.type || ''),
      ]);

      let score = 0;
      for (const qt of queryTokens) {
        if (artifactTokens.has(qt)) {
          score += 1;
        }
      }
      return { artifact, score };
    });

    // Sort by score
    scoredArtifacts.sort((a, b) => b.score - a.score);

    // Filter top matches (score > 0)
    const impactedArtifacts = scoredArtifacts.filter(s => s.score > 0).map(s => s.artifact);

    // 7. Assert expected Python artifacts are present in impact result
    const impactedKeys = impactedArtifacts.map(a => a.stableId);

    // Check for refund endpoint
    const refundEndpoint = scanResult.artifacts.find(a => a.symbolName === 'GET /refunds/{refund_id} -> get_refund');
    expect(refundEndpoint).toBeDefined();
    expect(impactedKeys).toContain(refundEndpoint!.stableId);

    const bookingEndpoint = scanResult.artifacts.find(a => a.symbolName === 'GET /bookings -> get_bookings');
    expect(bookingEndpoint).toBeDefined();
    expect(impactedKeys).toContain(bookingEndpoint!.stableId);

    // 8. Ensure deterministic output (stable hash)
    expect(refundEndpoint!.stableId).toMatch(/^python_http_endpoint__fastapi__GET__route_[a-f0-9]{8}__path_[a-f0-9]{8}__handler_get_refund$/);
  });
});
