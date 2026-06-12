import { join } from 'node:path';
import { ScannerAdapterRegistry } from '../../src/scanner/scanner-adapter.registry';
import { SafeFileEnumerator } from '../../src/scanner/core/safe-file-enumerator';

describe('Java/Spring Impact Analysis Smoke Evaluation', () => {
  const fixturePath = join(__dirname, '../../../../tests/fixtures/java-spring-basic');
  const registry = new ScannerAdapterRegistry();

  it('runs a deterministic scan-to-impact evaluation for Java/Spring', async () => {
    // 1. Profile Detection Simulation
    const language = 'java';
    const framework = 'spring_boot';

    // 2. Ensure adapter is selected correctly
    const adapter = registry.getAdapter(language, framework);
    expect(adapter).toBeDefined();
    expect(adapter.language).toBe('java');
    expect(adapter.framework).toBe('spring_boot');

    // 3. Enumerate & Scan
    const enumerator = new SafeFileEnumerator(fixturePath);
    const enumResult = await enumerator.enumerate();

    const scanResult = await adapter.scan({
      rootDir: fixturePath,
      fixturePath,
      javaFiles: enumResult.javaFiles,
      tsFiles: enumResult.tsFiles,
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
      language: 'java',
      framework: 'spring_boot',
      status: 'PARTIAL',
      confidence: 'MEDIUM',
    });

    // 5. Assert artifacts exist
    expect(scanResult.artifacts.length).toBeGreaterThan(0);

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

    // 7. Assert expected Java artifacts are present in impact result
    const impactedKeys = impactedArtifacts.map(a => a.stableId);

    // Check for controller endpoint
    expect(impactedKeys).toContain(
      scanResult.artifacts.find(a => a.stableId.includes('PaymentController.updatePayment'))?.stableId || 'MISSING_CONTROLLER_ENDPOINT'
    );
    // Check for service method
    expect(impactedKeys).toContain(
      scanResult.artifacts.find(a => a.stableId.includes('RefundService.processRefund'))?.stableId || 'MISSING_SERVICE_METHOD'
    );
    // Check for related endpoints
    const refundEndpoint = scanResult.artifacts.find(a => a.stableId.includes('POST:/api/payments'));
    expect(refundEndpoint).toBeDefined();
    expect(impactedKeys).toContain(refundEndpoint!.stableId);

    // 8. Ensure no TS fallback happened by checking there are no TS artifacts generated
    // (Our Java fixture does not have TS files, but this ensures the adapter didn't default to parsing TS ASTs blindly)
    const hasTSArtifacts = scanResult.artifacts.some(a => a.filePath.endsWith('.ts'));
    expect(hasTSArtifacts).toBe(false);
  });
});
