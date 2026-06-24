import { z } from 'zod';
import { snapshotIndexStatusSchema } from './repository.contract';
import { diagnosticItemSchema, DiagnosticItem } from './diagnostic.contract';
import { universalArtifactKindSchema } from './artifact.contract';

export const impactAnalysisCreateRequestSchema = z.object({
	snapshotId: z.string().uuid(),
	sourceTargetId: z.string().uuid(),
	allowPartialSnapshot: z.boolean().default(false),
	requestKey: z.string().uuid(),
	derivedFromAnalysisId: z.string().uuid().optional(),
	sourceClarificationId: z.string().uuid().optional(),
});

export const multiRepoImpactAnalysisCreateRequestSchema = z.object({
	requirementRevisionId: z.string().uuid(),
	repositoryIds: z.array(z.string().uuid()).min(2).max(20),
	allowPartialSnapshot: z.boolean().default(false),
	requestKey: z.string().uuid(),
}).superRefine((data, ctx) => {
	const unique = new Set(data.repositoryIds);
	if (unique.size !== data.repositoryIds.length) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'repositoryIds must be unique',
			path: ['repositoryIds'],
		});
	}
});

export const impactAnalysisStatusSchema = z.enum([
	'QUEUED',
	'RUNNING',
	'WAITING_FOR_REVIEW',
	'COMPLETED',
	'FAILED',
	'CANCELLED',
]);

export const impactAnalysisStageSchema = z.enum([
	'WAITING',
	'RETRIEVING_EVIDENCE',
	'EXPANDING_GRAPH',
	'RUNNING_AI_REASONING',
	'GENERATING_INSIGHTS',
	'GENERATING_DOCUMENTS',
	'DONE',
]);

export const analysisErrorSchema = z.object({
	code: z.string(),
	message: z.string(),
	stage: z.string().optional(),
	retryable: z.boolean().optional(),
});


export const impactAnalysisResponseSchema = z.object({
	id: z.string().uuid(),
	sourceTarget: z.object({
		id: z.string().uuid(),
		requestedRef: z.string(),
		resolvedRefType: z.enum(['BRANCH', 'TAG', 'COMMIT']),
		latestObservedCommitSha: z.string(),
	}),
	snapshot: z.object({
		id: z.string().uuid(),
		repositoryId: z.string().uuid(),
		commitSha: z.string(),
		analyzerVersion: z.string(),
		coverageStatus: z.enum(['READY', 'PARTIAL']),
		indexStatus: snapshotIndexStatusSchema,
	}),
	freshness: z.object({
		isStale: z.boolean(),
		isAnalyzerOutdated: z.boolean(),
		basis: z.enum(['LATEST_OBSERVED_SOURCE_TARGET', 'PINNED_COMMIT']),
	}),
	requirement: z.object({
		id: z.string().uuid(),
		revisionId: z.string().uuid(),
		revisionTitle: z.string(),
		rawText: z.string(),
	}),
	status: impactAnalysisStatusSchema,
	stage: impactAnalysisStageSchema,
	progress: z.number().min(0).max(100),
	coverageWarning: z.string().nullable(),
	capabilities: z.object({
		canReview: z.boolean(),
		canFinalize: z.boolean(),
		canExport: z.boolean(),
		canRerun: z.boolean(),
		canCancel: z.boolean(),
	}),
	derivedFromAnalysisId: z.string().uuid().nullable().optional(),
	sourceClarificationId: z.string().uuid().nullable().optional(),
	error: analysisErrorSchema.nullable().optional(),
});

export const impactAnalysisListItemResponseSchema = z.object({
	id: z.string().uuid(),
	title: z.string(),
	status: impactAnalysisStatusSchema,
	stage: impactAnalysisStageSchema,
	isStale: z.boolean(),
	requirementRevisionTitle: z.string(),
	repositoryDisplayName: z.string(),
	snapshotCommitSha: z.string(),
	createdAt: z.string(),
	capabilities: z.object({
		canReview: z.boolean(),
		canFinalize: z.boolean(),
		canExport: z.boolean(),
	}),
	derivedFromAnalysisId: z.string().uuid().nullable().optional(),
	sourceClarificationId: z.string().uuid().nullable().optional(),
	error: analysisErrorSchema.nullable().optional(),
});

export const impactAnalysisListResponseSchema = z.object({
	items: z.array(impactAnalysisListItemResponseSchema),
});

export const multiRepoImpactAnalysisCreateResponseSchema = z.object({
	runId: z.string().uuid(),
	requestKey: z.string().uuid(),
	items: z.array(z.object({
		repositoryId: z.string().uuid(),
		repositoryDisplayName: z.string(),
		analysisId: z.string().uuid(),
		snapshotId: z.string().uuid(),
		sourceTargetId: z.string().uuid(),
		status: impactAnalysisStatusSchema,
	})),
});

