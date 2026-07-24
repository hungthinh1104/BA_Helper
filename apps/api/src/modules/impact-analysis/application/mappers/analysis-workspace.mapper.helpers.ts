import type { AnalysisWorkspaceResponse } from '@ba-helper/contracts';
import { projectDomainPackSelection } from '@ba-helper/application';
import { buildEvidenceQualityProjection } from '../../../document/application/evidence-quality.projection';
import {
	buildReportApprovalGateItems,
	ReportApprovalGatePolicy,
} from '../../../document/application/report-approval-gate.policy';
import type {
	WorkspaceAnalysis,
	WorkspaceDocumentJob,
	WorkspaceInsight,
	WorkspaceReviewedReportSnapshot,
} from './analysis-workspace.mapper.types';

export function buildReportStatus(
	analysis: WorkspaceAnalysis,
): AnalysisWorkspaceResponse['reportStatus'] {
	const latestSnapshot = analysis.reviewedReportSnapshots[0] ?? null;
	const latestJob = analysis.documentJobs[0] ?? null;
	const generatedDocument =
		latestJob?.generatedDocument ?? latestSnapshot?.approvedDocument ?? null;

	if (latestJob?.status === 'QUEUED' || latestJob?.status === 'RUNNING') {
		return reportCard(analysis, latestJob.status.toLowerCase() as 'queued' | 'running', latestJob, latestSnapshot);
	}

	if (generatedDocument?.status === 'APPROVED' || latestJob?.status === 'COMPLETED') {
		return reportCard(analysis, 'completed', latestJob, latestSnapshot);
	}

	if (latestJob?.status === 'FAILED') {
		return reportCard(analysis, 'failed', latestJob, latestSnapshot);
	}

	return reportCard(analysis, 'missing', latestJob, latestSnapshot);
}

export function buildDriftStatus(
	analysis: WorkspaceAnalysis,
): AnalysisWorkspaceResponse['driftStatus'] {
	const target = analysis.sourceTarget;
	if (!target) {
		return {
			status: 'unknown',
			isStale: false,
			basis: 'unknown',
			sourceTargetId: null,
			latestObservedCommitSha: null,
			snapshotCommitSha: analysis.snapshot.commitSha,
			reason: 'No source target is available for freshness projection.',
		};
	}

	const pinned = target.resolvedRefType === 'COMMIT';
	const stale = !pinned && target.latestObservedCommitSha !== analysis.snapshot.commitSha;

	return {
		status: stale ? 'stale' : 'fresh',
		isStale: stale,
		basis: pinned ? 'pinned_commit' : 'latest_observed_source_target',
		sourceTargetId: target.id,
		latestObservedCommitSha: target.latestObservedCommitSha,
		snapshotCommitSha: analysis.snapshot.commitSha,
		reason: stale ? 'Selected repository target has a newer observed commit.' : null,
	};
}

export function reportCard(
	analysis: WorkspaceAnalysis,
	status: AnalysisWorkspaceResponse['reportStatus']['status'],
	job: WorkspaceDocumentJob | null,
	snapshot: WorkspaceReviewedReportSnapshot | null,
): AnalysisWorkspaceResponse['reportStatus'] {
	const document = job?.generatedDocument ?? snapshot?.approvedDocument ?? null;
	const stale = isAnalysisStale(analysis);
	const finalizeBlockingReasons = buildFinalizeBlockingReasons(analysis, stale);
	const exportBlockingReasons = buildExportBlockingReasons(status, stale);
	return {
		status,
		generatedDocumentId: document?.id ?? job?.generatedDocumentId ?? null,
		documentJobId: job?.id ?? null,
		reviewedReportSnapshotId: snapshot?.id ?? null,
		canFinalize: finalizeBlockingReasons.length === 0,
		requiresUnreviewedAcknowledgement: hasUnreviewedItems(analysis),
		canViewReport: status === 'completed',
		canExport: status === 'completed' && !stale,
		canRetryReportGeneration: status === 'failed' && analysis.status === 'COMPLETED' && !stale,
		finalizeBlockingReasons,
		exportBlockingReasons,
		lastGeneratedAt:
			job?.completedAt?.toISOString() ??
			document?.updatedAt?.toISOString() ??
			snapshot?.createdAt?.toISOString() ??
			null,
		failureMessage: status === 'failed' ? stringifyJobError(job?.error) : null,
	};
}

