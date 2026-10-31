import { z } from 'zod';

const qualityCounterAliases: Record<string, readonly string[]> = {
	STRONG_SOURCE_EVIDENCE: ['strongSourceEvidence', 'STRONG_SOURCE_EVIDENCE', 'evidenced'],
	WEAK_SOURCE_EVIDENCE: ['weakSourceEvidence', 'WEAK_SOURCE_EVIDENCE', 'weakEvidence'],
	INFERRED_FROM_STRUCTURE: ['inferredFromStructure', 'INFERRED_FROM_STRUCTURE', 'inferred'],
	DOMAIN_HINT_ONLY: ['domainHintOnly', 'DOMAIN_HINT_ONLY'],
	MISSING_EVIDENCE: ['missingEvidence', 'MISSING_EVIDENCE'],
	CONFLICTING_EVIDENCE: ['conflictingEvidence', 'CONFLICTING_EVIDENCE'],
	REVIEW_REQUIRED: ['reviewRequired', 'REVIEW_REQUIRED'],
	DERIVED_ARTIFACT: ['derivedArtifact', 'DERIVED_ARTIFACT'],
};

const legacyQualityLabels: Record<string, string> = {
	EVIDENCED: 'STRONG_SOURCE_EVIDENCE',
	INFERRED: 'INFERRED_FROM_STRUCTURE',
	WEAK_EVIDENCE: 'WEAK_SOURCE_EVIDENCE',
};

export function validateEvidenceQualitySnapshotConsistency<TSummary extends object>(
	value: {
		reviewDecisionsSnapshot: Array<{ quality: string }>;
		evidenceQualitySummarySnapshot: TSummary;
	},
	context: z.RefinementCtx,
) {
	const itemCounts: Record<string, number> = {};
	for (const item of value.reviewDecisionsSnapshot) {
		const quality = legacyQualityLabels[item.quality] ?? item.quality;
		itemCounts[quality] = (itemCounts[quality] ?? 0) + 1;
	}

	const summary = value.evidenceQualitySummarySnapshot as Record<string, unknown>;
	for (const [quality, aliases] of Object.entries(qualityCounterAliases)) {
		const itemCount = itemCounts[quality] ?? 0;
		const presentCounters = aliases.filter((alias) => typeof summary[alias] === 'number');
		if (itemCount > 0 && presentCounters.length === 0) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['evidenceQualitySummarySnapshot'],
				message: `Missing ${quality} count for frozen evidence-quality items`,
			});
		}
		for (const alias of presentCounters) {
			if (summary[alias] !== itemCount) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['evidenceQualitySummarySnapshot', alias],
					message: `Counter does not match frozen ${quality} item count`,
				});
			}
		}
	}
}
