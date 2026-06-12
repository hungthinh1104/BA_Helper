import { join } from 'node:path';
import { ScannerAdapterRegistry } from '../../src/scanner/scanner-adapter.registry';
import { SafeFileEnumerator } from '../../src/scanner/core/safe-file-enumerator';

describe('Go HTTP Impact Analysis Smoke Evaluation', () => {
  const fixturePath = join(__dirname, '../../../../tests/fixtures/go-http-basic');
  const registry = new ScannerAdapterRegistry();

  it('runs a deterministic scan-to-impact evaluation for Go HTTP endpoints', async () => {
    // 1. Profile Detection Simulation
    const language = 'go';
    const framework = 'net/http';
    
    // 2. Ensure adapter is selected correctly
    const adapter = registry.getAdapter(language, framework);
    expect(adapter).toBeDefined();
    expect(adapter.language).toBe('go');
    expect(adapter.framework).toBe('net/http');

    // 3. Enumerate & Scan
    const enumerator = new SafeFileEnumerator(fixturePath);
    const enumResult = await enumerator.enumerate();

    const scanResult = await adapter.scan({
      rootDir: fixturePath,
      fixturePath,
      goFiles: enumResult.goFiles,
      tsFiles: enumResult.tsFiles,
      javaFiles: enumResult.javaFiles,
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
      language: 'go',
      status: 'EXPERIMENTAL',
      confidence: 'LOW',
    });

    // 5. Assert diagnostics for unsupported patterns do not create fake impact
    const diagnosticsKeys = scanResult.diagnostics?.map(d => d.code) || [];
    expect(diagnosticsKeys).toContain('GO_DYNAMIC_ROUTE_UNSUPPORTED');
    expect(diagnosticsKeys).toContain('GO_ROUTE_GROUP_UNSUPPORTED');

    // Assert artifacts exist
    expect(scanResult.artifacts.length).toBeGreaterThan(0);

    // net/http routes remain method UNKNOWN
    const netHttpArtifact = scanResult.artifacts.find(a => a.stableId.includes('net_http'));
    expect(netHttpArtifact).toBeDefined();
    expect(netHttpArtifact?.stableId).toContain('UNKNOWN');

    // Gin routes keep explicit HTTP methods
    const ginArtifact = scanResult.artifacts.find(a => a.stableId.includes('gin'));
    expect(ginArtifact).toBeDefined();
    expect(ginArtifact?.stableId).toContain('POST');
    
    // Ensure dynamic routes aren't present
    const dynamicArtifact = scanResult.artifacts.find(a => a.symbolName.includes('/users/:id'));
    expect(dynamicArtifact).toBeUndefined();

    // 6. Deterministic Retrieval / Impact Analysis
    const requirementText = "When a booking payment is updated or refunded, the backend must identify the impacted payment/refund API handlers and service methods.";
    
    // Tokenize function matching our lexical retrieval logic
    const tokenize = (text: string): string[] => {
      const uncamelled = text.replace(/([a-z])([A-Z])/g, '$1 $2');
      const separated = uncamelled.replace(/[-_/\.]/g, ' ');
      const cleaned = separated.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const stops = new Set(['the', 'and', 'for', 'that', 'this', 'with', 'from', 'a', 'an', 'when', 'is', 'or', 'must']);
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

    // 7. Assert expected Go artifacts are present in impact result
    const impactedKeys = impactedArtifacts.map(a => a.stableId);

    // Check for refund endpoint
    const refundEndpoint = scanResult.artifacts.find(a => a.symbolName.includes('refund'));
    expect(refundEndpoint).toBeDefined();
    expect(impactedKeys).toContain(refundEndpoint!.stableId);

    // Check for update payment endpoint
    const updateEndpoint = scanResult.artifacts.find(a => a.symbolName.includes('updatePayment'));
    expect(updateEndpoint).toBeDefined();
    expect(impactedKeys).toContain(updateEndpoint!.stableId);

    // 8. Ensure deterministic output (stable hash)
    expect(refundEndpoint!.stableId).toMatch(/^go_http_endpoint__net_http__UNKNOWN__route_[a-f0-9]{8}__path_[a-f0-9]{8}__handler_processRefundHandler$/);
    expect(updateEndpoint!.stableId).toMatch(/^go_http_endpoint__gin__POST__route_[a-f0-9]{8}__path_[a-f0-9]{8}__handler_updatePaymentHandler$/);
  });
});
