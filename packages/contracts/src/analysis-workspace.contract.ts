import { z } from 'zod';
import { universalArtifactKindSchema } from './artifact.contract';
import { impactAnalysisStatusSchema } from './impact-analysis.contract';
import { domainProfileCapabilityStatusSchema } from './domain-pack.contract';

export const analysisWorkspaceLanguageSchema = z.enum([
	'en',
	'vi',
	'unknown',
]);

export const analysisWorkspaceReviewStatusSchema = z.enum([
	'not_started',
	'in_progress',
	'complete',
]);

export const analysisWorkspaceSnapshotStatusSchema = z.enum([
	'missing',
	'locked',
]);

export const analysisWorkspaceReportStatusSchema = z.enum([
	'missing',
	'queued',
	'running',
	'completed',
	'failed',
]);

export const analysisWorkspaceDriftStatusSchema = z.enum([
	'unknown',
	'fresh',
	'stale',
]);

export const analysisWorkspaceReviewDecisionSchema = z.enum([
	'needs_review',
	'accepted',
	'rejected',
	'needs_more_evidence',
]);

export const analysisWorkspaceEvidenceBasisSchema = z.enum([
	'evidenced',
	'inferred',
	'unknown',
	'conflicting',
]);

export const analysisWorkspaceDomainPackSelectedBySchema = z.enum([
	'manual_config',
	'repository_profile',
	'safe_default',
]);

export const analysisWorkspaceDomainPackSchema = z.object({
	id: z.string(),
	version: z.string(),
	status: domainProfileCapabilityStatusSchema,
	selectedBy: analysisWorkspaceDomainPackSelectedBySchema,
});

export const analysisOverviewSchema = z.object({
	analysisId: z.string().uuid(),
	requirement: z.object({
		revisionId: z.string().uuid(),
		title: z.string(),
		summary: z.string(),
		language: analysisWorkspaceLanguageSchema,
		domainProfileId: z.string(),
		domainPack: analysisWorkspaceDomainPackSchema.nullable(),
	}),
	snapshot: z.object({
		snapshotId: z.string().uuid(),
		repositoryId: z.string().uuid(),
		commitSha: z.string(),
		analyzerVersion: z.string(),
		profileVersion: z.string().optional(),
	}),
	status: z.object({
		analysisStatus: impactAnalysisStatusSchema,
		reviewStatus: analysisWorkspaceReviewStatusSchema,
		snapshotStatus: analysisWorkspaceSnapshotStatusSchema,
		reportStatus: analysisWorkspaceReportStatusSchema,
		driftStatus: analysisWorkspaceDriftStatusSchema,
	}),
	counts: z.object({
		impactedArtifacts: z.number().int().nonnegative(),
		evidenceItems: z.number().int().nonnegative(),
		risks: z.number().int().nonnegative(),
		unknowns: z.number().int().nonnegative(),
		qaScenarios: z.number().int().nonnegative(),
		pendingReviewItems: z.number().int().nonnegative(),
	}),
});

export const impactGroupKindSchema = z.enum([
	'primary',
	'secondary',
	'test',
	'config',
	'unknown',
]);

export const impactArtifactCardSchema = z.object({
	artifactId: z.string().uuid(),
	artifactKey: z.string(),
	name: z.string(),
	filePath: z.string(),
	universalKind: universalArtifactKindSchema,
	impactBasis: analysisWorkspaceEvidenceBasisSchema,
	impactReason: z.string(),
	traceabilityLinkIds: z.array(z.string().uuid()),
	evidenceIds: z.array(z.string().uuid()),
	reviewDecision: analysisWorkspaceReviewDecisionSchema,
});

export const impactGroupSchema = z.object({
	group: impactGroupKindSchema,
	title: z.string(),
	description: z.string(),
	artifacts: z.array(impactArtifactCardSchema),
});

export const evidenceCardSchema = z.object({
	evidenceId: z.string().uuid(),
	sourceType: z.enum([
		'code',
		'test',
		'static_analysis',
		'requirement_input',
		'coverage',
		'human_note',
	]),
	filePath: z.string().nullable(),
	lineRange: z.object({
		startLine: z.number().int().positive().nullable(),
		endLine: z.number().int().positive().nullable(),
	}),
	excerpt: z.string(),
	relevanceReason: z.string(),
	artifactId: z.string().uuid().nullable(),
	artifactKey: z.string().nullable(),
	linkedInsightIds: z.array(z.string().uuid()),
	linkedTraceabilityLinkIds: z.array(z.string().uuid()),
});

export const riskSeveritySchema = z.enum(['low', 'medium', 'high']);

export const riskItemSchema = z.object({
	riskId: z.string(),
	sourceInsightId: z.string().uuid().nullable(),
	title: z.string(),
	severity: riskSeveritySchema,
	category: z.string(),
	whyItMatters: z.string(),
	relatedArtifactKeys: z.array(z.string()),
	relatedEvidenceIds: z.array(z.string().uuid()),
	relatedUnknownIds: z.array(z.string()),
	reviewDecision: analysisWorkspaceReviewDecisionSchema,
});

