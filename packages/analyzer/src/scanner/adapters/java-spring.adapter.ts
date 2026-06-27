import { scanJavaSpringProject } from '../extractors/java-spring-scanner';
import type {
  ScannerAdapter, 
  ScanAdapterInput, 
  ScanAdapterResult, 
  ScannerCapabilityProfile} from '../scanner.types';
import {
  ANALYZER_VERSION
} from '../scanner.types';
import type { DiagnosticItem } from '../core/diagnostic-collector';

export class JavaSpringAdapter implements ScannerAdapter {
  adapterId = 'java-spring';
  adapterVersion = ANALYZER_VERSION;
  language = 'java' as const;
  framework = 'spring_boot' as const;

  capability: ScannerCapabilityProfile = {
    language: 'java',
    framework: 'spring_boot',
    status: 'PARTIAL',
    confidence: 'MEDIUM',
    supportedArtifactKinds: ['API_ENDPOINT', 'DOMAIN_SERVICE', 'DATA_MODEL', 'TEST_CASE'],
    supportedPatterns: [
      'Spring controllers',
      'basic HTTP method annotations',
      '@PatchMapping',
      'simple @RequestMapping with method/value/path',
      'class-level + method-level route joining',
      'class/method artifacts',
      'bounded Java excerpts'
    ],
    partialPatterns: [
      'complex composed annotations',
      'dynamic route construction'
    ],
    unsupportedPatterns: [
      'advanced dependency injection graph',
      'Spring Data repository query derivation',
      'XML config',
      'Kotlin Spring'
    ],
  };

  canScan(input: ScanAdapterInput): boolean {
    return true;
  }

  async scan(input: ScanAdapterInput): Promise<ScanAdapterResult> {
    const legacyInput = {
      fixturePath: input.rootDir || input.fixturePath || '',
      javaFiles: input.javaFiles || [],
      coverage: input.coverage,
      analyzerVersion: this.adapterVersion,
    };

    const legacyResult = await scanJavaSpringProject(legacyInput);

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

    if (legacyResult.diagnostics) {
      diagnostics.push(...legacyResult.diagnostics);
    }

    const mappedArtifacts = legacyResult.artifacts.map((a: any) => ({
      ...a,
      type: a.type === 'SPRING_CONTROLLER_METHOD' ? 'HTTP_ENDPOINT' : a.type,
      artifactType: a.artifactType === 'SPRING_CONTROLLER_METHOD' ? 'HTTP_ENDPOINT' : a.artifactType,
    }));

    return {
      artifacts: mappedArtifacts,
      dependencyEdges: [],
      diagnostics: diagnostics,
      capability: this.capability,
    };
  }
}
