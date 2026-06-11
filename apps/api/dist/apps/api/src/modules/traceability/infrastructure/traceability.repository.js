"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TraceabilityRepository = void 0;
class TraceabilityRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listByAnalysis(impactAnalysisId) {
        return this.prisma.traceabilityLink.findMany({
            where: { impactAnalysisId },
            include: {
                evidenceLinks: { include: { evidence: true } },
            },
        });
    }
    async findById(linkId) {
        return this.prisma.traceabilityLink.findUnique({
            where: { id: linkId },
            include: {
                impactAnalysis: {
                    include: {
                        snapshot: true,
                        sourceTarget: true,
                    },
                },
            },
        });
    }
    async updateReviewStatus(params) {
        return this.prisma.traceabilityLink.update({
            where: { id: params.linkId },
            data: { reviewStatus: params.reviewStatus },
        });
    }
    async updateReviewStatusIfCurrent(params) {
        return this.prisma.traceabilityLink.updateMany({
            where: {
                id: params.linkId,
                impactAnalysis: {
                    snapshot: {
                        commitSha: params.expectedCommitSha,
                    },
                    sourceTarget: {
                        resolvedRefType: params.expectedResolvedRefType,
                        latestObservedCommitSha: params.expectedTargetCommitSha,
                    },
                },
            },
            data: { reviewStatus: params.reviewStatus },
        });
    }
    async upsertMany(items) {
        if (items.length === 0) {
            return [];
        }
        await this.prisma.traceabilityLink.createMany({
            data: items.map((item) => ({
                impactAnalysisId: item.impactAnalysisId,
                artifactId: item.artifactId,
                linkType: item.linkType,
                linkBasis: item.linkBasis,
                reviewStatus: item.reviewStatus,
                confidence: item.confidence,
            })),
            skipDuplicates: true,
        });
        return this.prisma.traceabilityLink.findMany({
            where: {
                impactAnalysisId: items[0].impactAnalysisId,
                artifactId: { in: items.map((item) => item.artifactId) },
                linkType: { in: items.map((item) => item.linkType) },
            },
        });
    }
    async linkEvidence(params) {
        if (params.evidenceIds.length === 0) {
            return [];
        }
        await this.prisma.traceabilityEvidence.createMany({
            data: params.evidenceIds.map((evidenceId) => ({
                traceabilityLinkId: params.linkId,
                evidenceId,
            })),
            skipDuplicates: true,
        });
        return this.prisma.traceabilityEvidence.findMany({
            where: { traceabilityLinkId: params.linkId },
        });
    }
}
exports.TraceabilityRepository = TraceabilityRepository;