export const multiRepoAnalysisRunDetailResponseSchema = z.object({
	runId: z.string().uuid(),
	projectId: z.string().uuid(),
	requirementRevisionId: z.string().uuid(),
	requirementTitle: z.string(),
	createdBy: z.string(),
	createdAt: z.string(),
	runReadiness: z.object({
		totalAnalyses: z.number().int().nonnegative(),
		completedAnalyses: z.number().int().nonnegative(),
		failedAnalyses: z.number().int().nonnegative(),
		waitingForReviewAnalyses: z.number().int().nonnegative(),
		allCompleted: z.boolean(),
		hasFailures: z.boolean(),
		canStartMergedReport: z.boolean(),
	}),
	childReviewSummary: z.object({
		accepted: z.number().int().nonnegative(),
		rejected: z.number().int().nonnegative(),
		needsMoreClarification: z.number().int().nonnegative(),
		pendingReview: z.number().int().nonnegative(),
	}),
	items: z.array(z.object({
		analysisId: z.string().uuid(),
		repositoryId: z.string().uuid(),
		repositoryDisplayName: z.string(),
		snapshotId: z.string().uuid(),
		commitSha: z.string(),
		status: impactAnalysisStatusSchema,
		isStale: z.boolean(),
		latestReviewDecision: z.enum(['ACCEPTED', 'REJECTED', 'NEEDS_MORE_CLARIFICATION']).nullable(),
		latestReviewDecisionAt: z.string().nullable(),
		reviewedBy: z.string().nullable(),
		blockingReason: z.enum([
			'FAILED',
			'NOT_COMPLETED',
			'WAITING_FOR_REVIEW',
			'NEEDS_MORE_CLARIFICATION',
			'REJECTED',
			'NONE',
		]),
	})),
});

export const multiRepoAnalysisRunStatusCountsSchema = z.object({
	QUEUED: z.number().int().nonnegative(),
	RUNNING: z.number().int().nonnegative(),
	WAITING_FOR_REVIEW: z.number().int().nonnegative(),
	COMPLETED: z.number().int().nonnegative(),
	FAILED: z.number().int().nonnegative(),
	CANCELLED: z.number().int().nonnegative(),
});

export const multiRepoAnalysisRunListItemResponseSchema = z.object({
	runId: z.string().uuid(),
	projectId: z.string().uuid(),
	requirementRevisionId: z.string().uuid(),
	requirementTitle: z.string(),
	createdBy: z.string(),
	createdAt: z.string(),
	analysisCount: z.number().int().nonnegative(),
	statusCounts: multiRepoAnalysisRunStatusCountsSchema,
});

export const multiRepoAnalysisRunListResponseSchema = z.object({
	items: z.array(multiRepoAnalysisRunListItemResponseSchema),
});

export const multiRepoImpactMatrixRowSchema = z.object({
	domain: z.string().nullable(),
	repositoryId: z.string().uuid(),
	repositoryDisplayName: z.string(),
	language: z.string().nullable(),
	framework: z.string().nullable(),
	analysisId: z.string().uuid(),
	analysisStatus: impactAnalysisStatusSchema,
	latestReviewDecision: z.enum(['ACCEPTED', 'REJECTED', 'NEEDS_MORE_CLARIFICATION']).nullable(),
	artifactCounts: z.object({
		API_ENDPOINT: z.number().int().nonnegative(),
		DOMAIN_SERVICE: z.number().int().nonnegative(),
		DATA_MODEL: z.number().int().nonnegative(),
		TEST_CASE: z.number().int().nonnegative(),
		UNKNOWN: z.number().int().nonnegative(),
	}),
	riskCount: z.number().int().nonnegative(),
	unknownCount: z.number().int().nonnegative(),
	conflictingCount: z.number().int().nonnegative(),
	qaScenarioCount: z.number().int().nonnegative(),
	evidenceCount: z.number().int().nonnegative(),
	blockingReason: z.enum([
		'FAILED',
		'NOT_COMPLETED',
		'WAITING_FOR_REVIEW',
		'NEEDS_MORE_CLARIFICATION',
		'REJECTED',
		'NONE',
	]).nullable(),
});

