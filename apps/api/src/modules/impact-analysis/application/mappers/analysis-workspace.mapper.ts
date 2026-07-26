import type {
	AnalysisWorkspaceResponse} from '@ba-helper/contracts';
import {
	analysisWorkspaceResponseSchema,
} from '@ba-helper/contracts';
import type {
	WorkspaceAnalysis,
	WorkspaceEvidence,
	WorkspaceInsight,
	WorkspaceTraceabilityLink} from './analysis-workspace.mapper.types';
import {
	KIND_GROUPS
} from './analysis-workspace.mapper.types';
import {
	buildDomainProfileId,
	buildWorkspaceDomainPack,
	buildDriftStatus,
	buildReportStatus,
	buildReviewApprovalGate,
	buildReviewSummary,
	deriveReviewStatus,
	deriveRiskSeverity,
	detectRequirementLanguage,
	evidenceArtifactKeys,
	impactGroupDescription,
	impactGroupTitle,
	isRiskInsight,
	normalizeUniversalKind,
	parseQaSteps,
	pushMap,
	readMetadata,
	reviewItemTypeForInsight,
	toEvidenceBasis,
	toReviewActions,
	toReviewDecision,
	uniqueCount,
} from './analysis-workspace.mapper.helpers';

export function mapAnalysisWorkspace(
	analysis: WorkspaceAnalysis,
): AnalysisWorkspaceResponse {
	const evidenceCards = buildEvidenceCards(analysis);
	const risks = analysis.insights.filter(isRiskInsight).map(mapRisk);
	const unknowns = analysis.insights
		.filter((insight) => insight.insightType === 'UNKNOWN' && !isRiskInsight(insight))
		.map(mapUnknown);
	const qaScenarios = analysis.insights
		.filter((insight) => insight.insightType === 'QA_SCENARIO')
		.map(mapQaScenario);
	const reviewQueue = buildReviewQueue(analysis);
	const reviewSummary = buildReviewSummary(reviewQueue);
	const reportStatus = buildReportStatus(analysis);
	const driftStatus = buildDriftStatus(analysis);

	const response: AnalysisWorkspaceResponse = {
		overview: {
			analysisId: analysis.id,
			requirement: {
				revisionId: analysis.requirementRevision.id,
				title: analysis.requirementRevision.title,
				summary: analysis.requirementRevision.normalizedText,
				language: detectRequirementLanguage(
					analysis.requirementRevision.rawText,
					analysis.requirementRevision.normalizedText,
					),
					domainProfileId: buildDomainProfileId(analysis.snapshot.profile),
					domainPack: buildWorkspaceDomainPack(analysis),
				},
			snapshot: {
				snapshotId: analysis.snapshot.id,
				repositoryId: analysis.snapshot.repositoryId,
				commitSha: analysis.snapshot.commitSha,
				analyzerVersion: analysis.snapshot.analyzerVersion,
				profileVersion: analysis.snapshot.profile?.profileVersion,
				repositoryUrl: analysis.snapshot.repository?.canonicalUrl ?? null,
			},
			status: {
				analysisStatus: analysis.status as AnalysisWorkspaceResponse['overview']['status']['analysisStatus'],
				reviewStatus: deriveReviewStatus(analysis),
				snapshotStatus: 'locked',
				reportStatus: reportStatus.status,
				driftStatus: driftStatus.status,
			},
			counts: {
				impactedArtifacts: uniqueCount(
					analysis.traceabilityLinks.map((link) => link.artifact.artifactKey),
				),
				evidenceItems: evidenceCards.length,
				risks: risks.length,
				unknowns: unknowns.length,
				qaScenarios: qaScenarios.length,
				pendingReviewItems: reviewSummary.pending,
			},
		},
		impactGroups: buildImpactGroups(analysis.traceabilityLinks),
		evidenceCards,
		risks,
		unknowns,
		qaScenarios,
		reviewQueue,
		reviewSummary,
		reportStatus,
		driftStatus,
	};

	return analysisWorkspaceResponseSchema.parse(response);
}

