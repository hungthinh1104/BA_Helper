import {
	impactAnalysisDiffResponseSchema,
	type ImpactAnalysisDiffResponse,
} from './src';

describe('impactAnalysisDiffResponseSchema', () => {
	it('accepts lineage clarification IDs in the comparison context', () => {
		const payload: ImpactAnalysisDiffResponse = {
			baseAnalysisId: '00000000-0000-4000-8000-000000000001',
			currentAnalysisId: '00000000-0000-4000-8000-000000000002',
			comparisonContext: {
				requirementChanged: true,
				snapshotChanged: true,
				baseRequirementRevisionId: '00000000-0000-4000-8000-000000000003',
				currentRequirementRevisionId: '00000000-0000-4000-8000-000000000004',
				baseSnapshotId: '00000000-0000-4000-8000-000000000005',
				currentSnapshotId: '00000000-0000-4000-8000-000000000006',
				baseCommitSha: 'base-commit',
				currentCommitSha: 'current-commit',
				sourceClarificationId: '00000000-0000-4000-8000-000000000007',
				reviewClarificationRequestId:
					'00000000-0000-4000-8000-000000000008',
			},
			summary: {
				addedImpacts: 0,
				removedImpacts: 0,
				unchangedImpacts: 0,
				resolvedUnknowns: 0,
				removedUnknowns: 0,
				newUnknowns: 0,
				addedQaScenarios: 0,
			},
			addedArtifacts: [],
			removedArtifacts: [],
			unchangedArtifacts: [],
			resolvedUnknowns: [],
			removedUnknowns: [],
			newUnknowns: [],
			addedQaScenarios: [],
		};

		expect(impactAnalysisDiffResponseSchema.parse(payload)).toEqual(payload);
	});
});
