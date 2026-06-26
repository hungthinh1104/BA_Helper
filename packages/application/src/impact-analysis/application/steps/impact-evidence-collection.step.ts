import { createHash } from 'node:crypto';
import type { ArtifactRepositoryPort, PersistedArtifact } from '../../ports/artifact.repository.port';
import type { EvidenceRepositoryPort } from '../../ports/evidence.repository.port';
import type { TraceabilityRepositoryPort } from '../../ports/traceability.repository.port';
import type { RetrievalPort, RetrievedArtifact } from '../../ports/retrieval.port';
import type { DomainPackSelectionResult } from '../../ports/domain-pack-selection.port';
import type { ImpactEvidenceCollectionResult } from '../../domain/impact-analysis-step.types';
import type { ImpactAnalysisRecord } from '../../ports/impact-analysis.repository.port';

const toEvidenceSourceType = (artifactType: string) =>
  artifactType === 'TEST' ? 'TEST' : 'CODE';

const buildExcerpt = (artifact: PersistedArtifact) =>
  `${artifact.filePath}:${artifact.startLine ?? 0}-${artifact.endLine ?? 0} (${artifact.name})`;

export class ImpactEvidenceCollectionStep {
  constructor(
    private readonly artifactRepo: ArtifactRepositoryPort,
    private readonly evidenceRepo: EvidenceRepositoryPort,
    private readonly traceabilityRepo: TraceabilityRepositoryPort,
    private readonly retrievalService: RetrievalPort,
  ) {}

  async execute(
    analysis: ImpactAnalysisRecord,
    domainPackSelection: DomainPackSelectionResult,
    expandGraph: boolean = true,
  ): Promise<ImpactEvidenceCollectionResult> {
    const snapshotId = analysis.snapshot.id;
    const artifacts = await this.artifactRepo.listBySnapshot(snapshotId);

    const retrievedArtifacts: RetrievedArtifact[] = await this.retrievalService.retrieve({
      projectId: analysis.snapshot?.repository?.projectId ?? 'unknown',
      repositoryId: analysis.snapshot.repositoryId,
      snapshotId,
      changeRequest: analysis.requirementRevision.rawText,
      domain: domainPackSelection.normalizedPackId,
      expandGraph,
      maxResults: 20,
    });

    const artifactByKey = new Map<string, PersistedArtifact>(
      artifacts.map((artifact) => [artifact.artifactKey, artifact]),
    );

    const evidenceInputs = retrievedArtifacts
      .map((retrieved) => {
        const persistedArtifact = artifactByKey.get(retrieved.artifactKey);
        if (!persistedArtifact) return null;

        const excerpt = buildExcerpt(persistedArtifact);
        const contentHash = createHash('sha256').update(excerpt).digest('hex');
        return {
          provenanceKey: `snapshot:${snapshotId}:artifact:${persistedArtifact.artifactKey}`,
          sourceType: toEvidenceSourceType(persistedArtifact.artifactType),
          snapshotId,
          artifactId: persistedArtifact.id,
          sourcePath: persistedArtifact.filePath,
          startLine: persistedArtifact.startLine,
          endLine: persistedArtifact.endLine,
          excerpt,
          contentHash,
          isRedacted: false,
          redactionMetadata: null,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    const evidence = await this.evidenceRepo.upsertMany(evidenceInputs);

    const evidenceById = new Map(
      evidence
        .filter((item) => item.artifactId)
        .map((item) => [item.artifactId as string, item]),
    );

    const evidenceByKey = new Map<string, typeof evidence[0]>();
    for (const [artifactKey, artifact] of artifactByKey.entries()) {
      const evidenceRecord = evidenceById.get(artifact.id);
      if (evidenceRecord) {
        evidenceByKey.set(artifactKey, evidenceRecord);
      }
    }

    const affectedLinks = retrievedArtifacts
      .filter((retrieved) => retrieved.retrievalMethod !== 'GRAPH')
      .map((retrieved) => {
        const artifact = artifactByKey.get(retrieved.artifactKey);
        if (!artifact) return null;
        return { artifact, retrieved };
      })
      .filter((pair): pair is NonNullable<typeof pair> => Boolean(pair));

    const traceabilityLinks = await this.traceabilityRepo.upsertMany(
      affectedLinks.map(({ artifact, retrieved }) => ({
        impactAnalysisId: analysis.id,
        artifactId: artifact.id,
        linkType: 'AFFECTED',
        linkBasis: 'EVIDENCED',
        reviewStatus: 'NEEDS_REVIEW',
        confidence: 1,
        retrievalMetadata: {
          method: retrieved.retrievalMethod,
          signals: retrieved.retrievalSignals ?? [],
          reason: retrieved.retrievalReason,
          strategyVersion: retrieved.strategyVersion,
          score: {
            final: retrieved.score ?? retrieved.finalScore ?? 0,
            lexical: retrieved.lexicalScore,
            graph: retrieved.graphScore,
            vector: retrieved.vectorScore,
            domain: retrieved.domainBoost,
          },
          diagnostics: retrieved.retrievalDiagnostics,
          suggestion: retrieved.suggestion,
        },
      })),
    );

    await Promise.all(
      traceabilityLinks.map((link) => {
        const evidenceRecord = evidenceById.get(link.artifactId);
        if (!evidenceRecord) return Promise.resolve([]);
        return this.traceabilityRepo.linkEvidence({
          linkId: link.id,
          evidenceIds: [evidenceRecord.id],
        });
      }),
    );

    const vectorSignalCount = retrievedArtifacts.filter(
      (r) => r.retrievalSignals?.includes('VECTOR'),
    ).length;

    return {
      retrievedArtifacts,
      artifactByKey,
      evidenceById,
      evidenceByKey,
      traceabilityLinks,
      retrievalMetadata: {
        strategy: 'hybrid',
        maxArtifacts: 20,
        artifactCount: evidenceInputs.length,
        vectorSignalCount,
      },
    };
  }
}
