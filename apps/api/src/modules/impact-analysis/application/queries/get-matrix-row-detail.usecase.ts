import { Injectable, NotFoundException } from '@nestjs/common';
import { MatrixRowDetailResponse } from '@ba-helper/contracts';
import { PrismaService } from "@ba-helper/backend-runtime";

@Injectable()
export class GetMatrixRowDetailUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(runId: string, analysisId: string): Promise<MatrixRowDetailResponse> {
    const analysis = await this.prisma.impactAnalysis.findFirst({
      where: {
        id: analysisId,
        multiRepoRunId: runId, // Ensure analysisId must belong to runId
      },
      include: {
        snapshot: {
          include: {
            profile: true,
          },
        },
        sourceTarget: {
          include: {
            repository: true,
          },
        },
        traceabilityLinks: {
          include: {
            artifact: true,
            evidenceLinks: {
              include: {
                evidence: true,
              },
            },
          },
        },
        insights: {
          include: {
            evidenceLinks: {
              include: {
                evidence: true,
              },
            },
          },
        },
        reviewDecisions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!analysis) {
      throw new NotFoundException('Impact analysis not found in this multi-repo run.');
    }

    const domain = analysis.snapshot.profile?.domain ?? null;
    const repository = analysis.sourceTarget.repository.canonicalUrl.split('/').pop()?.replace('.git', '') ?? 'Unknown Repository';
    const latestDecision = analysis.reviewDecisions[0]?.decision ?? null;

    // Grouping rules
    // 1. Evidence items deduplicated by evidenceId
    const evidenceMap = new Map<string, any>();
    
    // 2. Artifact details grouping unique artifacts, not duplicate links
    const artifactMap = new Map<string, any>();

    // Prepare insights for quick matching by evidenceId
    const insightEvidenceMap = new Map<string, string[]>(); // evidenceId -> array of insightIds
    for (const insight of analysis.insights) {
      for (const ie of insight.evidenceLinks) {
        const list = insightEvidenceMap.get(ie.evidenceId) || [];
        list.push(insight.id);
        insightEvidenceMap.set(ie.evidenceId, list);
      }
    }

    const risks: any[] = [];
    const qaScenarios: any[] = [];
    const processedInsightIds = new Set<string>();

    for (const insight of analysis.insights) {
      if (processedInsightIds.has(insight.id)) continue;

      const isConflicting = insight.certainty === 'CONFLICTING';
      const isRisk = insight.insightType === 'UNKNOWN' || isConflicting || hasRiskMetadata(insight);
      const isQa = insight.insightType === 'QA_SCENARIO';

      if (isRisk || isQa) {
        const insightRef = {
          insightId: insight.id,
          insightType: insight.insightType,
          title: insight.title,
          description: insight.description,
          certainty: insight.certainty,
          relatedEvidenceIds: insight.evidenceLinks.map(ie => ie.evidenceId),
        };

        if (isRisk) risks.push(insightRef);
        if (isQa) qaScenarios.push(insightRef);
        processedInsightIds.add(insight.id);
      }
    }

    for (const link of analysis.traceabilityLinks) {
      const artifact = link.artifact;
      if (!artifactMap.has(artifact.id)) {
        artifactMap.set(artifact.id, {
          artifactId: artifact.id,
          artifactKey: artifact.artifactKey,
          displayName: artifact.name,
          universalKind: artifact.universalKind,
          rawArtifactType: artifact.artifactType,
          filePath: artifact.filePath,
          startLine: artifact.startLine,
          endLine: artifact.endLine,
          linkStrength: link.linkBasis,
          linkReason: (link as any).reviewNote?.content ?? null,
          evidenceItems: [],
          relatedRisks: new Set<string>(),
          relatedQaScenarios: new Set<string>(),
          retrievalDiagnostics: (link as any).retrievalMetadata?.diagnostics ?? undefined,
        });
      }

      const artifactDetail = artifactMap.get(artifact.id);

      for (const te of link.evidenceLinks) {
        const evidence = te.evidence;
        if (!evidenceMap.has(evidence.id)) {
          evidenceMap.set(evidence.id, {
            evidenceId: evidence.id,
            quoteOrSnippet: evidence.excerpt,
            sourceFile: evidence.sourcePath,
            startLine: evidence.startLine,
            endLine: evidence.endLine,
            linkType: link.linkType,
            retrievalSignals: (evidence as any).retrievalMetadata?.diagnostics ?? undefined, // not strictly needed from evidence but maybe available
          });
        }
        
        const evidenceItem = evidenceMap.get(evidence.id);
        // Only push if not already in evidenceItems array
        if (!artifactDetail.evidenceItems.some((e: any) => e.evidenceId === evidence.id)) {
            artifactDetail.evidenceItems.push(evidenceItem);
        }

        // Add related risks/QA based on shared evidence ID
        const sharedInsightIds = insightEvidenceMap.get(evidence.id) || [];
        for (const insightId of sharedInsightIds) {
          const insight = analysis.insights.find(i => i.id === insightId);
          if (!insight) continue;
          
          const isConflicting = insight.certainty === 'CONFLICTING';
          const isRisk = insight.insightType === 'UNKNOWN' || isConflicting || hasRiskMetadata(insight);
          const isQa = insight.insightType === 'QA_SCENARIO';

          if (isRisk) artifactDetail.relatedRisks.add(insightId);
          if (isQa) artifactDetail.relatedQaScenarios.add(insightId);
        }
      }
    }

    let coveredArtifacts = 0;
    let uncoveredArtifacts = 0;

    const impactedArtifacts = Array.from(artifactMap.values()).map(detail => {
      const relatedRisks = Array.from(detail.relatedRisks);
      const relatedQaScenarios = Array.from(detail.relatedQaScenarios);
      
      if (detail.evidenceItems.length > 0) {
        coveredArtifacts++;
      } else {
        uncoveredArtifacts++;
      }

      return {
        ...detail,
        relatedRisks,
        relatedQaScenarios,
      };
    });

    return {
      runId,
      analysisId,
      domain,
      repository,
      impactedArtifacts,
      risks,
      qaScenarios,
      evidenceSummary: {
        totalEvidenceItems: evidenceMap.size,
        coveredArtifacts,
        uncoveredArtifacts,
      },
      reviewState: {
        status: analysis.status as any,
        latestDecision,
      },
    };
  }
}

function hasRiskMetadata(insight: { metadata?: unknown }): boolean {
  const { metadata } = insight;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return false;
  }

  const kind = (metadata as Record<string, unknown>).kind;
  return typeof kind === 'string' && kind.toLowerCase() === 'risk';
}
