import { analysisWorkspaceResponseSchema } from '@ba-helper/contracts';
import { GetAnalysisWorkspaceUseCase } from './get-analysis-workspace.usecase';

const ids = {
	analysis: '00000000-0000-4000-8000-000000000001',
	revision: '00000000-0000-4000-8000-000000000002',
	snapshot: '00000000-0000-4000-8000-000000000003',
	repository: '00000000-0000-4000-8000-000000000004',
	artifact: '00000000-0000-4000-8000-000000000005',
	link: '00000000-0000-4000-8000-000000000006',
	evidence: '00000000-0000-4000-8000-000000000007',
	riskInsight: '00000000-0000-4000-8000-000000000008',
	qaInsight: '00000000-0000-4000-8000-000000000009',
	target: '00000000-0000-4000-8000-000000000010',
	job: '00000000-0000-4000-8000-000000000011',
	document: '00000000-0000-4000-8000-000000000012',
	reportSnapshot: '00000000-0000-4000-8000-000000000013',
};

describe('GetAnalysisWorkspaceUseCase', () => {
		it('returns AnalysisWorkspaceResponse shape with taxonomy projections', async () => {
			const result = await executeWith(createAnalysis());

			expect(() => analysisWorkspaceResponseSchema.parse(result)).not.toThrow();
			expect(result.overview.analysisId).toBe(ids.analysis);
			expect(result.overview.requirement.domainPack).toEqual({
				id: 'booking',
				version: '0.1.0',
				status: 'STABLE',
				selectedBy: 'REPOSITORY_PROFILE',
			});
			expect(result.impactGroups[0].artifacts[0].artifactKey).toBe(
				'api:booking.controller.cancel',
			);
		expect(result.risks).toHaveLength(1);
		expect(result.unknowns).toHaveLength(1);
		expect(result.qaScenarios).toHaveLength(1);
	});

	it('does not infer report completion from analysis progress', async () => {
		const result = await executeWith(
			createAnalysis({
				progress: 100,
				documentJobs: [],
				reviewedReportSnapshots: [],
			}),
		);

		expect(result.overview.status.analysisStatus).toBe('WAITING_FOR_REVIEW');
		expect(result.overview.status.reportStatus).toBe('missing');
		expect(result.reportStatus.status).toBe('missing');
		expect(result.reportStatus.canViewReport).toBe(false);
		expect(result.reportStatus.canExport).toBe(false);
		expect(result.reportStatus.exportBlockingReasons).toContain('REPORT_NOT_GENERATED');
	});

	it('exposes backend-authored finalize capability and blockers', async () => {
		const result = await executeWith(createAnalysis());

		expect(result.reportStatus.canFinalize).toBe(false);
		expect(result.reportStatus.requiresUnreviewedAcknowledgement).toBe(true);
		expect(result.reportStatus.finalizeBlockingReasons).toEqual(
			expect.arrayContaining([
				'CONFLICTING_EVIDENCE_UNREVIEWED',
				'HIGH_RISK_INSIGHT_UNREVIEWED',
			]),
		);
	});

	it('allows finalize capability when critical review blockers are resolved', async () => {
		const result = await executeWith(
			createAnalysis({
				insights: [
					riskInsight({ reviewStatus: 'CONFIRMED' }),
					unknownInsight({ reviewStatus: 'CONFIRMED' }),
					qaInsight(),
				],
				traceabilityLinks: [
					traceabilityLink({
						reviewStatus: 'CONFIRMED',
						reviewDecision: {
							id: '00000000-0000-4000-8000-000000000015',
							analysisId: ids.analysis,
							traceabilityLinkId: ids.link,
							decision: 'ACCEPTED',
							note: null,
							reviewedByUserId: null,
							reviewedAt: new Date('2026-06-24T00:00:00.000Z'),
						},
					}),
				],
			}),
		);

		expect(result.reportStatus.canFinalize).toBe(true);
		expect(result.reportStatus.requiresUnreviewedAcknowledgement).toBe(false);
		expect(result.reportStatus.finalizeBlockingReasons).toEqual([]);
	});

	it('keeps completed historical output visible when the analysis is stale', async () => {
		const result = await executeWith(
			createAnalysis({
				status: 'COMPLETED',
				sourceTarget: {
					id: ids.target,
					resolvedRefType: 'BRANCH',
					latestObservedCommitSha: 'newer-commit',
				},
				documentJobs: [completedDocumentJob()],
				reviewedReportSnapshots: [reviewedReportSnapshot()],
			}),
		);

		expect(result.overview.status.reportStatus).toBe('completed');
		expect(result.reportStatus.generatedDocumentId).toBe(ids.document);
		expect(result.reportStatus.canViewReport).toBe(true);
		expect(result.reportStatus.canExport).toBe(false);
		expect(result.reportStatus.exportBlockingReasons).toContain('REPORT_STALE');
		expect(result.overview.status.driftStatus).toBe('stale');
		expect(result.driftStatus.isStale).toBe(true);
	});

	it('preserves evidence source path, lines, and provenance links', async () => {
		const result = await executeWith(createAnalysis());
		const evidence = result.evidenceCards[0];

		expect(evidence.filePath).toBe('src/booking/booking.controller.ts');
		expect(evidence.lineRange).toEqual({ startLine: 10, endLine: 22 });
		expect(evidence.artifactId).toBe(ids.artifact);
		expect(evidence.artifactKey).toBe('api:booking.controller.cancel');
		expect(evidence.linkedInsightIds).toContain(ids.riskInsight);
		expect(evidence.linkedTraceabilityLinkIds).toContain(ids.link);
	});

	it('counts pending review items from insight and traceability state', async () => {
		const result = await executeWith(createAnalysis());

			expect(result.reviewQueue).toHaveLength(3);
			expect(result.overview.counts.pendingReviewItems).toBe(3);
		});

		it('does not derive domain pack capability when backend metadata is missing', async () => {
			const result = await executeWith(createAnalysis({ metadata: null }));

			expect(result.overview.requirement.domainProfileId).toBe('booking@repo-profile@0.1.0');
			expect(result.overview.requirement.domainPack).toBeNull();
		});

	it('derives drift independently from lifecycle status', async () => {
		const result = await executeWith(
			createAnalysis({
				status: 'COMPLETED',
				progress: 100,
				sourceTarget: {
					id: ids.target,
					resolvedRefType: 'BRANCH',
					latestObservedCommitSha: 'newer-commit',
				},
			}),
		);

		expect(result.overview.status.analysisStatus).toBe('COMPLETED');
		expect(result.overview.status.driftStatus).toBe('stale');
		expect(result.driftStatus.snapshotCommitSha).toBe('abc123');
		expect(result.driftStatus.latestObservedCommitSha).toBe('newer-commit');
	});
});