export const multiRepoImpactMatrixResponseSchema = z.object({
	runId: z.string().uuid(),
	requirementTitle: z.string(),
	rows: z.array(multiRepoImpactMatrixRowSchema),
	summary: z.object({
		totalRepositories: z.number().int().nonnegative(),
		domainsImpacted: z.array(z.string()),
		totalArtifacts: z.number().int().nonnegative(),
		totalRisks: z.number().int().nonnegative(),
		totalQaScenarios: z.number().int().nonnegative(),
		acceptedRepos: z.number().int().nonnegative(),
		blockedRepos: z.number().int().nonnegative(),
	}),
});

export const multiRepoMergedReportDraftResponseSchema = z.object({
	runId: z.string().uuid(),
	projectId: z.string().uuid(),
	requirementRevisionId: z.string().uuid(),
	requirementTitle: z.string(),
	generatedAt: z.string(),
	childAnalysisCount: z.number().int().nonnegative(),
	repositories: z.array(z.object({
		repositoryId: z.string().uuid(),
		repositoryDisplayName: z.string(),
		analysisId: z.string().uuid(),
		snapshotId: z.string().uuid(),
		commitSha: z.string(),
	})),
	markdown: z.string(),
});

export const multiRepoApprovedReportResponseSchema = z.object({
	id: z.string().uuid(),
	runId: z.string().uuid(),
	projectId: z.string().uuid(),
	requirementRevisionId: z.string().uuid(),
	requirementTitle: z.string(),
	markdown: z.string(),
	approvedAt: z.string(),
	isStale: z.boolean(),
	staleReason: z.string().optional(),
	provenance: z.object({
		childAnalyses: z.array(z.object({
			analysisId: z.string().uuid(),
			latestReviewDecisionId: z.string().uuid(),
			snapshotId: z.string().uuid(),
			commitSha: z.string(),
		})),
	}),
});

export const mergedMultiRepoReportReviewDecisionResponseSchema = z.object({
	id: z.string().uuid(),
	mergedReportId: z.string().uuid(),
	runId: z.string().uuid(),
	decision: z.enum(['ACCEPTED', 'REJECTED', 'NEEDS_MORE_CLARIFICATION']),
	note: z.string().nullable(),
	reviewedBy: z.string(),
	createdAt: z.string(),
});

export const mergedMultiRepoReportReviewDecisionListResponseSchema = z.object({
	items: z.array(mergedMultiRepoReportReviewDecisionResponseSchema),
});

export const mergedMultiRepoReportReviewDecisionCreateResponseSchema = z.object({
	decision: mergedMultiRepoReportReviewDecisionResponseSchema,
});

export const diffArtifactSchema = z.object({
	artifactKey: z.string(),
	name: z.string(),
	artifactType: z.string(),
	universalKind: universalArtifactKindSchema,
	filePath: z.string(),
	reviewStatus: z.enum(['NEEDS_REVIEW', 'CONFIRMED', 'REJECTED']),
});

export const diffInsightSchema = z.object({
	insightKey: z.string(),
	category: z.enum(['CLAIM', 'UNKNOWN', 'QUESTION', 'ACCEPTANCE_CRITERIA', 'QA_SCENARIO']),
	statement: z.string(),
	reviewStatus: z.enum(['NEEDS_REVIEW', 'CONFIRMED', 'REJECTED']),
});

export const impactAnalysisDiffResponseSchema = z.object({
	baseAnalysisId: z.string().uuid(),
	currentAnalysisId: z.string().uuid(),

	comparisonContext: z.object({
		requirementChanged: z.boolean(),
		snapshotChanged: z.boolean(),
		baseRequirementRevisionId: z.string().uuid(),
		currentRequirementRevisionId: z.string().uuid(),
		baseSnapshotId: z.string().uuid(),
		currentSnapshotId: z.string().uuid(),
		baseCommitSha: z.string().optional(),
		currentCommitSha: z.string().optional(),
		sourceClarificationId: z.string().uuid().optional(),
		reviewClarificationRequestId: z.string().uuid().optional(),
	}),

	summary: z.object({
		addedImpacts: z.number(),
		removedImpacts: z.number(),
		unchangedImpacts: z.number(),
		resolvedUnknowns: z.number(),
		removedUnknowns: z.number(),
		newUnknowns: z.number(),
		addedQaScenarios: z.number(),
	}),

	addedArtifacts: z.array(diffArtifactSchema),
	removedArtifacts: z.array(diffArtifactSchema),
	unchangedArtifacts: z.array(diffArtifactSchema),

	resolvedUnknowns: z.array(diffInsightSchema),
	removedUnknowns: z.array(diffInsightSchema),
	newUnknowns: z.array(diffInsightSchema),
	addedQaScenarios: z.array(diffInsightSchema),

	diagnostics: z.array(diagnosticItemSchema).optional(),
});

