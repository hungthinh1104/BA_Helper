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
exports.TraceabilityController = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("../../../../../../packages/contracts/src/index.ts");
const list_traceability_usecase_1 = require("../application/list-traceability.usecase");
const review_traceability_usecase_1 = require("../application/review-traceability.usecase");
const traceability_mapper_1 = require("./traceability.mapper");
let TraceabilityController = class TraceabilityController {
    constructor(listTraceability, reviewTraceability) {
        this.listTraceability = listTraceability;
        this.reviewTraceability = reviewTraceability;
    }
    async list(analysisId) {
        const items = await this.listTraceability.execute(analysisId);
        return contracts_1.traceabilityLinkListResponseSchema.parse({
            items: (0, traceability_mapper_1.mapTraceabilityList)(items),
        });
    }
    async confirm(linkId) {
        await this.reviewTraceability.execute({ linkId, reviewStatus: 'CONFIRMED' });
        return { ok: true };
    }
    async reject(linkId) {
        await this.reviewTraceability.execute({ linkId, reviewStatus: 'REJECTED' });
        return { ok: true };
    }
    async review(linkId, body) {
        const input = contracts_1.traceabilityReviewRequestSchema.parse(body);
        await this.reviewTraceability.execute({
            linkId,
            reviewStatus: input.reviewStatus,
        });
        return { ok: true };
    }
};
exports.TraceabilityController = TraceabilityController;
__decorate([
    (0, common_1.Get)('/impact-analyses/:analysisId/traceability'),
    __param(0, (0, common_1.Param)('analysisId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TraceabilityController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('/traceability-links/:linkId/confirm'),
    __param(0, (0, common_1.Param)('linkId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TraceabilityController.prototype, "confirm", null);
__decorate([
    (0, common_1.Post)('/traceability-links/:linkId/reject'),
    __param(0, (0, common_1.Param)('linkId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TraceabilityController.prototype, "reject", null);
__decorate([
    (0, common_1.Post)('/traceability-links/:linkId/review'),
    __param(0, (0, common_1.Param)('linkId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TraceabilityController.prototype, "review", null);
exports.TraceabilityController = TraceabilityController = __decorate([
    (0, common_1.Controller)('/api/v1'),
    __metadata("design:paramtypes", [list_traceability_usecase_1.ListTraceabilityUseCase,
        review_traceability_usecase_1.ReviewTraceabilityUseCase])
], TraceabilityController);
