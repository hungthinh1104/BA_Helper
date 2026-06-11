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
exports.InsightController = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("../../../../../../packages/contracts/src/index.ts");
const list_insights_usecase_1 = require("../application/list-insights.usecase");
const review_insight_usecase_1 = require("../application/review-insight.usecase");
const insight_mapper_1 = require("./insight.mapper");
let InsightController = class InsightController {
    constructor(listInsights, reviewInsight) {
        this.listInsights = listInsights;
        this.reviewInsight = reviewInsight;
    }
    async list(analysisId) {
        const items = await this.listInsights.execute(analysisId);
        return contracts_1.insightListResponseSchema.parse({ items: (0, insight_mapper_1.mapInsightList)(items) });
    }
    async confirm(insightId) {
        await this.reviewInsight.execute({ insightId, reviewStatus: 'CONFIRMED' });
        return { ok: true };
    }
    async reject(insightId) {
        await this.reviewInsight.execute({ insightId, reviewStatus: 'REJECTED' });
        return { ok: true };
    }
    async review(insightId, body) {
        const input = contracts_1.insightReviewRequestSchema.parse(body);
        await this.reviewInsight.execute({
            insightId,
            reviewStatus: input.reviewStatus,
        });
        return { ok: true };
    }
};
exports.InsightController = InsightController;
__decorate([
    (0, common_1.Get)('/impact-analyses/:analysisId/insights'),
    __param(0, (0, common_1.Param)('analysisId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], InsightController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('/insights/:insightId/confirm'),
    __param(0, (0, common_1.Param)('insightId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], InsightController.prototype, "confirm", null);
__decorate([
    (0, common_1.Post)('/insights/:insightId/reject'),
    __param(0, (0, common_1.Param)('insightId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], InsightController.prototype, "reject", null);
__decorate([
    (0, common_1.Post)('/insights/:insightId/review'),
    __param(0, (0, common_1.Param)('insightId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], InsightController.prototype, "review", null);
exports.InsightController = InsightController = __decorate([
    (0, common_1.Controller)('/api/v1'),
    __metadata("design:paramtypes", [list_insights_usecase_1.ListInsightsUseCase,
        review_insight_usecase_1.ReviewInsightUseCase])
], InsightController);
