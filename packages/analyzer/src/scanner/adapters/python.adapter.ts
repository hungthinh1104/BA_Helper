import {
  ScannerAdapter,
  ScanAdapterInput,
  ScanAdapterResult,
  SupportedLanguage,
  SupportedFramework,
  ScannerCapabilityProfile,
} from '../scanner.types';
import { scanPythonProject } from '../extractors/python-scanner';

export class PythonAdapter implements ScannerAdapter {
  readonly adapterId = 'python-lexical-pilot';
  readonly adapterVersion = '1.0.0';
  readonly language: SupportedLanguage = 'python';

  constructor(public readonly framework?: SupportedFramework) {}

  get capability(): ScannerCapabilityProfile {
    return {
      language: this.language,
      framework: this.framework,
      status: 'EXPERIMENTAL',
      confidence: 'LOW',
      supportedArtifactKinds: ['API_ENDPOINT'],
      supportedPatterns: [
        'FastAPI @app.get/post decorators',
        'FastAPI @router.get/post decorators (without APIRouter prefixes)',
        'Route templates with path variables e.g. /users/{id}',
      ],
      partialPatterns: [
        'Depends() injection boundaries',
      ],
      unsupportedPatterns: [
        'APIRouter(prefix=...)',
        'Dynamic route generation',
        'f-string paths',
        'Concatenated paths',
        'Django, Flask',
      ],
      notes: [
        'Python scanning is an experimental pilot limited to bounded static FastAPI routes.',
        'It cannot resolve cross-file route group prefixes or dependency injection graphs.',
      ],
    };
  }

  canScan(input: ScanAdapterInput): boolean {
    return (input.pyFiles && input.pyFiles.length > 0) || false;
  }

  async scan(input: ScanAdapterInput): Promise<ScanAdapterResult> {
    const rawResult = await scanPythonProject({
      fixturePath: input.rootDir,
      pyFiles: input.pyFiles || [],
      coverage: input.coverage,
    });

    const diagnostics = rawResult.diagnostics || [];
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