async function executeWith(analysis: any) {
	const prisma = {
		impactAnalysis: {
			findUnique: jest.fn().mockResolvedValue(analysis),
		},
	};
	const useCase = new GetAnalysisWorkspaceUseCase(prisma as any);
	return useCase.execute(ids.analysis);
}

function createAnalysis(overrides: Record<string, unknown> = {}) {
	return {
		id: ids.analysis,
		status: 'WAITING_FOR_REVIEW',
		stage: 'DONE',
		progress: 100,
			requirementRevision: {
				id: ids.revision,
			title: 'Paid booking cancellation refund',
			rawText: 'Allow users to cancel paid bookings and receive refund.',
			normalizedText: 'Cancel paid bookings and create a refund.',
			},
			metadata: {
				domainPack: {
					id: 'booking',
					version: '0.1.0',
					status: 'STABLE',
					selectedBy: 'REPOSITORY_PROFILE',
				},
			},
			snapshot: {
			id: ids.snapshot,
			repositoryId: ids.repository,
			commitSha: 'abc123',
			analyzerVersion: 'nestjs-ts/0.1.0',
			profile: {
				domain: 'BOOKING',
				profileVersion: 'repo-profile@0.1.0',
			},
		},
		sourceTarget: {
			id: ids.target,
			resolvedRefType: 'BRANCH',
			latestObservedCommitSha: 'abc123',
		},
		insights: [riskInsight(), unknownInsight(), qaInsight()],
		traceabilityLinks: [traceabilityLink()],
		documentJobs: [],
		reviewedReportSnapshots: [],
		...overrides,
	};
}

