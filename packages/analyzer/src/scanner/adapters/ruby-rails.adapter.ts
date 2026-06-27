import type {
  ScannerAdapter,
  ScanAdapterInput,
  ScanAdapterResult,
  SupportedLanguage,
  SupportedFramework,
  ScannerCapabilityProfile,
} from '../scanner.types';
import { scanRubyRailsProject } from '../extractors/ruby-rails-scanner';

export class RubyRailsAdapter implements ScannerAdapter {
  readonly adapterId = 'ruby-rails-lexical-pilot';
  readonly adapterVersion = '1.0.0';
  readonly language: SupportedLanguage = 'ruby';
  readonly framework: SupportedFramework = 'rails';

  get capability(): ScannerCapabilityProfile {
    return {
      language: this.language,
      framework: this.framework,
      status: 'EXPERIMENTAL',
      confidence: 'LOW',
      supportedArtifactKinds: ['API_ENDPOINT'],
      supportedPatterns: [
        'get/post/put/patch/delete with literal path strings',
        'String handler syntax: to: "controller#action"',
        'Legacy hash rocket handler syntax: => "controller#action"',
        'Route path templates: /users/:id',
      ],
      partialPatterns: [],
      unsupportedPatterns: [
        'resources / resource',
        'namespace blocks',
        'scope/module blocks',
        'mounted engines',
        'Dynamic route paths (interpolation or variables)',
        'ActiveRecord model impact',
        'Rails middleware analysis',
        'Cross-file import resolution',
        'Full Ruby parser integration',
      ],
      notes: [
        'Ruby/Rails scanning is an experimental pilot limited to bounded static route definitions.',
        'Namespaces and scopes are not joined — use diagnostics as evidence boundaries.',
      ],
    };
  }

  canScan(input: ScanAdapterInput): boolean {
    return (input.rbFiles?.length ?? 0) > 0;
  }

  async scan(input: ScanAdapterInput): Promise<ScanAdapterResult> {
    const rawResult = await scanRubyRailsProject({
      fixturePath: input.rootDir ?? input.fixturePath ?? '',
      rbFiles: input.rbFiles ?? [],
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
