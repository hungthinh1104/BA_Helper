import { AppError } from '@ba-helper/shared';
import type { ArtifactRepositoryPort, PersistedArtifact } from '../../ports/artifact.repository.port';
import type { EvidenceRepositoryPort } from '../../ports/evidence.repository.port';
import type { TraceabilityRepositoryPort } from '../../ports/traceability.repository.port';
import type { RetrievalPort, RetrievedArtifact } from '../../ports/retrieval.port';
import type { DomainPackSelectionResult } from '../../ports/domain-pack-selection.port';
import type { ImpactEvidenceCollectionResult } from '../../domain/impact-analysis-step.types';
import type { ImpactAnalysisRecord } from '../../ports/impact-analysis.repository.port';

const DIRECT_RETRIEVAL_METHODS = new Set(['LEXICAL', 'HYBRID']);

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
    const projectId = analysis.snapshot.repository.projectId;
    if (!projectId) {
      throw new AppError(
        'SNAPSHOT_MISSING',
        'Impact analysis snapshot is missing repository project scope.',
      );
    }

    const artifacts = await this.artifactRepo.listBySnapshot(snapshotId);

    const retrievedArtifacts: RetrievedArtifact[] = await this.retrievalService.retrieve({
      projectId,
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

    const retrievedArtifactIds = Array.from(
      new Set(
        retrievedArtifacts
          .map((retrieved) => artifactByKey.get(retrieved.artifactKey)?.id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const evidence = await this.evidenceRepo.listByArtifactIds({
      snapshotId,
      artifactIds: retrievedArtifactIds,
    });

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
      .filter((retrieved) => !isGraphExpansionOnly(retrieved))
      .map((retrieved) => {
        const artifact = artifactByKey.get(retrieved.artifactKey);
        const evidenceRecord = artifact ? evidenceById.get(artifact.id) : null;
        if (!artifact) return null;
        if (!evidenceRecord) return null;
        const linkBasis = deriveImpactLinkBasis(retrieved);
        return { artifact, retrieved, linkBasis, confidence: deriveImpactConfidence(retrieved, linkBasis) };
      })
      .filter((pair): pair is NonNullable<typeof pair> => Boolean(pair));

    const persistedLinks = await this.traceabilityRepo.upsertMany(
      affectedLinks.map(({ artifact, retrieved, linkBasis, confidence }) => ({
        impactAnalysisId: analysis.id,
        artifactId: artifact.id,
        linkType: 'AFFECTED',
        linkBasis,
        reviewStatus: 'NEEDS_REVIEW',
        confidence,
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

    // Carry linkBasis + confidence from computed values (upsert only returns { id, artifactId })
    const linkBasisMap = new Map(
      affectedLinks.map(({ artifact, linkBasis, confidence }) => [
        artifact.id,
        { linkBasis, confidence },
      ]),
    );
    const traceabilityLinks = persistedLinks.map((link) => ({
      ...link,
      linkBasis: linkBasisMap.get(link.artifactId)?.linkBasis ?? 'INFERRED' as const,
      confidence: linkBasisMap.get(link.artifactId)?.confidence ?? 0.3,
    }));

    await Promise.all(
      persistedLinks.map((link) => {
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
        artifactCount: evidence.length,
        vectorSignalCount,
      },
    };
  }
}

function deriveImpactLinkBasis(
  retrieved: RetrievedArtifact,
): 'EVIDENCED' | 'INFERRED' {
  const signals = new Set(retrieved.retrievalSignals ?? []);
  if (
    DIRECT_RETRIEVAL_METHODS.has(retrieved.retrievalMethod) ||
    signals.has('LEXICAL')
  ) {
    return 'EVIDENCED';
  }

  return 'INFERRED';
}

function isGraphExpansionOnly(retrieved: RetrievedArtifact) {
  return (
    retrieved.retrievalMethod === 'GRAPH' ||
    retrieved.retrievalMethod === 'GRAPH_EXPANSION'
  );
}

function deriveImpactConfidence(
  retrieved: RetrievedArtifact,
  linkBasis: 'EVIDENCED' | 'INFERRED',
) {
  const rawScore = retrieved.score ?? retrieved.finalScore ?? 0;
  const boundedScore = Number.isFinite(rawScore)
    ? Math.max(0, Math.min(rawScore, 1))
    : 0;

  if (linkBasis === 'EVIDENCED') {
    return Math.max(0.5, Math.min(boundedScore, 0.95));
  }

  return Math.max(0.3, Math.min(boundedScore, 0.75));
}
