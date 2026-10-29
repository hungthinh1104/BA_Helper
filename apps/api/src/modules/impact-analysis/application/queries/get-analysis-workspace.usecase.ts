import { Injectable } from '@nestjs/common';
import { AppError } from '@ba-helper/shared';
import { mapAnalysisWorkspace } from '../mappers/analysis-workspace.mapper';
import { isEvidenceScopedToAnalysis, PrismaService } from "@ba-helper/backend-runtime";

@Injectable()
export class GetAnalysisWorkspaceUseCase {
	constructor(private readonly prisma: PrismaService) {}

	async execute(analysisId: string) {
		const analysis = await this.prisma.impactAnalysis.findUnique({
			where: { id: analysisId },
			include: {
				requirementRevision: true,
				snapshot: {
					include: {
						profile: true,
						repository: { select: { canonicalUrl: true } },
					},
				},
				sourceTarget: true,
				insights: {
					include: {
						evidenceLinks: {
							include: {
								evidence: {
									include: {
										artifact: true,
									},
								},
							},
						},
						reviewNote: true,
					},
					orderBy: { createdAt: 'asc' },
				},
				traceabilityLinks: {
					include: {
						artifact: true,
						evidenceLinks: {
							include: {
								evidence: {
									include: {
										artifact: true,
									},
								},
							},
						},
						reviewDecision: true,
					},
					orderBy: { createdAt: 'asc' },
				},
				documentJobs: {
					include: {
						generatedDocument: true,
					},
					orderBy: { updatedAt: 'desc' },
				},
				reviewedReportSnapshots: {
					include: {
						approvedDocument: true,
					},
					orderBy: { createdAt: 'desc' },
				},
			},
		});

		if (!analysis) {
			throw new AppError(
				'IMPACT_ANALYSIS_NOT_FOUND',
				'Impact analysis not found.',
			);
		}

    return mapAnalysisWorkspace({
      ...analysis,
      insights: analysis.insights.map((insight) => ({
        ...insight,
        evidenceLinks: insight.evidenceLinks.filter((link) =>
          isEvidenceScopedToAnalysis(link.evidence, analysis)),
      })),
      traceabilityLinks: analysis.traceabilityLinks
        .filter((link) => link.artifact.snapshotId === analysis.snapshotId)
        .map((link) => ({
          ...link,
          evidenceLinks: link.evidenceLinks.filter((evidenceLink) =>
            isEvidenceScopedToAnalysis(evidenceLink.evidence, analysis)),
        })),
    });
	}
}
