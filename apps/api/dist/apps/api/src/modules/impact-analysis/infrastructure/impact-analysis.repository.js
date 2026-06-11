"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImpactAnalysisRepository = void 0;
class ImpactAnalysisRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findById(id) {
        return this.prisma.impactAnalysis.findUnique({
            where: { id },
            include: {
                snapshot: true,
                sourceTarget: true,
                requirementRevision: true,
                insights: true,
            },
        });
    }
    async findByComposite(params) {
        return this.prisma.impactAnalysis.findUnique({
            where: {
                requirementRevisionId_snapshotId_sourceTargetId_requestKey: {
                    requirementRevisionId: params.requirementRevisionId,
                    snapshotId: params.snapshotId,
                    sourceTargetId: params.sourceTargetId,
                    requestKey: params.requestKey,
                },
            },
            include: {
                snapshot: true,
                sourceTarget: true,
                requirementRevision: true,
            },
        });
    }
    async findByRequestKey(params) {
        return this.prisma.impactAnalysis.findFirst({
            where: {
                requirementRevisionId: params.requirementRevisionId,
                requestKey: params.requestKey,
            },
        });
    }
    async createQueued(params) {
        return this.prisma.impactAnalysis.create({
            data: {
                requirementRevisionId: params.requirementRevisionId,
                snapshotId: params.snapshotId,
                sourceTargetId: params.sourceTargetId,
                requestKey: params.requestKey,
                status: 'QUEUED',
                stage: 'WAITING',
                progress: 0,
                acceptedPartialCoverage: params.acceptedPartialCoverage,
                coverageWarning: params.coverageWarning ?? null,
            },
            include: {
                snapshot: true,
                sourceTarget: true,
                requirementRevision: true,
                insights: true,
            },
        });
    }
    async updateStatus(params) {
        return this.prisma.impactAnalysis.update({
            where: { id: params.id },
            data: {
                status: params.status,
                stage: params.stage,
                progress: params.progress,
            },
            include: {
                snapshot: true,
                sourceTarget: true,
                requirementRevision: true,
                insights: true,
            },
        });
    }
    async finalizeIfCurrent(params) {
        return this.prisma.impactAnalysis.updateMany({
            where: {
                id: params.analysisId,
                snapshot: {
                    commitSha: params.expectedCommitSha,
                },
                sourceTarget: {
                    resolvedRefType: params.expectedResolvedRefType,
                    latestObservedCommitSha: params.expectedTargetCommitSha,
                },
            },
            data: {
                status: params.status,
                stage: params.stage,
                progress: params.progress,
            },
        });
    }
}
exports.ImpactAnalysisRepository = ImpactAnalysisRepository;
