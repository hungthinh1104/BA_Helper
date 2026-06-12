import { join } from 'node:path';
import { ScannerAdapterRegistry } from '../../src/scanner/scanner-adapter.registry';
import { SafeFileEnumerator } from '../../src/scanner/core/safe-file-enumerator';

describe('C# / ASP.NET Core Impact Analysis Smoke Evaluation', () => {
  const fixturePath = join(__dirname, '../../../../tests/fixtures/csharp-aspnetcore-basic');
  const registry = new ScannerAdapterRegistry();

  it('runs a deterministic scan-to-impact evaluation for C# ASP.NET Core HTTP endpoints', async () => {
    // 1. Explicit adapter selection — csharp + aspnetcore only
    const adapter = registry.getAdapter('csharp', 'aspnetcore');
    expect(adapter).toBeDefined();
    expect(adapter.language).toBe('csharp');
    expect(adapter.framework).toBe('aspnetcore');

    // 2. Enumerate .cs files
    const enumerator = new SafeFileEnumerator(fixturePath);
    const enumResult = await enumerator.enumerate();

    expect(enumResult.csFiles).toBeDefined();
    expect(enumResult.csFiles.length).toBeGreaterThan(0);

    const scanResult = await adapter.scan({
      rootDir: fixturePath,
      fixturePath,
      tsFiles: enumResult.tsFiles,
      javaFiles: enumResult.javaFiles,
      goFiles: enumResult.goFiles,
      pyFiles: enumResult.pyFiles,
      csFiles: enumResult.csFiles,
      coverage: {
        status: 'PARTIAL',
        skippedFiles: [],
        skippedSummary: enumResult.skippedSummary,
        limits: enumResult.limits,
        limitHits: enumResult.limitHits,
      },
    });

    // 3. SCANNER_CAPABILITY_SUMMARY must be present and EXPERIMENTAL / LOW
    const capSummary = scanResult.diagnostics?.find(d => d.code === 'SCANNER_CAPABILITY_SUMMARY');
    expect(capSummary).toBeDefined();
    expect(capSummary?.payload).toMatchObject({
      language: 'csharp',
      status: 'EXPERIMENTAL',
      confidence: 'LOW',
    });

    // 4. Unsupported patterns produce diagnostics — not fake artifacts
    const diagCodes = scanResult.diagnostics?.map(d => d.code) ?? [];

    // [Route("api/[controller]")] in RefundController.cs
    expect(diagCodes).toContain('CS_ROUTE_TOKEN_UNSUPPORTED');
    // MapGroup in Program.cs
    expect(diagCodes).toContain('CS_MINIMAL_API_GROUP_UNSUPPORTED');
    // [FromServices] in constructor in RefundController.cs
    expect(diagCodes).toContain('CS_DI_BOUNDARY');
    // dynamic path variable in Program.cs
    expect(diagCodes).toContain('CS_DYNAMIC_ROUTE_UNSUPPORTED');

    // 5. Supported routes extracted as HTTP_ENDPOINT artifacts
    expect(scanResult.artifacts.length).toBeGreaterThan(0);
    expect(scanResult.artifacts.every(a => a.type === 'HTTP_ENDPOINT')).toBe(true);

    const symbolNames = scanResult.artifacts.map(a => a.symbolName);

    // Controller routes
    expect(symbolNames).toContain('GET refunds/{refundId} -> GetRefund');
    expect(symbolNames).toContain('POST refunds -> CreateRefund');

    // Minimal API routes
    expect(symbolNames).toContain('GET /bookings/{bookingId} -> GetBooking');
    expect(symbolNames).toContain('POST /bookings -> CreateBooking');

    // Unsupported MapGroup and dynamic path do NOT produce artifacts
    expect(symbolNames).not.toContain('GET /api/status -> GetStatus');
    expect(symbolNames).not.toContain('GET /dynamic/route -> GetDynamic');

    // 6. Lexical impact retrieval — requirement tokens match supported artifacts
    const requirementText =
      'Allow users to cancel paid bookings and receive refunds. Booking and refund endpoints must be updated.';

    const tokenize = (text: string): string[] => {
      const uncamelled = text.replace(/([a-z])([A-Z])/g, '$1 $2');
      const separated = uncamelled.replace(/[-_/\\.{}]/g, ' ');
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

    // "refund" token must hit refund endpoints
    const refundGet = scanResult.artifacts.find(
      a => a.symbolName === 'GET refunds/{refundId} -> GetRefund',
    );
    expect(refundGet).toBeDefined();
    expect(impactedKeys).toContain(refundGet!.stableId);

    const refundPost = scanResult.artifacts.find(
      a => a.symbolName === 'POST refunds -> CreateRefund',
    );
    expect(refundPost).toBeDefined();
    expect(impactedKeys).toContain(refundPost!.stableId);

    // "booking" token must hit booking endpoints
    const bookingGet = scanResult.artifacts.find(
      a => a.symbolName === 'GET /bookings/{bookingId} -> GetBooking',
    );
    expect(bookingGet).toBeDefined();
    expect(impactedKeys).toContain(bookingGet!.stableId);

    // 7. Deterministic stableId format
    expect(refundGet!.stableId).toMatch(
      /^csharp_http_endpoint__aspnetcore__GET__route_[a-f0-9]{8}__path_[a-f0-9]{8}__handler_GetRefund$/,
    );
    expect(bookingGet!.stableId).toMatch(
      /^csharp_http_endpoint__aspnetcore__GET__route_[a-f0-9]{8}__path_[a-f0-9]{8}__handler_GetBooking$/,
    );
  });
});