function buildImpactGroups(
	links: WorkspaceTraceabilityLink[],
): AnalysisWorkspaceResponse['impactGroups'] {
	const grouped = new Map<
		AnalysisWorkspaceResponse['impactGroups'][number]['group'],
		AnalysisWorkspaceResponse['impactGroups'][number]['artifacts']
	>();

	for (const link of links) {
		const group = KIND_GROUPS[link.artifact.universalKind] ?? 'unknown';
		const artifacts = grouped.get(group) ?? [];
		artifacts.push({
			artifactId: link.artifact.id,
			artifactKey: link.artifact.artifactKey,
			name: link.artifact.name,
			filePath: link.artifact.filePath,
			universalKind: normalizeUniversalKind(link.artifact.universalKind),
			impactBasis: toEvidenceBasis(link.linkBasis),
			impactReason: `Traceability link ${link.id} is ${link.linkBasis.toLowerCase()}.`,
			confidence: link.confidence ?? undefined,
			traceabilityLinkIds: [link.id],
			evidenceIds: link.evidenceLinks.map((item) => item.evidenceId),
			reviewDecision: toReviewDecision(
				link.reviewDecision?.decision ?? link.reviewStatus,
			),
		});
		grouped.set(group, artifacts);
	}

	return Array.from(grouped.entries()).map(([group, artifacts]) => ({
		group,
		title: impactGroupTitle(group),
		description: impactGroupDescription(group),
		artifacts,
	}));
}

function buildEvidenceCards(
	analysis: WorkspaceAnalysis,
): AnalysisWorkspaceResponse['evidenceCards'] {
	const insightLinks = new Map<string, string[]>();
	const traceabilityLinks = new Map<string, string[]>();
	const evidence = new Map<string, WorkspaceEvidence>();

	for (const insight of analysis.insights) {
		for (const link of insight.evidenceLinks) {
			evidence.set(link.evidenceId, link.evidence);
			pushMap(insightLinks, link.evidenceId, insight.id);
		}
	}

	for (const traceability of analysis.traceabilityLinks) {
		for (const link of traceability.evidenceLinks) {
			evidence.set(link.evidenceId, link.evidence);
			pushMap(traceabilityLinks, link.evidenceId, traceability.id);
		}
	}

	return Array.from(evidence.values()).map((item) => ({
		evidenceId: item.id,
		sourceType: item.sourceType.toLowerCase() as AnalysisWorkspaceResponse['evidenceCards'][number]['sourceType'],
		filePath: item.sourcePath,
		lineRange: {
			startLine: item.startLine,
			endLine: item.endLine,
		},
		excerpt: item.excerpt,
		relevanceReason: 'Linked to analysis insight or traceability evidence.',
		artifactId: item.artifactId,
		artifactKey: item.artifact?.artifactKey ?? null,
		linkedInsightIds: insightLinks.get(item.id) ?? [],
		linkedTraceabilityLinkIds: traceabilityLinks.get(item.id) ?? [],
	}));
}

function mapRisk(
	insight: WorkspaceInsight,
): AnalysisWorkspaceResponse['risks'][number] {
	return {
		riskId: insight.insightKey,
		sourceInsightId: insight.id,
		title: insight.title,
		severity: deriveRiskSeverity(insight),
		category: String(readMetadata(insight.metadata, 'category') ?? insight.insightType),
		whyItMatters: insight.reasoning ?? insight.description,
		relatedArtifactKeys: evidenceArtifactKeys(insight),
		relatedEvidenceIds: insight.evidenceLinks.map((link) => link.evidenceId),
		relatedUnknownIds: [],
		reviewDecision: toReviewDecision(insight.reviewStatus),
	};
}

function mapUnknown(
	insight: WorkspaceInsight,
): AnalysisWorkspaceResponse['unknowns'][number] {
	return {
		unknownId: insight.insightKey,
		sourceInsightId: insight.id,
		title: insight.title,
		question: insight.description,
		whyItMatters: insight.reasoning ?? insight.description,
		relatedArtifactKeys: evidenceArtifactKeys(insight),
		relatedEvidenceIds: insight.evidenceLinks.map((link) => link.evidenceId),
		reviewDecision: toReviewDecision(insight.reviewStatus),
	};
}

