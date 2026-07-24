import type { AnalysisWorkspaceResponse } from '@ba-helper/contracts';

export type WorkspaceAnalysis = {
	id: string;
	status: string;
	progress: number;
	metadata?: unknown;
	requestedDomainPackId?: string | null;
	resolvedDomainPackId?: string | null;
	resolvedDomainPackVersion?: string | null;
	resolvedDomainPackStatus?: string | null;
	domainPackSelectedBy?: string | null;
	requirementRevision: {
		id: string;
		title: string;
		rawText: string;
		normalizedText: string;
	};
	snapshot: {
		id: string;
		repositoryId: string;
		commitSha: string;
		analyzerVersion: string;
		profile?: {
			domain: string;
			profileVersion: string;
		} | null;
	};
	sourceTarget: {
		id: string;
		resolvedRefType: string;
		latestObservedCommitSha: string;
	} | null;
	insights: WorkspaceInsight[];
	traceabilityLinks: WorkspaceTraceabilityLink[];
	documentJobs: WorkspaceDocumentJob[];
	reviewedReportSnapshots: WorkspaceReviewedReportSnapshot[];
};

export type WorkspaceInsight = {
	id: string;
	insightKey: string;
	insightType: string;
	certainty: string;
	reviewStatus: string;
	title: string;
	description: string;
	reasoning: string | null;
	metadata: unknown;
	evidenceLinks: Array<{
		evidenceId: string;
		evidence: WorkspaceEvidence;
	}>;
};

export type WorkspaceTraceabilityLink = {
	id: string;
	linkBasis: string;
	confidence?: number | null;
	reviewStatus: string;
	artifact: {
		id: string;
		artifactKey: string;
		name: string;
		filePath: string;
		universalKind: string;
	};
	evidenceLinks: Array<{
		evidenceId: string;
		evidence: WorkspaceEvidence;
	}>;
	reviewDecision?: {
		decision: string;
	} | null;
};

export type WorkspaceEvidence = {
	id: string;
	sourceType: string;
	sourcePath: string | null;
	startLine: number | null;
	endLine: number | null;
	excerpt: string;
	artifactId: string | null;
	artifact?: {
		artifactKey: string;
	} | null;
};

export type WorkspaceDocumentJob = {
	id: string;
	status: string;
	error: unknown;
	generatedDocumentId: string | null;
	completedAt: Date | null;
	updatedAt: Date;
	generatedDocument?: {
		id: string;
		status: string;
		updatedAt: Date;
	} | null;
};

export type WorkspaceReviewedReportSnapshot = {
	id: string;
	approvedDocumentId: string | null;
	createdAt: Date;
	approvedDocument?: {
		id: string;
		status: string;
		updatedAt: Date;
	} | null;
};

export const KIND_GROUPS: Record<
	string,
	AnalysisWorkspaceResponse['impactGroups'][number]['group']
> = {
	API_ENDPOINT: 'primary',
	DOMAIN_SERVICE: 'secondary',
	DATA_MODEL: 'config',
	TEST_CASE: 'test',
	UNKNOWN: 'unknown',
};
