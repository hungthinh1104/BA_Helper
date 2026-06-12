import { ScannerAdapter, ScannerCapabilityProfile, ScanAdapterInput, ScanAdapterResult, ANALYZER_VERSION } from '../scanner.types';
import { scanGoProject } from '../extractors/go-scanner';

export class GoAdapter implements ScannerAdapter {
  readonly adapterId = 'go-experimental-adapter';
  readonly adapterVersion = ANALYZER_VERSION;
  readonly language = 'go';
  readonly framework?: import('../scanner.types').SupportedFramework;

  constructor(framework?: import('../scanner.types').SupportedFramework) {
    this.framework = framework;
    if (framework) {
      this.capability.framework = framework;
    }
  }

  readonly capability: ScannerCapabilityProfile = {
    language: 'go',
    status: 'EXPERIMENTAL',
    confidence: 'LOW',
    supportedArtifactKinds: ['API_ENDPOINT'],
    supportedPatterns: [
      'net/http standard HandleFunc',
      'gin direct router methods (GET, POST, etc.)'
    ],
    partialPatterns: [],
    unsupportedPatterns: [
      'Dynamic route variables',
      'Route groups',
      'Middleware chains',
      'Inline handlers',
      'Handler-body method inference',
      'Cross-package symbol resolution'
    ],
    notes: [
      'Pilot implementation. Strictly string-based regex extraction, no Go AST.',
      'Only supports simple static endpoints.'
    ]
  };

  canScan(input: ScanAdapterInput): boolean {
    return !!input.goFiles && input.goFiles.length > 0;
  }

  async scan(input: ScanAdapterInput): Promise<ScanAdapterResult> {
    const goFiles = input.goFiles || [];
    
    const result = await scanGoProject({
      ...input,
      fixturePath: input.fixturePath || input.rootDir,
      goFiles,
    });

    return {
      artifacts: result.artifacts,
      dependencyEdges: [], // Experimental phase: no cross-package edges yet
      diagnostics: [
        ...(result.diagnostics || []),
        {
          code: 'SCANNER_CAPABILITY_SUMMARY',
          message: 'Scanner capability profile injected',
          severity: 'INFO',
          category: 'SCANNER',
          payload: this.capability as unknown as Record<string, unknown>,
        }
      ],
      capability: this.capability,
    };
  }
}