function isAnalysisStale(analysis: WorkspaceAnalysis): boolean {
	const target = analysis.sourceTarget;
	if (!target || target.resolvedRefType === 'COMMIT') return false;
	return target.latestObservedCommitSha !== analysis.snapshot.commitSha;
}

function hasUnreviewedItems(analysis: WorkspaceAnalysis): boolean {
	return [...analysis.insights, ...analysis.traceabilityLinks].some(
		(item) => item.reviewStatus === 'NEEDS_REVIEW',
	);
}

function buildFinalizeBlockingReasons(
	analysis: WorkspaceAnalysis,
	stale: boolean,
): string[] {
	const reasons: string[] = [];

	if (analysis.status !== 'WAITING_FOR_REVIEW') {
		reasons.push('ANALYSIS_NOT_WAITING_FOR_REVIEW');
	}
	if (stale) {
		reasons.push('ANALYSIS_STALE');
	}

	const qualityProjection = buildEvidenceQualityProjection({
		traceabilityLinks: analysis.traceabilityLinks as any[],
		insights: analysis.insights as any[],
	});
	const gate = ReportApprovalGatePolicy.evaluate(buildReportApprovalGateItems({
		items: qualityProjection.items,
		insights: analysis.insights,
		traceabilityLinks: analysis.traceabilityLinks.map((link) => ({
			id: link.id,
			linkType: 'AFFECTED',
			linkBasis: link.linkBasis,
		})),
	}));
	if (!gate.canApprove) {
		reasons.push(...gate.blockingReasons);
	}

	return Array.from(new Set(reasons));
}

function buildExportBlockingReasons(
	status: AnalysisWorkspaceResponse['reportStatus']['status'],
	stale: boolean,
): string[] {
	const reasons: string[] = [];
	if (status === 'missing') reasons.push('REPORT_NOT_GENERATED');
	if (status === 'queued' || status === 'running') reasons.push('REPORT_GENERATION_IN_PROGRESS');
	if (status === 'failed') reasons.push('REPORT_GENERATION_FAILED');
	if (stale) reasons.push('REPORT_STALE');
	return reasons;
}

export function deriveReviewStatus(
	analysis: WorkspaceAnalysis,
): AnalysisWorkspaceResponse['overview']['status']['reviewStatus'] {
	const statuses = [
		...analysis.insights.map((item) => item.reviewStatus),
		...analysis.traceabilityLinks.map((item) => item.reviewStatus),
	];
	if (statuses.length === 0 || statuses.every((status) => status === 'NEEDS_REVIEW')) {
		return 'not_started';
	}
	return statuses.some((status) => status === 'NEEDS_REVIEW') ? 'in_progress' : 'complete';
}

export function isRiskInsight(insight: WorkspaceInsight): boolean {
	return insight.certainty === 'CONFLICTING' || normalizeMetadataKind(
		readMetadata(insight.metadata, 'kind'),
	) === 'risk';
}

export function deriveRiskSeverity(
	insight: WorkspaceInsight,
): AnalysisWorkspaceResponse['risks'][number]['severity'] {
	const severity = normalizeRiskSeverity(readMetadata(insight.metadata, 'severity'));
	return severity === 'low' || severity === 'medium' || severity === 'high'
		? severity
		: insight.certainty === 'CONFLICTING'
			? 'high'
			: 'medium';
}

function normalizeRiskSeverity(value: unknown): string | null {
	return typeof value === 'string' ? value.toLowerCase() : null;
}

export function toReviewDecision(
	status: string,
): AnalysisWorkspaceResponse['reviewQueue'][number]['currentDecision'] {
	if (status === 'CONFIRMED' || status === 'ACCEPTED') return 'accepted';
	if (status === 'REJECTED') return 'rejected';
	if (status === 'NEEDS_MORE_EVIDENCE') return 'needs_more_evidence';
	return 'needs_review';
}

export function toEvidenceBasis(
	basis: string,
): AnalysisWorkspaceResponse['impactGroups'][number]['artifacts'][number]['impactBasis'] {
	if (basis === 'EVIDENCED') return 'evidenced';
	if (basis === 'INFERRED') return 'inferred';
	return 'unknown';
}

export function normalizeUniversalKind(
	kind: string,
): AnalysisWorkspaceResponse['impactGroups'][number]['artifacts'][number]['universalKind'] {
	if (
		kind === 'API_ENDPOINT' ||
		kind === 'DOMAIN_SERVICE' ||
		kind === 'DATA_MODEL' ||
		kind === 'TEST_CASE'
	) {
		return kind;
	}
	return 'UNKNOWN';
}