export const driftFreshnessRecommendationSchema = z.object({
	status: z.enum(['CURRENT', 'DRIFTED', 'UNKNOWN', 'INCOMPATIBLE']),
	severity: z.enum(['INFO', 'WARN', 'HIGH']),
	shouldReviewBeforeUse: z.boolean(),
	shouldRerunAnalysis: z.boolean(),
	reason: z.string(),
	driftSummary: z.object({
		addedArtifactCount: z.number().int().nonnegative(),
		removedArtifactCount: z.number().int().nonnegative(),
		changedArtifactCount: z.number().int().nonnegative(),
		unknownChangedArtifactCount: z.number().int().nonnegative(),
		hashUnavailableArtifactCount: z.number().int().nonnegative(),
	}).optional(),
});

export type ImpactAnalysisCreateRequest = z.infer<typeof impactAnalysisCreateRequestSchema>;
export type MultiRepoImpactAnalysisCreateRequest = z.infer<typeof multiRepoImpactAnalysisCreateRequestSchema>;
export type ImpactAnalysisResponse = z.infer<typeof impactAnalysisResponseSchema>;
export type ImpactAnalysisDetailResponse = ImpactAnalysisResponse; // Alias for clarity
export type ImpactAnalysisListItemResponse = z.infer<typeof impactAnalysisListItemResponseSchema>;
export type ImpactAnalysisListResponse = z.infer<typeof impactAnalysisListResponseSchema>;
export type MultiRepoImpactAnalysisCreateResponse = z.infer<typeof multiRepoImpactAnalysisCreateResponseSchema>;
export type MultiRepoAnalysisRunDetailResponse = z.infer<typeof multiRepoAnalysisRunDetailResponseSchema>;
export type MultiRepoAnalysisRunListItemResponse = z.infer<typeof multiRepoAnalysisRunListItemResponseSchema>;
export type MultiRepoAnalysisRunListResponse = z.infer<typeof multiRepoAnalysisRunListResponseSchema>;
export type MultiRepoImpactMatrixRow = z.infer<typeof multiRepoImpactMatrixRowSchema>;
export type MultiRepoImpactMatrixResponse = z.infer<typeof multiRepoImpactMatrixResponseSchema>;
export type MultiRepoMergedReportDraftResponse = z.infer<typeof multiRepoMergedReportDraftResponseSchema>;
export type MultiRepoApprovedReportResponse = z.infer<typeof multiRepoApprovedReportResponseSchema>;
export type MergedMultiRepoReportReviewDecisionResponse = z.infer<typeof mergedMultiRepoReportReviewDecisionResponseSchema>;
export type MergedMultiRepoReportReviewDecisionListResponse = z.infer<typeof mergedMultiRepoReportReviewDecisionListResponseSchema>;
export type MergedMultiRepoReportReviewDecisionCreateResponse = z.infer<typeof mergedMultiRepoReportReviewDecisionCreateResponseSchema>;
export type ImpactAnalysisDiffResponse = z.infer<typeof impactAnalysisDiffResponseSchema>;
export type DiffArtifact = z.infer<typeof diffArtifactSchema>;
export type DiffInsight = z.infer<typeof diffInsightSchema>;
export type DriftFreshnessRecommendation = z.infer<typeof driftFreshnessRecommendationSchema>;

export const reviewDecisionRequestSchema = z.object({
	decision: z.enum(['ACCEPTED', 'REJECTED', 'NEEDS_MORE_CLARIFICATION']),
	note: z.string().max(2000).optional(),
});

export const reviewDecisionResponseSchema = z.object({
	id: z.string().uuid(),
	analysisId: z.string().uuid(),
	decision: z.enum(['ACCEPTED', 'REJECTED', 'NEEDS_MORE_CLARIFICATION']),
	note: z.string().nullable(),
	reviewedBy: z.string(),
	createdAt: z.string(),
});

export const reviewDecisionListResponseSchema = z.object({
	items: z.array(reviewDecisionResponseSchema),
});

export const reviewDecisionCreateResponseSchema = z.object({
	decision: reviewDecisionResponseSchema,
	reportRegenerated: z.boolean(),
	reportRegenerationError: z.string().optional(),
});

export type ReviewDecisionRequest = z.infer<typeof reviewDecisionRequestSchema>;
export type ReviewDecisionResponse = z.infer<typeof reviewDecisionResponseSchema>;
export type ReviewDecisionListResponse = z.infer<typeof reviewDecisionListResponseSchema>;
export type ReviewDecisionCreateResponse = z.infer<typeof reviewDecisionCreateResponseSchema>;

