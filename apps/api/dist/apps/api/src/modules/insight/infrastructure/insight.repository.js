"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsightRepository = void 0;
class InsightRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listByAnalysis(impactAnalysisId) {
        return this.prisma.baInsight.findMany({
            where: { impactAnalysisId },
            include: {
                evidenceLinks: {
                    include: { evidence: true },
                },
            },
        });
    }
    async findById(insightId) {
        return this.prisma.baInsight.findUnique({
            where: { id: insightId },
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
        return this.prisma.baInsight.update({
            where: { id: params.insightId },
            data: { reviewStatus: params.reviewStatus },
        });
    }
    async updateReviewStatusIfCurrent(params) {
        return this.prisma.baInsight.updateMany({
            where: {
                id: params.insightId,
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
        await this.prisma.baInsight.createMany({
            data: items.map((item) => ({
                impactAnalysisId: item.impactAnalysisId,
                insightKey: item.insightKey,
                insightType: item.insightType,
                certainty: item.certainty,
                reviewStatus: item.reviewStatus,
                confidence: item.confidence,
                title: item.title,
                description: item.description,
                reasoning: item.reasoning ?? null,
            })),
            skipDuplicates: true,
        });
        return this.prisma.baInsight.findMany({
            where: {
                impactAnalysisId: items[0].impactAnalysisId,
                insightKey: { in: items.map((item) => item.insightKey) },
            },
        });
    }
    async linkEvidence(params) {
        if (params.evidenceIds.length === 0) {
            return [];
        }
        await this.prisma.insightEvidence.createMany({
            data: params.evidenceIds.map((evidenceId) => ({
                insightId: params.insightId,
                evidenceId,
            })),
            skipDuplicates: true,
        });
        return this.prisma.insightEvidence.findMany({
            where: { insightId: params.insightId },
        });
    }
}
exports.InsightRepository = InsightRepository;