export function detectRequirementLanguage(rawText: string, normalizedText: string) {
	const text = `${rawText} ${normalizedText}`;
	return /[ăâđêôơưáàạảãấầậẩẫắằặẳẵéèẹẻẽếềệểễíìịỉĩóòọỏõốồộổỗớờợởỡúùụủũứừựửữýỳỵỷỹ]/i.test(text)
		? 'vi'
		: text.trim()
			? 'en'
			: 'unknown';
}

export function buildDomainProfileId(profile: WorkspaceAnalysis['snapshot']['profile']) {
	if (!profile) return 'unknown';
	return `${profile.domain.toLowerCase()}@${profile.profileVersion}`;
}

export function buildWorkspaceDomainPack(
	analysis: Pick<
		WorkspaceAnalysis,
		| 'metadata'
		| 'resolvedDomainPackId'
		| 'resolvedDomainPackVersion'
		| 'resolvedDomainPackStatus'
		| 'domainPackSelectedBy'
	>,
): AnalysisWorkspaceResponse['overview']['requirement']['domainPack'] {
	return projectDomainPackSelection(analysis);
}

export function evidenceArtifactKeys(insight: WorkspaceInsight): string[] {
	const metadataKeys = [
		...readStringArrayMetadata(insight.metadata, 'resolvedRelatedArtifactKeys'),
		...readStringArrayMetadata(insight.metadata, 'relatedArtifactKeys'),
	];

	return Array.from(
		new Set(
			[
				...insight.evidenceLinks
					.map((link) => link.evidence.artifact?.artifactKey)
					.filter((key): key is string => Boolean(key)),
				...metadataKeys,
			],
		),
	);
}

export function parseQaSteps(description: string) {
	return {
		given: readStep(description, 'given') ?? 'The impacted workflow is available.',
		when: readStep(description, 'when') ?? description,
		then: readStep(description, 'then') ?? 'The expected behavior is verified.',
	};
}

export function readMetadata(metadata: unknown, key: string): unknown {
	if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
		return undefined;
	}
	return (metadata as Record<string, unknown>)[key];
}

export function reviewItemTypeForInsight(
	insight: WorkspaceInsight,
): AnalysisWorkspaceResponse['reviewQueue'][number]['itemType'] {
	if (isRiskInsight(insight)) return 'risk';
	if (insight.insightType === 'UNKNOWN') return 'unknown';
	if (insight.insightType === 'QA_SCENARIO') return 'qa_scenario';
	return 'evidence';
}

function normalizeMetadataKind(value: unknown): string | null {
	return typeof value === 'string' ? value.toLowerCase() : null;
}

function readStringArrayMetadata(metadata: unknown, key: string): string[] {
	const value = readMetadata(metadata, key);
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === 'string');
}

export function impactGroupTitle(
	group: AnalysisWorkspaceResponse['impactGroups'][number]['group'],
) {
	return {
		primary: 'Primary impact',
		secondary: 'Secondary impact',
		test: 'Tests',
		config: 'Data and configuration',
		unknown: 'Unknown classification',
	}[group];
}

export function impactGroupDescription(
	group: AnalysisWorkspaceResponse['impactGroups'][number]['group'],
) {
	return {
		primary: 'Entry points and primary workflow artifacts.',
		secondary: 'Supporting service and domain behavior artifacts.',
		test: 'Test artifacts related to the change.',
		config: 'Data model or configuration artifacts.',
		unknown: 'Artifacts without a normalized presentation group.',
	}[group];
}

export function pushMap(map: Map<string, string[]>, key: string, value: string) {
	map.set(key, [...(map.get(key) ?? []), value]);
}

export function uniqueCount(items: string[]) {
	return new Set(items).size;
}

function readStep(text: string, label: 'given' | 'when' | 'then') {
	const match = text.match(new RegExp(`${label}:\\s*([^\\n]+)`, 'i'));
	return match?.[1]?.trim();
}

function stringifyJobError(error: unknown) {
	if (!error) return null;
	if (typeof error === 'string') return error;
	if (typeof error === 'object' && 'message' in error) {
		return String((error as { message?: unknown }).message);
	}
	return 'Document generation failed.';
}
