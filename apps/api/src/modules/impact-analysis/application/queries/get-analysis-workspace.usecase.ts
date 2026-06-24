import { Injectable } from '@nestjs/common';
import { AppError } from '../../../../shared/app-error';
import { PrismaService } from '../../../prisma/prisma.service';
import { mapAnalysisWorkspace } from '../mappers/analysis-workspace.mapper';

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

		return mapAnalysisWorkspace(analysis);
	}
}
