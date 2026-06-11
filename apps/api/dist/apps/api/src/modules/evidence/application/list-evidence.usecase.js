"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListEvidenceUseCase = void 0;
const app_error_1 = require("../../../shared/app-error");
class ListEvidenceUseCase {
    constructor(repository, prisma) {
        this.repository = repository;
        this.prisma = prisma;
    }
    async execute(impactAnalysisId) {
        const analysis = await this.prisma.impactAnalysis.findUnique({
            where: { id: impactAnalysisId },
            include: { snapshot: true, requirementRevision: true },
        });
        if (!analysis) {
            throw new app_error_1.AppError('IMPACT_ANALYSIS_NOT_FOUND', 'Impact analysis not found.');
        }
        return this.repository.listByAnalysis({
            snapshotId: analysis.snapshot.id,
            revisionId: analysis.requirementRevision.id,
        });
    }
}
exports.ListEvidenceUseCase = ListEvidenceUseCase;
