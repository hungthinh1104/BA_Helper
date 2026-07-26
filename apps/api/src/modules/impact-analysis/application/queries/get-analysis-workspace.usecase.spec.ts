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

	it('maps EVIDENCED traceability link to impactBasis=evidenced with confidence', async () => {
		const result = await executeWith(createAnalysis());
		const artifact = result.impactGroups[0]?.artifacts[0];

		expect(artifact).toBeDefined();
		expect(artifact.impactBasis).toBe('evidenced');
		expect(artifact.confidence).toBeCloseTo(0.95);
	});

	it('maps INFERRED traceability link to impactBasis=inferred with confidence', async () => {
		const result = await executeWith(
			createAnalysis({
				traceabilityLinks: [
					traceabilityLink({
						linkBasis: 'INFERRED',
						confidence: 0.5,
					}),
				],
			}),
		);
		const artifact = result.impactGroups[0]?.artifacts[0];

		expect(artifact).toBeDefined();
		expect(artifact.impactBasis).toBe('inferred');
		expect(artifact.confidence).toBeCloseTo(0.5);
	});

	it('omits confidence when traceability link has no confidence value', async () => {
		const result = await executeWith(
			createAnalysis({
				traceabilityLinks: [
					traceabilityLink({ confidence: null }),
				],
			}),
		);
		const artifact = result.impactGroups[0]?.artifacts[0];

		expect(artifact).toBeDefined();
		expect(artifact.confidence).toBeUndefined();
		expect(() => analysisWorkspaceResponseSchema.parse(result)).not.toThrow();
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

	it('blocks finalize when an INFERRED traceability link has not been reviewed', async () => {
		const result = await executeWith(
			createAnalysis({
				insights: [
					riskInsight({ reviewStatus: 'CONFIRMED' }),
					unknownInsight({ reviewStatus: 'CONFIRMED' }),
					qaInsight(),
				],
				traceabilityLinks: [
					traceabilityLink({
						linkBasis: 'INFERRED',
						reviewStatus: 'NEEDS_REVIEW',
						reviewDecision: null,
					}),
				],
			}),
		);

		expect(result.reportStatus.canFinalize).toBe(false);
		expect(result.reportStatus.finalizeBlockingReasons).toContain(
			'INFERRED_LINKS_UNREVIEWED',
		);
	});

	it('unblocks finalize when an INFERRED traceability link is explicitly accepted', async () => {
		const result = await executeWith(
			createAnalysis({
				insights: [
					riskInsight({ reviewStatus: 'CONFIRMED' }),
					unknownInsight({ reviewStatus: 'CONFIRMED' }),
					qaInsight(),
				],
				traceabilityLinks: [
					traceabilityLink({
						linkBasis: 'INFERRED',
						reviewStatus: 'CONFIRMED',
						reviewDecision: {
							id: '00000000-0000-4000-8000-000000000016',
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
		expect(result.reportStatus.finalizeBlockingReasons).not.toContain(
			'INFERRED_LINKS_UNREVIEWED',
		);
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

	it('normalizes AI risk severity metadata to the public workspace contract', async () => {
		const result = await executeWith(
			createAnalysis({
				insights: [
					riskInsight({
						insightType: 'UNKNOWN',
						certainty: 'INFERRED',
						metadata: {
							kind: 'RISK',
							severity: 'HIGH',
							category: 'payment',
							resolvedRelatedArtifactKeys: ['service-method:booking.service.cancelBooking'],
						},
					}),
				],
				traceabilityLinks: [],
			}),
		);

		expect(result.risks).toEqual([
			expect.objectContaining({
				riskId: 'risk:duplicate-refund',
				severity: 'high',
				relatedArtifactKeys: [
					'api:booking.controller.cancel',
					'service-method:booking.service.cancelBooking',
				],
			}),
		]);
		expect(result.unknowns).toEqual([]);
		expect(result.reviewQueue).toEqual([
			expect.objectContaining({
				itemId: ids.riskInsight,
				itemType: 'risk',
				linkedArtifactKeys: [
					'api:booking.controller.cancel',
					'service-method:booking.service.cancelBooking',
				],
			}),
		]);
	});

	it('counts pending review items from insight and traceability state', async () => {
		const result = await executeWith(createAnalysis());

		// The queue now carries every reviewable item (including the CONFIRMED qa
		// scenario), while the pending count reflects only items still needing a
		// decision.
		expect(result.reviewQueue).toHaveLength(4);
		expect(result.overview.counts.pendingReviewItems).toBe(3);
		expect(result.reviewSummary).toEqual({
			total: 4,
			pending: 3,
			blocking: 2,
			conflicting: 1,
			needsMoreEvidence: 0,
			reviewed: 1,
			accepted: 1,
			rejected: 0,
		});
	});

	it('keeps reviewed items in the queue with their persisted decision', async () => {
		const result = await executeWith(createAnalysis());

		const qa = result.reviewQueue.find((item) => item.itemId === ids.qaInsight);
		expect(qa).toBeDefined();
		expect(qa!.currentDecision).toBe('accepted');
		expect(qa!.blockingFinalize).toBe(false);
		expect(qa!.allowedActions).toEqual(['accept', 'reject']);
	});

	it('derives per-item blockingFinalize from the approval gate, not a hardcode', async () => {
		const result = await executeWith(createAnalysis());

		const risk = result.reviewQueue.find((item) => item.itemId === ids.riskInsight);
		const unknown = result.reviewQueue.find(
			(item) => item.itemId === '00000000-0000-4000-8000-000000000014',
		);
		const link = result.reviewQueue.find((item) => item.itemId === ids.link);

		// The critical conflicting insight and the EVIDENCED link block finalize; the
		// non-critical unknown does not — the old hardcode marked all of them blocking.
		expect(risk!.blockingFinalize).toBe(true);
		expect(risk!.isConflicting).toBe(true);
		expect(link!.blockingFinalize).toBe(true);
		expect(link!.allowedActions).toEqual(['accept', 'reject', 'needs_more_evidence', 'undo']);
		expect(unknown!.blockingFinalize).toBe(false);
	});

	it('exposes the persisted note and reviewer attribution for a decided link', async () => {
		const result = await executeWith(
			createAnalysis({
				traceabilityLinks: [
					traceabilityLink({
						reviewStatus: 'CONFIRMED',
						reviewDecision: {
							id: '00000000-0000-4000-8000-000000000017',
							analysisId: ids.analysis,
							traceabilityLinkId: ids.link,
							decision: 'ACCEPTED',
							note: 'Confirmed via integration test.',
							reviewedByUserId: '00000000-0000-4000-8000-0000000000aa',
							reviewedAt: new Date('2026-06-24T00:00:00.000Z'),
						},
					}),
				],
			}),
		);

		const link = result.reviewQueue.find((item) => item.itemId === ids.link);
		expect(link!.currentDecision).toBe('accepted');
		expect(link!.reviewNote).toBe('Confirmed via integration test.');
		expect(link!.reviewedByUserId).toBe('00000000-0000-4000-8000-0000000000aa');
		expect(link!.reviewedAt).toBe('2026-06-24T00:00:00.000Z');
	});

	it('keeps a needs-more-evidence link in the queue and still blocking', async () => {
		const result = await executeWith(
			createAnalysis({
				traceabilityLinks: [
					traceabilityLink({
						linkBasis: 'INFERRED',
						reviewStatus: 'NEEDS_REVIEW',
						reviewDecision: {
							id: '00000000-0000-4000-8000-000000000018',
							analysisId: ids.analysis,
							traceabilityLinkId: ids.link,
							decision: 'NEEDS_MORE_EVIDENCE',
							note: 'Need to see the caller.',
							reviewedByUserId: null,
							reviewedAt: new Date('2026-06-24T00:00:00.000Z'),
						},
					}),
				],
			}),
		);

		const link = result.reviewQueue.find((item) => item.itemId === ids.link);
		expect(link).toBeDefined();
		expect(link!.currentDecision).toBe('needs_more_evidence');
		// An INFERRED link parked on needs-more-evidence has not been decided, so it
		// still blocks finalize and stays visible in the queue.
		expect(link!.blockingFinalize).toBe(true);
		expect(result.reviewSummary.needsMoreEvidence).toBe(1);
	});

	it('does not derive domain pack capability when backend metadata is missing', async () => {
		const result = await executeWith(createAnalysis({ metadata: null }));

		expect(result.overview.requirement.domainProfileId).toBe('booking@repo-profile@0.1.0');
		expect(result.overview.requirement.domainPack).toBeNull();
	});

	it('projects canonical domain pack values from persisted columns', async () => {
		const result = await executeWith(createAnalysis({
			requestedDomainPackId: 'HEALTHCARE@0.1.0',
			resolvedDomainPackId: 'HEALTHCARE@0.1.0',
			resolvedDomainPackVersion: '0.1.0',
			resolvedDomainPackStatus: 'partial',
			domainPackSelectedBy: 'manual_config',
			metadata: null,
		}));

		expect(result.overview.requirement.domainPack).toEqual({
			id: 'healthcare',
			version: '0.1.0',
			status: 'PARTIAL',
			selectedBy: 'EXPLICIT',
		});
	});

	it('prefers domain pack columns over stale metadata', async () => {
		const result = await executeWith(createAnalysis({
			requestedDomainPackId: 'ecommerce',
			resolvedDomainPackId: 'ecommerce',
			resolvedDomainPackVersion: '0.1.0',
			resolvedDomainPackStatus: 'PARTIAL',
			domainPackSelectedBy: 'EXPLICIT',
			metadata: {
				domainPack: {
					id: 'booking',
					version: '0.1.0',
					status: 'STABLE',
					selectedBy: 'REPOSITORY_PROFILE',
				},
			},
		}));

		expect(result.overview.requirement.domainPack).toEqual({
			id: 'ecommerce',
			version: '0.1.0',
			status: 'PARTIAL',
			selectedBy: 'EXPLICIT',
		});
	});

	it('projects legacy domain pack metadata with canonical casing', async () => {
		const result = await executeWith(createAnalysis({
			metadata: {
				domainPack: {
					id: 'ECOMMERCE@0.1.0',
					version: '0.1.0',
					status: 'partial',
					selectedBy: 'manual_config',
				},
			},
		}));

		expect(result.overview.requirement.domainPack).toEqual({
			id: 'ecommerce',
			version: '0.1.0',
			status: 'PARTIAL',
			selectedBy: 'EXPLICIT',
		});
	});

	it('returns null for invalid legacy domain pack metadata', async () => {
		const result = await executeWith(createAnalysis({
			metadata: {
				domainPack: {
					id: 'booking',
					version: '0.1.0',
					status: 'SUPPORTED',
					selectedBy: 'automatic',
				},
			},
		}));

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
		confidence: 0.95,
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
