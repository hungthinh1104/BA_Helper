import {
  ScannerAdapter,
  ScanAdapterInput,
  ScanAdapterResult,
  SupportedLanguage,
  SupportedFramework,
  ScannerCapabilityProfile,
} from '../scanner.types';
import { scanPhpLaravelProject } from '../extractors/php-laravel-scanner';

export class PhpLaravelAdapter implements ScannerAdapter {
  readonly adapterId = 'php-laravel-lexical-pilot';
  readonly adapterVersion = '1.0.0';
  readonly language: SupportedLanguage = 'php';
  readonly framework: SupportedFramework = 'laravel';

  get capability(): ScannerCapabilityProfile {
    return {
      language: this.language,
      framework: this.framework,
      status: 'EXPERIMENTAL',
      confidence: 'LOW',
      supportedArtifactKinds: ['API_ENDPOINT'],
      supportedPatterns: [
        'Route::get/post/put/patch/delete with literal path strings',
        'Array handler syntax: [Controller::class, \'method\']',
        'Legacy string handler: \'Controller@method\'',
        'Route path templates: /users/{id}',
      ],
      partialPatterns: [
        'Closure handlers (extracted as closure, no method name)',
      ],
      unsupportedPatterns: [
        'Route::resource / Route::apiResource',
        'Route::group with prefix',
        'Named routes (->name())',
        'Middleware groups',
        'Dynamic route paths (variables)',
        'Service container / DI graph',
        'Eloquent model impact',
        'Cross-file import resolution',
        'Full PHP parser integration',
      ],
      notes: [
        'PHP/Laravel scanning is an experimental pilot limited to bounded static route definitions.',
        'Route groups and resource routes are not joined or expanded — use diagnostics as evidence boundaries.',
      ],
    };
  }

  canScan(input: ScanAdapterInput): boolean {
    return (input.phpFiles?.length ?? 0) > 0;
  }

  async scan(input: ScanAdapterInput): Promise<ScanAdapterResult> {
    const rawResult = await scanPhpLaravelProject({
      fixturePath: input.rootDir ?? input.fixturePath ?? '',
      phpFiles: input.phpFiles ?? [],
      coverage: input.coverage,
    });

    const diagnostics = rawResult.diagnostics ?? [];

    diagnostics.push({
      code: 'SCANNER_CAPABILITY_SUMMARY',
      message: 'Scanner capability profile injected',
      severity: 'INFO',
      category: 'SCANNER',
      payload: this.capability,
    });

    return {
      artifacts: rawResult.artifacts,
      dependencyEdges: [],
      diagnostics,
      capability: this.capability,
    };
  }
}
