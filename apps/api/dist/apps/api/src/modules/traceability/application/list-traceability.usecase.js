"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListTraceabilityUseCase = void 0;
class ListTraceabilityUseCase {
    constructor(repository) {
        this.repository = repository;
    }
    async execute(impactAnalysisId) {
        return this.repository.listByAnalysis(impactAnalysisId);
    }
}
exports.ListTraceabilityUseCase = ListTraceabilityUseCase;
