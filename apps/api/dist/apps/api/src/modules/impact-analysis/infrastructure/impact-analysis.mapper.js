"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapImpactAnalysisResponse = void 0;
const mapImpactAnalysisResponse = (params) => {
    const { analysis } = params;
    const isPinnedCommit = analysis.sourceTarget.resolvedRefType === 'COMMIT';
    const isStale = !isPinnedCommit &&
        analysis.sourceTarget.latestObservedCommitSha !==
            analysis.snapshot.commitSha;
    return {
        id: analysis.id,
        sourceTarget: {
            id: analysis.sourceTarget.id,
            requestedRef: analysis.sourceTarget.requestedRef,
            resolvedRefType: analysis.sourceTarget.resolvedRefType,
            latestObservedCommitSha: analysis.sourceTarget.latestObservedCommitSha,
        },
        snapshot: {
            id: analysis.snapshot.id,
            repositoryId: analysis.snapshot.repositoryId,
            commitSha: analysis.snapshot.commitSha,
            analyzerVersion: analysis.snapshot.analyzerVersion,
            coverageStatus: analysis.snapshot.coverageStatus,
        },
        freshness: {
            isStale,
            isAnalyzerOutdated: false,
            basis: isPinnedCommit ? 'PINNED_COMMIT' : 'LATEST_OBSERVED_SOURCE_TARGET',
        },
        requirement: {
            id: analysis.requirementRevision.requirementId,
            revisionId: analysis.requirementRevision.id,
            revisionTitle: analysis.requirementRevision.title,
            rawText: analysis.requirementRevision.rawText,
        },
        status: analysis.status,
        stage: analysis.stage,
        progress: analysis.progress,
        coverageWarning: analysis.coverageWarning,
        capabilities: {
            canReview: analysis.status === 'WAITING_FOR_REVIEW' && !isStale,
            canFinalize: analysis.status === 'WAITING_FOR_REVIEW' && !isStale,
            canExport: analysis.status === 'COMPLETED' && !isStale,
            canRerun: analysis.status === 'FAILED' ||
                analysis.status === 'CANCELLED' ||
                analysis.status === 'COMPLETED' ||
                isStale,
            canCancel: analysis.status === 'QUEUED' || analysis.status === 'RUNNING',
        },
    };
};
exports.mapImpactAnalysisResponse = mapImpactAnalysisResponse;
