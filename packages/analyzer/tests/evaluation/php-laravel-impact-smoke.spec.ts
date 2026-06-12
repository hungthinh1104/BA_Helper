import { join } from 'node:path';
import { ScannerAdapterRegistry } from '../../src/scanner/scanner-adapter.registry';
import { SafeFileEnumerator } from '../../src/scanner/core/safe-file-enumerator';

describe('PHP/Laravel Impact Analysis Smoke Evaluation', () => {
  const fixturePath = join(__dirname, '../../../../tests/fixtures/php-laravel-basic');
  const registry = new ScannerAdapterRegistry();

  it('runs a deterministic scan-to-impact evaluation for PHP/Laravel HTTP endpoints', async () => {
    // 1. Explicit adapter selection — php + laravel only
    const adapter = registry.getAdapter('php', 'laravel');
    expect(adapter).toBeDefined();
    expect(adapter.language).toBe('php');
    expect(adapter.framework).toBe('laravel');

    // 2. Enumerate .php files
    const enumerator = new SafeFileEnumerator(fixturePath);
    const enumResult = await enumerator.enumerate();

    expect(enumResult.phpFiles).toBeDefined();
    expect(enumResult.phpFiles.length).toBeGreaterThan(0);

    const scanResult = await adapter.scan({
      rootDir: fixturePath,
      fixturePath,
      tsFiles: enumResult.tsFiles,
      javaFiles: enumResult.javaFiles,
      goFiles: enumResult.goFiles,
      pyFiles: enumResult.pyFiles,
      csFiles: enumResult.csFiles,
      phpFiles: enumResult.phpFiles,
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
      language: 'php',
      framework: 'laravel',
      status: 'EXPERIMENTAL',
      confidence: 'LOW',
    });

    // 4. Unsupported patterns produce diagnostics — not fake artifacts
    const diagCodes = scanResult.diagnostics?.map(d => d.code) ?? [];

    // Route::resource in api.php
    expect(diagCodes).toContain('PHP_RESOURCE_ROUTE_UNSUPPORTED');
    // Route::group in api.php
    expect(diagCodes).toContain('PHP_ROUTE_GROUP_UNSUPPORTED');
    // ->middleware() on admin refund route
    expect(diagCodes).toContain('PHP_MIDDLEWARE_BOUNDARY');
    // dynamic $path variable
    expect(diagCodes).toContain('PHP_DYNAMIC_ROUTE_UNSUPPORTED');
    // legacy 'BookingController@destroy' string handler
    expect(diagCodes).toContain('PHP_CONTROLLER_RESOLUTION_BOUNDARY');

    // 5. Supported routes extracted as HTTP_ENDPOINT artifacts
    expect(scanResult.artifacts.length).toBeGreaterThan(0);
    expect(scanResult.artifacts.every(a => a.type === 'HTTP_ENDPOINT')).toBe(true);

    const symbolNames = scanResult.artifacts.map(a => a.symbolName);

    // Array handler routes
    expect(symbolNames).toContain('GET /refunds/{id} -> RefundController@show');
    expect(symbolNames).toContain('POST /refunds -> RefundController@store');
    expect(symbolNames).toContain('PUT /bookings/{id} -> BookingController@update');
    // Legacy string handler — extracted with boundary diagnostic
    expect(symbolNames).toContain('DELETE /bookings/{id} -> BookingController@destroy');
    // Middleware route still extracted
    expect(symbolNames).toContain('GET /admin/refunds -> RefundController@adminIndex');

    // Unsupported patterns produce NO artifacts
    expect(symbolNames).not.toContain('GET /invoices -> InvoiceController@index');
    expect(symbolNames).not.toContain('GET /api/payments -> PaymentController@index');
    expect(symbolNames).not.toContain('GET /dynamic/route -> RefundController@dynamic');

    // 6. Lexical impact retrieval
    const requirementText =
      'Allow users to cancel paid bookings and receive refunds. Booking and refund endpoints must be updated.';

    const tokenize = (text: string): string[] => {
      const uncamelled = text.replace(/([a-z])([A-Z])/g, '$1 $2');
      const separated = uncamelled.replace(/[-_/\\.{}@]/g, ' ');
      const cleaned = separated
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const stops = new Set([
        'the', 'and', 'for', 'that', 'this', 'with', 'from', 'a', 'an',
        'when', 'is', 'or', 'must', 'to', 'be', 'class',
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
      a => a.symbolName === 'GET /refunds/{id} -> RefundController@show',
    );
    expect(refundGet).toBeDefined();
    expect(impactedKeys).toContain(refundGet!.stableId);

    const refundPost = scanResult.artifacts.find(
      a => a.symbolName === 'POST /refunds -> RefundController@store',
    );
    expect(refundPost).toBeDefined();
    expect(impactedKeys).toContain(refundPost!.stableId);

    // "booking" + "update" match booking artifacts
    const bookingPut = scanResult.artifacts.find(
      a => a.symbolName === 'PUT /bookings/{id} -> BookingController@update',
    );
    expect(bookingPut).toBeDefined();
    expect(impactedKeys).toContain(bookingPut!.stableId);

    const bookingDelete = scanResult.artifacts.find(
      a => a.symbolName === 'DELETE /bookings/{id} -> BookingController@destroy',
    );
    expect(bookingDelete).toBeDefined();
    expect(impactedKeys).toContain(bookingDelete!.stableId);

    // 7. stableId / artifactKey generation is deterministic and path-safe
    expect(refundGet!.stableId).toMatch(
      /^php_http_endpoint__laravel__GET__route_[a-f0-9]{8}__path_[a-f0-9]{8}__handler_RefundController_show$/,
    );
    expect(bookingPut!.stableId).toMatch(
      /^php_http_endpoint__laravel__PUT__route_[a-f0-9]{8}__path_[a-f0-9]{8}__handler_BookingController_update$/,
    );
  });
});
