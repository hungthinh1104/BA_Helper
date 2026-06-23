import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ArtifactRepository } from '../../../../artifact/infrastructure/artifact.repository';
import { EvidenceRepository } from '../../../../evidence/infrastructure/evidence.repository';
import { TraceabilityRepository } from '../../../../traceability/infrastructure/traceability.repository';
import { HybridRetrievalService } from '../../../../retrieval/application/hybrid-retrieval.service';
import {
  EvidenceRecord,
  ImpactEvidenceCollectionResult,
  PersistedArtifact,
  ScanArtifact,
} from './impact-analysis-step.types';

const toEvidenceSourceType = (artifactType: string) =>
  artifactType === 'TEST' ? 'TEST' : 'CODE';

const buildExcerpt = (artifact: ScanArtifact) =>
  `${artifact.filePath}:${artifact.startLine}-${artifact.endLine} (${artifact.symbolName})`;

@Injectable()
export class ImpactEvidenceCollectionStep {
  constructor(
    private readonly artifactRepo: ArtifactRepository,
    private readonly evidenceRepo: EvidenceRepository,
    private readonly traceabilityRepo: TraceabilityRepository,
    private readonly retrievalService: HybridRetrievalService,
  ) {}

  async execute(
    analysis: any,
    domainPackSelection: any,
    expandGraph: boolean = true,
  ): Promise<ImpactEvidenceCollectionResult> {
    const snapshotId = analysis.snapshot.id;
    const artifacts = await this.artifactRepo.listBySnapshot(snapshotId);

    // Retrieve using Hybrid RAG — domain scopes keyword expansion via DomainProfile
    const retrievedArtifacts = await this.retrievalService.retrieve({
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
      .map((retrieved: any) => {
        const persistedArtifact = artifactByKey.get(retrieved.artifactKey);
        if (!persistedArtifact) {
          return null;
        }

        const artifactToExcerpt: ScanArtifact = {
          stableId: persistedArtifact.artifactKey,
          type: persistedArtifact.artifactType,
          filePath: persistedArtifact.filePath,
          symbolName: persistedArtifact.name,
          startLine: persistedArtifact.startLine ?? 0,
          endLine: persistedArtifact.endLine ?? 0,
        };

        const excerpt = buildExcerpt(artifactToExcerpt);
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
      .filter((entry: any): entry is NonNullable<typeof entry> => entry !== null);

    const evidence = await this.evidenceRepo.upsertMany(evidenceInputs);

    const evidenceById = new Map<string, EvidenceRecord>(
      (evidence as EvidenceRecord[])
        .filter((item) => item.artifactId)
        .map((item) => [item.artifactId as string, item]),
    );

    const evidenceByKey = new Map<string, EvidenceRecord>();
    for (const [artifactKey, artifact] of artifactByKey.entries()) {
      const evidenceRecord = evidenceById.get(artifact.id);
      if (evidenceRecord) {
        evidenceByKey.set(artifactKey, evidenceRecord);
      }
    }

    const affectedLinks = retrievedArtifacts
      .filter((retrieved: any) => retrieved.retrievalMethod !== 'GRAPH')
      .map((retrieved: any) => {
        const artifact = artifactByKey.get(retrieved.artifactKey);
        if (!artifact) return null;
        return { artifact, retrieved };
      })
      .filter((pair: any): pair is any => Boolean(pair));

    const traceabilityLinks = await this.traceabilityRepo.upsertMany(
      affectedLinks.map(({ artifact, retrieved }: any) => ({
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
      traceabilityLinks.map((link: { id: string; artifactId: string }) => {
        const evidenceRecord = evidenceById.get(link.artifactId);
        if (!evidenceRecord) {
          return Promise.resolve([]);
        }
        return this.traceabilityRepo.linkEvidence({
          linkId: link.id,
          evidenceIds: [evidenceRecord.id],
        });
      }),
    );

    const vectorSignalCount = retrievedArtifacts.filter(
      (r: any) =>
        r.retrievalSignals?.includes('VECTOR') ||
        r.retrievalSignals?.has?.('VECTOR'),
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
