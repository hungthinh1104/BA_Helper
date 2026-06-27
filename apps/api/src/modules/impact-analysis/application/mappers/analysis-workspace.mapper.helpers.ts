import type { AnalysisWorkspaceResponse } from '@ba-helper/contracts';
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
		return reportCard(latestJob.status.toLowerCase() as 'queued' | 'running', latestJob, latestSnapshot);
	}

	if (generatedDocument?.status === 'APPROVED' || latestJob?.status === 'COMPLETED') {
		return reportCard('completed', latestJob, latestSnapshot);
	}

	if (latestJob?.status === 'FAILED') {
		return reportCard('failed', latestJob, latestSnapshot);
	}

	return reportCard('missing', latestJob, latestSnapshot);
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
	status: AnalysisWorkspaceResponse['reportStatus']['status'],
	job: WorkspaceDocumentJob | null,
	snapshot: WorkspaceReviewedReportSnapshot | null,
): AnalysisWorkspaceResponse['reportStatus'] {
	const document = job?.generatedDocument ?? snapshot?.approvedDocument ?? null;
	return {
		status,
		generatedDocumentId: document?.id ?? job?.generatedDocumentId ?? null,
		documentJobId: job?.id ?? null,
		reviewedReportSnapshotId: snapshot?.id ?? null,
		canExport: status === 'completed',
		lastGeneratedAt:
			job?.completedAt?.toISOString() ??
			document?.updatedAt?.toISOString() ??
			snapshot?.createdAt?.toISOString() ??
			null,
		failureMessage: status === 'failed' ? stringifyJobError(job?.error) : null,
	};
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
	return insight.certainty === 'CONFLICTING' || readMetadata(insight.metadata, 'kind') === 'risk';
}

export function deriveRiskSeverity(
	insight: WorkspaceInsight,
): AnalysisWorkspaceResponse['risks'][number]['severity'] {
	const severity = readMetadata(insight.metadata, 'severity');
	return severity === 'low' || severity === 'medium' || severity === 'high'
		? severity
		: insight.certainty === 'CONFLICTING'
			? 'high'
			: 'medium';
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
	metadata: WorkspaceAnalysis['metadata'],
): AnalysisWorkspaceResponse['overview']['requirement']['domainPack'] {
	const domainPack = readMetadata(metadata, 'domainPack');
	if (!domainPack || typeof domainPack !== 'object' || Array.isArray(domainPack)) {
		return null;
	}

	const data = domainPack as Record<string, unknown>;
	const selectedBy = normalizeDomainPackSelectedBy(data.selectedBy);
	if (
		typeof data.id !== 'string' ||
		typeof data.version !== 'string' ||
		!isDomainPackStatus(data.status) ||
		!selectedBy
	) {
		return null;
	}

	return {
		id: data.id,
		version: data.version,
		status: data.status,
		selectedBy,
	};
}

export function evidenceArtifactKeys(insight: WorkspaceInsight): string[] {
	return Array.from(
		new Set(
			insight.evidenceLinks
				.map((link) => link.evidence.artifact?.artifactKey)
				.filter((key): key is string => Boolean(key)),
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
	if (insight.insightType === 'UNKNOWN') return 'unknown';
	if (insight.insightType === 'QA_SCENARIO') return 'qa_scenario';
	if (isRiskInsight(insight)) return 'risk';
	return 'evidence';
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

function isDomainPackStatus(
	value: unknown,
): value is NonNullable<AnalysisWorkspaceResponse['overview']['requirement']['domainPack']>['status'] {
	return (
		value === 'STABLE' ||
		value === 'PARTIAL' ||
		value === 'EXPERIMENTAL' ||
		value === 'FALLBACK'
	);
}

function isDomainPackSelectedBy(
	value: unknown,
): value is NonNullable<AnalysisWorkspaceResponse['overview']['requirement']['domainPack']>['selectedBy'] {
	return (
		value === 'EXPLICIT' ||
		value === 'REPOSITORY_PROFILE' ||
		value === 'FALLBACK'
	);
}

function normalizeDomainPackSelectedBy(
	value: unknown,
): NonNullable<AnalysisWorkspaceResponse['overview']['requirement']['domainPack']>['selectedBy'] | null {
	if (isDomainPackSelectedBy(value)) return value;
	if (value === 'manual_config') return 'EXPLICIT';
	if (value === 'repository_profile') return 'REPOSITORY_PROFILE';
	if (value === 'safe_default') return 'FALLBACK';
	return null;
}
