"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImpactAnalysisController = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("../../../../../../packages/contracts/src/index.ts");
const create_impact_analysis_usecase_1 = require("../application/create-impact-analysis.usecase");
const get_impact_analysis_usecase_1 = require("../application/get-impact-analysis.usecase");
const finalize_impact_analysis_usecase_1 = require("../application/finalize-impact-analysis.usecase");
const impact_analysis_mapper_1 = require("../infrastructure/impact-analysis.mapper");
let ImpactAnalysisController = class ImpactAnalysisController {
    constructor(createAnalysis, getAnalysis, finalizeAnalysis) {
        this.createAnalysis = createAnalysis;
        this.getAnalysis = getAnalysis;
        this.finalizeAnalysis = finalizeAnalysis;
    }
    async create(revisionId, body) {
        const input = contracts_1.impactAnalysisCreateRequestSchema.parse(body);
        const analysis = await this.createAnalysis.execute({
            requirementRevisionId: revisionId,
            snapshotId: input.snapshotId,
            sourceTargetId: input.sourceTargetId,
            allowPartialSnapshot: input.allowPartialSnapshot,
            requestKey: input.requestKey,
        });
        const response = contracts_1.impactAnalysisResponseSchema.parse((0, impact_analysis_mapper_1.mapImpactAnalysisResponse)({ analysis }));
        return response;
    }
    async get(analysisId) {
        const analysis = await this.getAnalysis.execute(analysisId);
        return contracts_1.impactAnalysisResponseSchema.parse((0, impact_analysis_mapper_1.mapImpactAnalysisResponse)({ analysis }));
    }
    async finalize(analysisId, body) {
        const input = contracts_1.finalizeImpactAnalysisRequestSchema.parse(body);
        const analysis = await this.finalizeAnalysis.execute({
            analysisId,
            acknowledgeUnreviewed: input.acknowledgeUnreviewed,
        });
        return contracts_1.impactAnalysisResponseSchema.parse((0, impact_analysis_mapper_1.mapImpactAnalysisResponse)({ analysis }));
    }
};
exports.ImpactAnalysisController = ImpactAnalysisController;
__decorate([
    (0, common_1.Post)('/requirement-revisions/:revisionId/impact-analyses'),
    __param(0, (0, common_1.Param)('revisionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ImpactAnalysisController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('/impact-analyses/:analysisId'),
    __param(0, (0, common_1.Param)('analysisId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ImpactAnalysisController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('/impact-analyses/:analysisId/finalize'),
    __param(0, (0, common_1.Param)('analysisId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ImpactAnalysisController.prototype, "finalize", null);
exports.ImpactAnalysisController = ImpactAnalysisController = __decorate([
    (0, common_1.Controller)('/api/v1'),
    __metadata("design:paramtypes", [create_impact_analysis_usecase_1.CreateImpactAnalysisUseCase,
        get_impact_analysis_usecase_1.GetImpactAnalysisUseCase,
        finalize_impact_analysis_usecase_1.FinalizeImpactAnalysisUseCase])
], ImpactAnalysisController);