export const unknownItemSchema = z.object({
	unknownId: z.string(),
	sourceInsightId: z.string().uuid().nullable(),
	title: z.string(),
	question: z.string(),
	whyItMatters: z.string(),
	relatedArtifactKeys: z.array(z.string()),
	relatedEvidenceIds: z.array(z.string().uuid()),
	reviewDecision: analysisWorkspaceReviewDecisionSchema,
});

export const qaScenarioCardSchema = z.object({
	scenarioId: z.string(),
	sourceInsightId: z.string().uuid().nullable(),
	title: z.string(),
	given: z.string(),
	when: z.string(),
	then: z.string(),
	regressionTarget: z.string(),
	relatedRiskIds: z.array(z.string()),
	relatedUnknownIds: z.array(z.string()),
	relatedArtifactKeys: z.array(z.string()),
	relatedEvidenceIds: z.array(z.string().uuid()),
	reviewDecision: analysisWorkspaceReviewDecisionSchema,
});

export const analysisWorkspaceReviewQueueItemSchema = z.object({
	itemId: z.string(),
	itemType: z.enum([
		'impact',
		'evidence',
		'risk',
		'unknown',
		'qa_scenario',
		'report',
	]),
	title: z.string(),
	currentDecision: analysisWorkspaceReviewDecisionSchema,
	evidenceCount: z.number().int().nonnegative(),
	linkedArtifactKeys: z.array(z.string()),
	linkedEvidenceIds: z.array(z.string().uuid()),
	blockingFinalize: z.boolean(),
});

export const reportStatusCardSchema = z.object({
	status: analysisWorkspaceReportStatusSchema,
	generatedDocumentId: z.string().uuid().nullable(),
	documentJobId: z.string().uuid().nullable(),
	reviewedReportSnapshotId: z.string().uuid().nullable(),
	canExport: z.boolean(),
	lastGeneratedAt: z.string().nullable(),
	failureMessage: z.string().nullable(),
});

export const driftStatusCardSchema = z.object({
	status: analysisWorkspaceDriftStatusSchema,
	isStale: z.boolean(),
	basis: z.enum(['latest_observed_source_target', 'pinned_commit', 'unknown']),
	sourceTargetId: z.string().uuid().nullable(),
	latestObservedCommitSha: z.string().nullable(),
	snapshotCommitSha: z.string(),
	reason: z.string().nullable(),
});

export const analysisWorkspaceResponseSchema = z.object({
	overview: analysisOverviewSchema,
	impactGroups: z.array(impactGroupSchema),
	evidenceCards: z.array(evidenceCardSchema),
	risks: z.array(riskItemSchema),
	unknowns: z.array(unknownItemSchema),
	qaScenarios: z.array(qaScenarioCardSchema),
	reviewQueue: z.array(analysisWorkspaceReviewQueueItemSchema),
	reportStatus: reportStatusCardSchema,
	driftStatus: driftStatusCardSchema,
});

export type AnalysisWorkspaceLanguage = z.infer<
	typeof analysisWorkspaceLanguageSchema
>;
export type AnalysisWorkspaceReviewStatus = z.infer<
	typeof analysisWorkspaceReviewStatusSchema
>;
export type AnalysisWorkspaceSnapshotStatus = z.infer<
	typeof analysisWorkspaceSnapshotStatusSchema
>;
export type AnalysisWorkspaceReportStatus = z.infer<
	typeof analysisWorkspaceReportStatusSchema
>;
export type AnalysisWorkspaceDriftStatus = z.infer<
	typeof analysisWorkspaceDriftStatusSchema
>;
export type AnalysisWorkspaceDomainPack = z.infer<
	typeof analysisWorkspaceDomainPackSchema
>;
export type AnalysisOverview = z.infer<typeof analysisOverviewSchema>;
export type ImpactGroup = z.infer<typeof impactGroupSchema>;
export type ImpactArtifactCard = z.infer<typeof impactArtifactCardSchema>;
export type EvidenceCard = z.infer<typeof evidenceCardSchema>;
export type RiskItem = z.infer<typeof riskItemSchema>;
export type UnknownItem = z.infer<typeof unknownItemSchema>;
export type QaScenarioCard = z.infer<typeof qaScenarioCardSchema>;
export type AnalysisWorkspaceReviewQueueItem = z.infer<
	typeof analysisWorkspaceReviewQueueItemSchema
>;
export type ReportStatusCard = z.infer<typeof reportStatusCardSchema>;
export type DriftStatusCard = z.infer<typeof driftStatusCardSchema>;
export type AnalysisWorkspaceResponse = z.infer<
	typeof analysisWorkspaceResponseSchema
>;
