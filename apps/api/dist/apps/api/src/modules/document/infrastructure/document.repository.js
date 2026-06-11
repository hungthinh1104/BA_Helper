"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentRepository = void 0;
class DocumentRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listByAnalysis(impactAnalysisId) {
        return this.prisma.generatedDocument.findMany({
            where: { impactAnalysisId },
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
    async upsertApproved(params) {
        return this.prisma.generatedDocument.upsert({
            where: {
                impactAnalysisId_type_status: {
                    impactAnalysisId: params.impactAnalysisId,
                    type: 'IMPACT_REPORT',
                    status: 'APPROVED',
                },
            },
            update: {
                content: params.content,
            },
            create: {
                impactAnalysisId: params.impactAnalysisId,
                type: 'IMPACT_REPORT',
                status: 'APPROVED',
                content: params.content,
            },
        });
    }
}
exports.DocumentRepository = DocumentRepository;