function mapQaScenario(
	insight: WorkspaceInsight,
): AnalysisWorkspaceResponse['qaScenarios'][number] {
	const steps = parseQaSteps(insight.description);
	return {
		scenarioId: insight.insightKey,
		sourceInsightId: insight.id,
		title: insight.title,
		given: steps.given,
		when: steps.when,
		then: steps.then,
		regressionTarget: insight.reasoning ?? insight.title,
		relatedRiskIds: [],
		relatedUnknownIds: [],
		relatedArtifactKeys: evidenceArtifactKeys(insight),
		relatedEvidenceIds: insight.evidenceLinks.map((link) => link.evidenceId),
		reviewDecision: toReviewDecision(insight.reviewStatus),
	};
}

/**
 * Projects the full decision lifecycle for every reviewable item — insights and
 * traceability links alike, regardless of their current decision. Reviewed and
 * needs-more-evidence items stay in the queue so the review UI can show progress,
 * keep resolved decisions visible, and never lose a needs-more-evidence item.
 * `blockingFinalize` and `isConflicting` are projected from the single backend
 * evidence-quality/approval-gate evaluation rather than hardcoded.
 */
function buildReviewQueue(
	analysis: WorkspaceAnalysis,
): AnalysisWorkspaceResponse['reviewQueue'] {
	const gate = buildReviewApprovalGate(analysis);
	const artifactBasisByKey = new Map(
		analysis.traceabilityLinks.map(
			(link) => [link.artifact.artifactKey, toEvidenceBasis(link.linkBasis)] as const,
		),
	);
	const firstArtifactBasis = (keys: string[]) =>
		keys.map((key) => artifactBasisByKey.get(key)).find((basis) => basis !== undefined) ?? null;

	const insightItems = analysis.insights.map((insight) => {
		const itemType = reviewItemTypeForInsight(insight);
		const linkedArtifactKeys = evidenceArtifactKeys(insight);
		return {
			itemId: insight.id,
			itemType,
			title: insight.title,
			currentDecision: toReviewDecision(insight.reviewStatus),
			evidenceCount: insight.evidenceLinks.length,
			linkedArtifactKeys,
			linkedEvidenceIds: insight.evidenceLinks.map((link) => link.evidenceId),
			blockingFinalize: gate.blockingItemIds.has(insight.id),
			impactBasis: firstArtifactBasis(linkedArtifactKeys),
			isConflicting: gate.qualityByItemId.get(insight.id) === 'CONFLICTING_EVIDENCE',
			allowedActions: toReviewActions(itemType),
			reviewNote: insight.reviewNote?.body ?? null,
			reviewedAt: insight.reviewNote?.updatedAt?.toISOString() ?? null,
			reviewedByUserId: null,
		};
	});

	const linkItems = analysis.traceabilityLinks.map((link) => ({
		itemId: link.id,
		itemType: 'impact' as const,
		title: `Review impact link: ${link.artifact.name}`,
		currentDecision: toReviewDecision(link.reviewDecision?.decision ?? link.reviewStatus),
		evidenceCount: link.evidenceLinks.length,
		linkedArtifactKeys: [link.artifact.artifactKey],
		linkedEvidenceIds: link.evidenceLinks.map((item) => item.evidenceId),
		blockingFinalize: gate.blockingItemIds.has(link.id),
		impactBasis: toEvidenceBasis(link.linkBasis),
		isConflicting: gate.qualityByItemId.get(link.id) === 'CONFLICTING_EVIDENCE',
		allowedActions: toReviewActions('impact'),
		reviewNote: link.reviewDecision?.note ?? null,
		reviewedAt: link.reviewDecision?.reviewedAt?.toISOString() ?? null,
		reviewedByUserId: link.reviewDecision?.reviewedByUserId ?? null,
	}));

	return [...insightItems, ...linkItems];
}
