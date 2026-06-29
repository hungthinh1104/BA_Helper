import type {
  ScannerAdapter,
  ScanAdapterInput,
  ScanAdapterResult,
  SupportedLanguage,
  SupportedFramework,
  ScannerCapabilityProfile,
} from '../scanner.types';
import { scanCSharpProject } from '../extractors/csharp-scanner';

export class CSharpAdapter implements ScannerAdapter {
  readonly adapterId = 'csharp-lexical-pilot';
  readonly adapterVersion = '1.0.0';
  readonly language: SupportedLanguage = 'csharp';

  constructor(public readonly framework?: SupportedFramework) {}

  get capability(): ScannerCapabilityProfile {
    return {
      language: this.language,
      framework: this.framework,
      status: 'EXPERIMENTAL',
      confidence: 'LOW',
      supportedArtifactKinds: ['API_ENDPOINT'],
      supportedPatterns: [
        'Controller [HttpGet/Post/Put/Patch/Delete("path")] attributes with literal paths',
        'Minimal API app.MapGet/MapPost/MapPut/MapDelete("/path", handler)',
      ],
      partialPatterns: [
        'Empty [HttpGet()] treated as root path "/"',
      ],
      unsupportedPatterns: [
        '[Route("api/[controller]")] token replacement',
        'Class-level + method-level route prefix joining',
        'MapGroup (Minimal API route groups)',
        'Dynamic route constants and variable paths',
        'Middleware pipeline analysis',
        'Entity Framework model impact',
        'Cross-file symbol resolution',
        'WCF / OWIN / SignalR',
      ],
      notes: [
        'C# scanning is an experimental pilot limited to bounded static ASP.NET Core routes.',
        'Route prefix joining and [controller] tokens are not resolved — use evidence diagnostics instead.',
      ],
    };
  }

  canScan(input: ScanAdapterInput): boolean {
    return (input.csFiles?.length ?? 0) > 0;
  }

  async scan(input: ScanAdapterInput): Promise<ScanAdapterResult> {
    const rawResult = await scanCSharpProject({
      fixturePath: input.rootDir ?? input.fixturePath ?? '',
      csFiles: input.csFiles ?? [],
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
