"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetImpactAnalysisUseCase = void 0;
const app_error_1 = require("../../../shared/app-error");
class GetImpactAnalysisUseCase {
    constructor(repository) {
        this.repository = repository;
    }
    async execute(id) {
        const analysis = await this.repository.findById(id);
        if (!analysis) {
            throw new app_error_1.AppError('IMPACT_ANALYSIS_NOT_FOUND', 'Impact analysis not found.');
        }
        return analysis;
    }
}
exports.GetImpactAnalysisUseCase = GetImpactAnalysisUseCase;
