"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateImpactAnalysisUseCase = void 0;
const app_error_1 = require("../../../shared/app-error");
const impact_analysis_policy_1 = require("../domain/impact-analysis.policy");
class CreateImpactAnalysisUseCase {
    constructor(impactRepo, requirementRepo, prisma, eventLog, queue) {
        this.impactRepo = impactRepo;
        this.requirementRepo = requirementRepo;
        this.prisma = prisma;
        this.eventLog = eventLog;
        this.queue = queue;
    }
    async execute(params) {
        const revision = await this.requirementRepo.findRevisionById(params.requirementRevisionId);
        if (!revision) {
            throw new app_error_1.AppError('REQUIREMENT_REVISION_NOT_FOUND', 'Requirement revision not found.');
        }
        if (revision.readinessStatus !== 'READY_FOR_ANALYSIS') {
            throw new app_error_1.AppError('REQUIREMENT_REVISION_NOT_READY', 'Requirement revision is not ready for analysis.');
        }
        const snapshot = await this.prisma.repositorySnapshot.findUnique({
            where: { id: params.snapshotId },
        });
        if (!snapshot) {
            throw new app_error_1.AppError('SNAPSHOT_NOT_FOUND', 'Snapshot not found.');
        }
        const sourceTarget = await this.prisma.repositoryTarget.findUnique({
            where: { id: params.sourceTargetId },
        });
        if (!sourceTarget) {
            throw new app_error_1.AppError('SOURCE_TARGET_NOT_FOUND', 'Source target not found.');
        }
        if (sourceTarget.repositoryId !== snapshot.repositoryId) {
            throw new app_error_1.AppError('SOURCE_TARGET_NOT_FOUND', 'Source target does not match snapshot repository.');
        }
        if (sourceTarget.resolvedRefType !== 'COMMIT' &&
            sourceTarget.latestObservedCommitSha !== snapshot.commitSha) {
            throw new app_error_1.AppError('ANALYSIS_STALE', 'Snapshot is stale for source target.');
        }
        if (!impact_analysis_policy_1.ImpactAnalysisPolicy.canAnalyzeSnapshot({
            coverageStatus: snapshot.coverageStatus,
            allowPartialSnapshot: params.allowPartialSnapshot,
        })) {
            throw new app_error_1.AppError('SNAPSHOT_PARTIAL_NOT_ALLOWED', 'Partial snapshot requires explicit acceptance.');
        }
        const existingByRequestKey = await this.impactRepo.findByRequestKey({
            requirementRevisionId: params.requirementRevisionId,
            requestKey: params.requestKey,
        });
        if (existingByRequestKey &&
            (existingByRequestKey.snapshotId !== params.snapshotId ||
                existingByRequestKey.sourceTargetId !== params.sourceTargetId)) {
            throw new app_error_1.AppError('REQUEST_KEY_MISMATCH', 'Request key reuse with different payload.');
        }
        const existing = await this.impactRepo.findByComposite(params);
        if (existing) {
            return existing;
        }
        const coverageWarning = snapshot.coverageStatus === 'PARTIAL' && params.allowPartialSnapshot
            ? 'Partial snapshot accepted; coverage may be incomplete.'
            : null;
        const analysis = await this.impactRepo.createQueued({
            requirementRevisionId: params.requirementRevisionId,
            snapshotId: params.snapshotId,
            sourceTargetId: params.sourceTargetId,
            requestKey: params.requestKey,
            acceptedPartialCoverage: snapshot.coverageStatus === 'PARTIAL' && params.allowPartialSnapshot,
            coverageWarning,
        });
        await this.eventLog.recordEvent({
            eventType: 'IMPACT_ANALYSIS_QUEUED',
            idempotencyKey: `impact:${analysis.id}:queued`,
            payload: {
                impactAnalysisId: analysis.id,
                requirementRevisionId: analysis.requirementRevisionId,
                snapshotId: analysis.snapshotId,
            },
        });
        await this.queue.enqueueImpactAnalysis(analysis.id);
        return analysis;
    }
}
exports.CreateImpactAnalysisUseCase = CreateImpactAnalysisUseCase;