function baseEvidence() {
	return {
		id: ids.evidence,
		sourceType: 'CODE',
		sourcePath: 'src/booking/booking.controller.ts',
		startLine: 10,
		endLine: 22,
		excerpt: 'cancelPaidBooking(command)',
		artifactId: ids.artifact,
		artifact: {
			artifactKey: 'api:booking.controller.cancel',
		},
	};
}

function riskInsight(overrides: Record<string, unknown> = {}) {
	return {
		id: ids.riskInsight,
		insightKey: 'risk:duplicate-refund',
		insightType: 'CLAIM',
		certainty: 'CONFLICTING',
		reviewStatus: 'NEEDS_REVIEW',
		title: 'Duplicate refund risk',
		description: 'Refund retry behavior may duplicate refund requests.',
		reasoning: 'No idempotency evidence is linked.',
		metadata: { kind: 'risk', severity: 'high', category: 'payment' },
		evidenceLinks: [{ evidenceId: ids.evidence, evidence: baseEvidence() }],
		...overrides,
	};
}

function unknownInsight(overrides: Record<string, unknown> = {}) {
	return {
		id: '00000000-0000-4000-8000-000000000014',
		insightKey: 'unknown:refund-policy',
		insightType: 'UNKNOWN',
		certainty: 'UNKNOWN',
		reviewStatus: 'NEEDS_REVIEW',
		title: 'Refund policy is unclear',
		description: 'Should partial payments receive partial refunds?',
		reasoning: 'Policy is absent from code evidence.',
		metadata: {},
		evidenceLinks: [{ evidenceId: ids.evidence, evidence: baseEvidence() }],
		...overrides,
	};
}

function qaInsight() {
	return {
		id: ids.qaInsight,
		insightKey: 'qa:cancel-paid-booking',
		insightType: 'QA_SCENARIO',
		certainty: 'INFERRED',
		reviewStatus: 'CONFIRMED',
		title: 'Cancel paid booking once',
		description: 'Given: A paid booking exists\nWhen: It is cancelled\nThen: One refund request is created',
		reasoning: 'Regression target: duplicate refund prevention.',
		metadata: {},
		evidenceLinks: [{ evidenceId: ids.evidence, evidence: baseEvidence() }],
	};
}

function traceabilityLink(overrides: Record<string, unknown> = {}) {
	return {
		id: ids.link,
		linkBasis: 'EVIDENCED',
		reviewStatus: 'NEEDS_REVIEW',
		artifact: {
			id: ids.artifact,
			artifactKey: 'api:booking.controller.cancel',
			name: 'BookingController.cancel',
			filePath: 'src/booking/booking.controller.ts',
			universalKind: 'API_ENDPOINT',
		},
		evidenceLinks: [{ evidenceId: ids.evidence, evidence: baseEvidence() }],
		reviewDecision: null,
		...overrides,
	};
}

function completedDocumentJob() {
	return {
		id: ids.job,
		status: 'COMPLETED',
		error: null,
		generatedDocumentId: ids.document,
		completedAt: new Date('2026-06-24T00:00:00.000Z'),
		updatedAt: new Date('2026-06-24T00:00:00.000Z'),
		generatedDocument: {
			id: ids.document,
			status: 'APPROVED',
			updatedAt: new Date('2026-06-24T00:00:00.000Z'),
		},
	};
}

function reviewedReportSnapshot() {
	return {
		id: ids.reportSnapshot,
		approvedDocumentId: ids.document,
		createdAt: new Date('2026-06-24T00:00:00.000Z'),
		approvedDocument: {
			id: ids.document,
			status: 'APPROVED',
			updatedAt: new Date('2026-06-24T00:00:00.000Z'),
		},
	};
}
