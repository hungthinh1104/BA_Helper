import { Injectable } from '@nestjs/common';
import { testTraceEvidenceResponseSchema } from '@ba-helper/contracts';
import { GetQaCoverageUseCase } from './get-qa-coverage.usecase';
import { QaTraceRepository } from '../../infrastructure/qa-trace.repository';

@Injectable()
export class GetTestTraceEvidenceUseCase {
  constructor(private readonly coverage: GetQaCoverageUseCase, private readonly repository: QaTraceRepository) {}

  async execute(analysisId: string, evidenceId: string) {
    const coverage = await this.coverage.execute(analysisId);
    const step = coverage.items.flatMap(item => item.testArtifacts.flatMap(test => test.trace?.edges ?? []))
      .find(edge => edge.evidenceId === evidenceId);
    if (!step || !coverage.traceContext) return null;
    const evidence = await this.repository.findEvidence(coverage.snapshotId, evidenceId);
    if (!evidence || evidence.snapshotId !== coverage.snapshotId || evidence.artifactId !== step.sourceArtifactId ||
      evidence.provenanceKey !== step.provenance.evidenceProvenanceKey ||
      evidence.sourceType !== (step.type === 'TESTS' ? 'TEST' : 'CODE') ||
      step.provenance.locations.some(loc => evidence.sourcePath !== loc.sourcePath ||
        evidence.startLine === null || evidence.endLine === null || loc.startLine < evidence.startLine || loc.endLine > evidence.endLine)) return null;
    return testTraceEvidenceResponseSchema.parse({ analysisId, snapshotId: coverage.snapshotId,
      commitSha: coverage.traceContext.commitSha, evidence: { id: evidence.id, sourceType: evidence.sourceType,
        filePath: evidence.sourcePath, startLine: evidence.startLine, endLine: evidence.endLine,
        excerpt: evidence.excerpt, artifactId: evidence.artifactId } });
  }
}
