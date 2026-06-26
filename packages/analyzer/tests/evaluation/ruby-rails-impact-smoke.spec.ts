import { join } from 'node:path';
import { ScannerAdapterRegistry } from '../../src/scanner/scanner-adapter.registry';
import { SafeFileEnumerator } from '../../src/scanner/core/safe-file-enumerator';
import { DiagnosticRiskEvaluator } from '@ba-helper/application';

describe('Ruby/Rails Impact Analysis Smoke Evaluation', () => {
  const fixturePath = join(__dirname, '../../../../tests/fixtures/ruby-rails-basic');
  const registry = new ScannerAdapterRegistry();

  it('runs a deterministic scan-to-impact evaluation for Ruby/Rails HTTP endpoints', async () => {
    // 1. Explicit adapter selection — ruby + rails only
    const adapter = registry.getAdapter('ruby', 'rails');
    expect(adapter).toBeDefined();
    expect(adapter.language).toBe('ruby');
    expect(adapter.framework).toBe('rails');

    // 2. Enumerate .rb files
    const enumerator = new SafeFileEnumerator(fixturePath);
    const enumResult = await enumerator.enumerate();

    expect(enumResult.rbFiles).toBeDefined();
    expect(enumResult.rbFiles.length).toBeGreaterThan(0);

    const scanResult = await adapter.scan({
      rootDir: fixturePath,
      fixturePath,
      tsFiles: enumResult.tsFiles,
      javaFiles: enumResult.javaFiles,
      goFiles: enumResult.goFiles,
      pyFiles: enumResult.pyFiles,
      csFiles: enumResult.csFiles,
      phpFiles: enumResult.phpFiles,
      rbFiles: enumResult.rbFiles,
      coverage: {
        status: 'PARTIAL',
        skippedFiles: [],
        skippedSummary: enumResult.skippedSummary,
        limits: enumResult.limits,
        limitHits: enumResult.limitHits,
      },
    });

    // 3. SCANNER_CAPABILITY_SUMMARY must be EXPERIMENTAL / LOW
    const capSummary = scanResult.diagnostics?.find(d => d.code === 'SCANNER_CAPABILITY_SUMMARY');
    expect(capSummary).toBeDefined();
    expect(capSummary?.payload).toMatchObject({
      language: 'ruby',
      framework: 'rails',
      status: 'EXPERIMENTAL',
      confidence: 'LOW',
    });

    // 4. Unsupported patterns produce diagnostics — not fake artifacts
    const diagCodes = scanResult.diagnostics?.map(d => d.code) ?? [];

    expect(diagCodes).toContain('RB_RESOURCE_ROUTE_UNSUPPORTED');
    expect(diagCodes).toContain('RB_NAMESPACE_ROUTE_UNSUPPORTED');
    expect(diagCodes).toContain('RB_SCOPE_ROUTE_UNSUPPORTED');
    expect(diagCodes).toContain('RB_DYNAMIC_ROUTE_UNSUPPORTED');
    expect(diagCodes).toContain('RB_MOUNTED_ENGINE_UNSUPPORTED');
    expect(diagCodes).toContain('RB_CONTROLLER_RESOLUTION_BOUNDARY'); // from legacy hash rocket syntax

    // 5. Supported routes extracted as HTTP_ENDPOINT artifacts
    expect(scanResult.artifacts.length).toBeGreaterThan(0);
    expect(scanResult.artifacts.every(a => a.type === 'HTTP_ENDPOINT')).toBe(true);

    const symbolNames = scanResult.artifacts.map(a => a.symbolName);

    // Modern string syntax
    expect(symbolNames).toContain('GET /refunds/:id -> refunds#show');
    expect(symbolNames).toContain('POST /refunds -> refunds#create');
    expect(symbolNames).toContain('PUT /bookings/:booking_id -> bookings#update');
    
    // Legacy string syntax
    expect(symbolNames).toContain('DELETE /bookings/:booking_id -> bookings#destroy');

    // Nested blocks are extracted but diagnostics flag that their namespace is missing, 
    // proving lexical scanner bound behavior without fake expansion
    expect(symbolNames).toContain('GET /dashboard -> dashboard#index');
    expect(symbolNames).toContain('GET /metrics -> metrics#show');
    
    // Unsupported patterns produce NO artifacts (dynamic interpolation, resource, mounted engines)
    expect(symbolNames).not.toContain('GET /invoices -> invoices#index');
    expect(symbolNames).not.toContain('GET /dynamic/#{version}/route -> dynamic#show');

    // 6. Lexical impact retrieval
    const requirementText =
      'Allow users to cancel paid bookings and receive refunds. Booking and refund endpoints must be updated.';

    const tokenize = (text: string): string[] => {
      const uncamelled = text.replace(/([a-z])([A-Z])/g, '$1 $2');
      const separated = uncamelled.replace(/[-_/\\.:#]/g, ' ');
      const cleaned = separated
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const stops = new Set([
        'the', 'and', 'for', 'that', 'this', 'with', 'from', 'a', 'an',
        'when', 'is', 'or', 'must', 'to', 'be',
      ]);
      return Array.from(
        new Set(cleaned.split(' ').filter(t => t.length > 2 && !stops.has(t))),
      );
    };

    const queryTokens = tokenize(requirementText);

    const scoredArtifacts = scanResult.artifacts.map(artifact => {
      const artifactTokens = new Set([
        ...tokenize(artifact.stableId),
        ...tokenize(artifact.symbolName ?? ''),
        ...tokenize(artifact.filePath ?? ''),
        ...tokenize(artifact.type ?? ''),
      ]);
      let score = 0;
      for (const qt of queryTokens) {
        if (artifactTokens.has(qt)) score += 1;
      }
      return { artifact, score };
    });

    scoredArtifacts.sort((a, b) => b.score - a.score);
    const impactedArtifacts = scoredArtifacts.filter(s => s.score > 0).map(s => s.artifact);
    const impactedKeys = impactedArtifacts.map(a => a.stableId);

    // "refund" tokens match refund artifacts
    const refundGet = scanResult.artifacts.find(
      a => a.symbolName === 'GET /refunds/:id -> refunds#show',
    );
    expect(refundGet).toBeDefined();
    expect(impactedKeys).toContain(refundGet!.stableId);

    const refundPost = scanResult.artifacts.find(
      a => a.symbolName === 'POST /refunds -> refunds#create',
    );
    expect(refundPost).toBeDefined();
    expect(impactedKeys).toContain(refundPost!.stableId);

    // "booking" + "update" match booking artifacts
    const bookingPut = scanResult.artifacts.find(
      a => a.symbolName === 'PUT /bookings/:booking_id -> bookings#update',
    );
    expect(bookingPut).toBeDefined();
    expect(impactedKeys).toContain(bookingPut!.stableId);

    const bookingDelete = scanResult.artifacts.find(
      a => a.symbolName === 'DELETE /bookings/:booking_id -> bookings#destroy',
    );
    expect(bookingDelete).toBeDefined();
    expect(impactedKeys).toContain(bookingDelete!.stableId);

    // 7. stableId / artifactKey generation is deterministic and path-safe
    expect(refundGet!.stableId).toMatch(
      /^ruby_http_endpoint__rails__GET__route_[a-f0-9]{8}__path_[a-f0-9]{8}__handler_refunds_show$/,
    );
    expect(bookingPut!.stableId).toMatch(
      /^ruby_http_endpoint__rails__PUT__route_[a-f0-9]{8}__path_[a-f0-9]{8}__handler_bookings_update$/,
    );

    // 8. Phase 45A: Verify diagnostic-derived risk propagation
    const resourceDiag = scanResult.diagnostics?.find(d => d.code === 'RB_RESOURCE_ROUTE_UNSUPPORTED');
    expect(resourceDiag).toBeDefined();
    expect(resourceDiag?.payload?.candidateTerms).toBeDefined();
    
    // "invoices" should not match the requirement about "refunds" and "bookings"
    const isRelevant = DiagnosticRiskEvaluator.isRelevant(
      requirementText,
      resourceDiag?.payload?.candidateTerms as string[] || []
    );
    expect(isRelevant).toBe(false); 
    
    // But "refunds" should match
    const isRefundRelevant = DiagnosticRiskEvaluator.isRelevant(
      requirementText,
      ['refunds']
    );
    expect(isRefundRelevant).toBe(true);
  });
});