export const matrixRowEvidenceItemSchema = z.object({
	evidenceId: z.string().uuid(),
	quoteOrSnippet: z.string(),
	sourceFile: z.string().nullable(),
	startLine: z.number().nullable(),
	endLine: z.number().nullable(),
	linkType: z.string(),
	retrievalSignals: z.any().optional(),
});

export const matrixRowInsightRefSchema = z.object({
	insightId: z.string().uuid(),
	insightType: z.string(),
	title: z.string(),
	description: z.string().nullable().optional(),
	certainty: z.string().nullable().optional(),
	relatedEvidenceIds: z.array(z.string().uuid()),
});

export const matrixRowArtifactDetailSchema = z.object({
	artifactId: z.string().uuid(),
	artifactKey: z.string(),
	displayName: z.string(),
	universalKind: z.string(),
	rawArtifactType: z.string(),
	filePath: z.string(),
	startLine: z.number().nullable(),
	endLine: z.number().nullable(),
	linkStrength: z.string(),
	linkReason: z.string().nullable(),
	evidenceItems: z.array(matrixRowEvidenceItemSchema),
	relatedRisks: z.array(z.string().uuid()),
	relatedQaScenarios: z.array(z.string().uuid()),
	retrievalDiagnostics: z.any().optional(),
});

export const matrixRowDetailResponseSchema = z.object({
	runId: z.string().uuid(),
	analysisId: z.string().uuid(),
	domain: z.string().nullable(),
	repository: z.string(),
	impactedArtifacts: z.array(matrixRowArtifactDetailSchema),
	risks: z.array(matrixRowInsightRefSchema),
	qaScenarios: z.array(matrixRowInsightRefSchema),
	evidenceSummary: z.object({
		totalEvidenceItems: z.number().int().nonnegative(),
		coveredArtifacts: z.number().int().nonnegative(),
		uncoveredArtifacts: z.number().int().nonnegative(),
	}),
	reviewState: z.object({
		status: impactAnalysisStatusSchema,
		latestDecision: z.string().nullable(),
	}),
});

export type MatrixRowEvidenceItem = z.infer<typeof matrixRowEvidenceItemSchema>;
export type MatrixRowInsightRef = z.infer<typeof matrixRowInsightRefSchema>;
export type MatrixRowArtifactDetail = z.infer<typeof matrixRowArtifactDetailSchema>;
export type MatrixRowDetailResponse = z.infer<typeof matrixRowDetailResponseSchema>;

export const reviewCoverageStatusSchema = z.enum(['PASS', 'WARN', 'FAIL']);

export const reviewCoverageGateCategorySchema = z.enum([
	'REVIEW_DECISION',
	'EVIDENCE_COVERAGE',
	'QA_COVERAGE',
	'RISK_COVERAGE',
	'REPOSITORY_READINESS',
]);

export const reviewCoverageGateSchema = z.object({
	gateId: z.string(),
	category: reviewCoverageGateCategorySchema,
	status: reviewCoverageStatusSchema,
	title: z.string(),
	description: z.string(),
	recommendedAction: z.string(),
	affectedAnalysisIds: z.array(z.string().uuid()),
	affectedArtifactIds: z.array(z.string().uuid()),
	affectedInsightIds: z.array(z.string().uuid()),
	affectedRepositoryIds: z.array(z.string().uuid()),
});

export const reviewCoverageResponseSchema = z.object({
	runId: z.string().uuid(),
	status: reviewCoverageStatusSchema,
	summary: z.object({
		totalRepositories: z.number().int().nonnegative(),
		acceptedRepositories: z.number().int().nonnegative(),
		pendingRepositories: z.number().int().nonnegative(),
		rejectedRepositories: z.number().int().nonnegative(),
		impactedArtifacts: z.number().int().nonnegative(),
		artifactsWithEvidence: z.number().int().nonnegative(),
		uncoveredArtifacts: z.number().int().nonnegative(),
		risks: z.number().int().nonnegative(),
		risksWithQa: z.number().int().nonnegative(),
		risksWithoutQa: z.number().int().nonnegative(),
		qaScenarios: z.number().int().nonnegative(),
		blockingGates: z.number().int().nonnegative(),
		warningGates: z.number().int().nonnegative(),
	}),
	gates: z.array(reviewCoverageGateSchema),
});

export type ReviewCoverageStatus = z.infer<typeof reviewCoverageStatusSchema>;
export type ReviewCoverageGateCategory = z.infer<typeof reviewCoverageGateCategorySchema>;
export type ReviewCoverageGate = z.infer<typeof reviewCoverageGateSchema>;
export type ReviewCoverageResponse = z.infer<typeof reviewCoverageResponseSchema>;
