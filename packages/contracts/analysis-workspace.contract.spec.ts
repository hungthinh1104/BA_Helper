import {
	analysisWorkspaceResponseSchema,
	type AnalysisWorkspaceResponse,
} from './src';

describe('analysisWorkspaceResponseSchema', () => {
	it('accepts an explicit presentation read model with provenance links', () => {
		const payload: AnalysisWorkspaceResponse = {
			overview: {
				analysisId: '00000000-0000-4000-8000-000000000001',
				requirement: {
					revisionId: '00000000-0000-4000-8000-000000000002',
					title: 'Paid booking cancellation refund',
						summary: 'Cancel paid bookings and prevent duplicate refunds.',
						language: 'en',
						domainProfileId: 'booking@0.1.0',
						domainPack: {
							id: 'booking',
							version: '0.1.0',
							status: 'STABLE',
							selectedBy: 'REPOSITORY_PROFILE',
						},
					},
				snapshot: {
					snapshotId: '00000000-0000-4000-8000-000000000003',
					repositoryId: '00000000-0000-4000-8000-000000000004',
					commitSha: 'abc123',
					analyzerVersion: 'nestjs-ts/0.1.0',
					profileVersion: 'repo-profile@0.1.0',
				},
				status: {
					analysisStatus: 'WAITING_FOR_REVIEW',
					reviewStatus: 'in_progress',
					snapshotStatus: 'locked',
					reportStatus: 'missing',
					driftStatus: 'fresh',
				},
				counts: {
					impactedArtifacts: 1,
					evidenceItems: 1,
					risks: 1,
					unknowns: 1,
					qaScenarios: 1,
					pendingReviewItems: 1,
				},
			},
			impactGroups: [
				{
					group: 'primary',
					title: 'Booking cancellation flow',
					description: 'Primary backend artifacts for cancellation.',
					artifacts: [
						{
							artifactId: '00000000-0000-4000-8000-000000000005',
							artifactKey: 'api:booking.controller.cancel',
							name: 'BookingController.cancel',
							filePath: 'src/booking/booking.controller.ts',
							universalKind: 'API_ENDPOINT',
							impactBasis: 'evidenced',
							impactReason: 'Cancellation route handles the request.',
							traceabilityLinkIds: [
								'00000000-0000-4000-8000-000000000006',
							],
							evidenceIds: ['00000000-0000-4000-8000-000000000007'],
							reviewDecision: 'needs_review',
						},
					],
				},
			],
			evidenceCards: [
				{
					evidenceId: '00000000-0000-4000-8000-000000000007',
					sourceType: 'code',
					filePath: 'src/booking/booking.controller.ts',
					lineRange: { startLine: 10, endLine: 22 },
					excerpt: 'cancelPaidBooking(command)',
					relevanceReason: 'Shows the cancellation endpoint.',
					artifactId: '00000000-0000-4000-8000-000000000005',
					artifactKey: 'api:booking.controller.cancel',
					linkedInsightIds: ['00000000-0000-4000-8000-000000000008'],
					linkedTraceabilityLinkIds: [
						'00000000-0000-4000-8000-000000000006',
					],
				},
			],
			risks: [
				{
					riskId: 'risk:duplicate-refund',
					sourceInsightId: '00000000-0000-4000-8000-000000000008',
					title: 'Duplicate refund',
					severity: 'high',
					category: 'payment',
					whyItMatters: 'Refund retry may charge back twice.',
					relatedArtifactKeys: ['api:booking.controller.cancel'],
					relatedEvidenceIds: ['00000000-0000-4000-8000-000000000007'],
					relatedUnknownIds: ['unknown:refund-policy'],
					reviewDecision: 'needs_review',
				},
			],
			unknowns: [
				{
					unknownId: 'unknown:refund-policy',
					sourceInsightId: null,
					title: 'Refund policy is unclear',
					question: 'Should partially paid bookings receive partial refunds?',
					whyItMatters: 'Policy affects acceptance criteria and QA scenarios.',
					relatedArtifactKeys: ['api:booking.controller.cancel'],
					relatedEvidenceIds: ['00000000-0000-4000-8000-000000000007'],
					reviewDecision: 'needs_more_evidence',
				},
			],
			qaScenarios: [
				{
					scenarioId: 'qa:cancel-paid-booking',
					sourceInsightId: null,
					title: 'Cancel paid booking once',
					given: 'A paid booking exists',
					when: 'The customer cancels it',
					then: 'The system creates one refund request',
					regressionTarget: 'duplicate refund prevention',
					relatedRiskIds: ['risk:duplicate-refund'],
					relatedUnknownIds: ['unknown:refund-policy'],
					relatedArtifactKeys: ['api:booking.controller.cancel'],
					relatedEvidenceIds: ['00000000-0000-4000-8000-000000000007'],
					reviewDecision: 'needs_review',
				},
			],
			reviewQueue: [
				{
					itemId: 'review:risk:duplicate-refund',
					itemType: 'risk',
					title: 'Duplicate refund',
					currentDecision: 'needs_review',
					evidenceCount: 1,
					linkedArtifactKeys: ['api:booking.controller.cancel'],
					linkedEvidenceIds: ['00000000-0000-4000-8000-000000000007'],
					blockingFinalize: true,
					impactBasis: 'evidenced',
					isConflicting: false,
					allowedActions: ['accept', 'reject'],
					reviewNote: null,
					reviewedAt: null,
					reviewedByUserId: null,
				},
			],
			reviewSummary: {
				total: 1,
				pending: 1,
				blocking: 1,
				conflicting: 0,
				needsMoreEvidence: 0,
				reviewed: 0,
				accepted: 0,
				rejected: 0,
			},
			reportStatus: {
				status: 'missing',
				generatedDocumentId: null,
				documentJobId: null,
				reviewedReportSnapshotId: null,
				canFinalize: false,
				requiresUnreviewedAcknowledgement: true,
				canViewReport: false,
				canExport: false,
				canRetryReportGeneration: false,
				finalizeBlockingReasons: ['HIGH_RISK_INSIGHT_UNREVIEWED'],
				exportBlockingReasons: ['REPORT_NOT_GENERATED'],
				lastGeneratedAt: null,
				failureMessage: null,
			},
			driftStatus: {
				status: 'fresh',
				isStale: false,
				basis: 'latest_observed_source_target',
				sourceTargetId: '00000000-0000-4000-8000-000000000009',
				latestObservedCommitSha: 'abc123',
				snapshotCommitSha: 'abc123',
				reason: null,
			},
		};

		expect(analysisWorkspaceResponseSchema.parse(payload)).toEqual(payload);
	});
});
