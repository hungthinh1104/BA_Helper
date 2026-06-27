import { scanProject } from '../scanner';
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
    supportedArtifactKinds: ['API_ENDPOINT', 'DOMAIN_SERVICE', 'DATA_MODEL', 'TEST_CASE'],
    supportedPatterns: [
      'controllers',
      'services',
      'modules',
      'providers',
      'DTOs',
      'Prisma models',
      'method/class artifacts'
    ],
    partialPatterns: [],
    unsupportedPatterns: [],
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
      analyzerVersion: this.adapterVersion,
    };

    const legacyResult = scanProject(legacyInput);

    const diagnostics: DiagnosticItem[] = [];

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
      dependencyEdges: [], // Legacy scan does not extract edges directly
      diagnostics,
      capability: this.capability,
    };
  }
}
