"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListInsightsUseCase = void 0;
class ListInsightsUseCase {
    constructor(repository) {
        this.repository = repository;
    }
    async execute(impactAnalysisId) {
        return this.repository.listByAnalysis(impactAnalysisId);
    }
}
exports.ListInsightsUseCase = ListInsightsUseCase;
