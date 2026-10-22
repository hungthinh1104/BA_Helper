import { scanProject } from '../scanner';
import { buildGraph } from '../../graph/graph';
import type {
  ScannerAdapter, 
  ScanAdapterInput, 
  ScanAdapterResult, 
  ScannerCapabilityProfile} from '../scanner.types';
import {
  ANALYZER_VERSION
} from '../scanner.types';
import type { DiagnosticItem } from '../core/diagnostic-collector';

export class TypeScriptNestJsAdapter implements ScannerAdapter {
  adapterId = 'typescript-nestjs';
  adapterVersion = ANALYZER_VERSION;
  language = 'typescript' as const;
  framework = 'nestjs' as const;

  capability: ScannerCapabilityProfile = {
    language: 'typescript',
    framework: 'nestjs',
    status: 'STABLE',
    confidence: 'HIGH',
    supportedArtifactKinds: ['API_ENDPOINT', 'DOMAIN_SERVICE', 'DATA_MODEL', 'TEST_FILE', 'TEST_CASE'],
    supportedPatterns: [
      'controllers',
      'services',
      'modules',
      'providers',
      'DTOs',
      'Prisma models',
      'method/class artifacts'
    ],
    partialPatterns: ['Jest behavior declarations for common hooks, inputs, actions, mocks and matchers',
      'inline-array it/test.each source callbacks'],
    unsupportedPatterns: ['dynamic matchers and nested callbacks', 'snapshot expectation contents',
      'barrel/path-alias graph resolution', 'runtime test execution or coverage'],
  };

  canScan(input: ScanAdapterInput): boolean {
    // Only support explicit tsFiles for now, mirroring the old scanProject usage,
    // or if the environment passes a valid rootDir.
    return true; // The registry will handle actual selection
  }

  async scan(input: ScanAdapterInput): Promise<ScanAdapterResult> {
    // We delegate directly to scanProject
    const legacyInput = {
      fixturePath: input.rootDir || input.fixturePath || '',
      tsFiles: input.tsFiles || [],
      coverage: input.coverage,
      commitSha: input.commitSha,
      analyzerVersion: this.adapterVersion,
    };

    const legacyResult = scanProject(legacyInput);
    const graph = buildGraph(legacyResult);

    const diagnostics: DiagnosticItem[] = [...(legacyResult.diagnostics ?? []), ...(graph.diagnostics ?? []).map(d => ({
      code: d.code,
      severity: 'WARN',
      category: 'SCANNER',
      message: d.message,
      payload: { relativePath: d.filePath, unsupportedPattern: d.code },
      samplePaths: d.filePath ? [d.filePath] : undefined,
    } as DiagnosticItem))];

    // Inject SCANNER_CAPABILITY_SUMMARY
    diagnostics.push({
      code: 'SCANNER_CAPABILITY_SUMMARY',
      severity: 'INFO',
      message: `Scanner capability profile injected for ${this.adapterId}`,
      category: 'SCANNER',
      payload: {
        adapterId: this.adapterId,
        adapterVersion: this.adapterVersion,
        language: this.language,
        framework: this.framework,
        status: this.capability.status,
        confidence: this.capability.confidence,
        supportedArtifactKindCount: this.capability.supportedArtifactKinds.length,
        supportedPatternCount: this.capability.supportedPatterns.length,
        partialPatternCount: this.capability.partialPatterns.length,
        unsupportedPatternCount: this.capability.unsupportedPatterns.length,
      }
    });

    return {
      artifacts: legacyResult.artifacts,
      dependencyEdges: graph.edges.map(edge => ({
        fromArtifactId: edge.from,
        toArtifactId: edge.to,
        type: edge.type,
        confidence: edge.confidence,
        provenance: edge.provenance,
      })),
      diagnostics,
      capability: this.capability,
    };
  }
}
