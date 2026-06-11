"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListDocumentsUseCase = void 0;
class ListDocumentsUseCase {
    constructor(repository) {
        this.repository = repository;
    }
    async execute(impactAnalysisId) {
        return this.repository.listByAnalysis(impactAnalysisId);
    }
}
exports.ListDocumentsUseCase = ListDocumentsUseCase;
