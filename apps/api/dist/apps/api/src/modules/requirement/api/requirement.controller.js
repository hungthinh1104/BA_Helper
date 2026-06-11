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
exports.RequirementController = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("../../../../../../packages/contracts/src/index.ts");
const create_requirement_usecase_1 = require("../application/create-requirement.usecase");
const create_revision_usecase_1 = require("../application/create-revision.usecase");
const qualify_revision_usecase_1 = require("../application/qualify-revision.usecase");
let RequirementController = class RequirementController {
    constructor(createRequirement, createRevision, qualifyRevision) {
        this.createRequirement = createRequirement;
        this.createRevision = createRevision;
        this.qualifyRevision = qualifyRevision;
    }
    async createRequirementEndpoint(projectId, body) {
        const input = contracts_1.requirementCreateRequestSchema.parse(body);
        const result = await this.createRequirement.execute({
            projectId,
            title: input.title,
            rawText: input.rawText,
            submitForReadinessCheck: input.submitForReadinessCheck,
        });
        return contracts_1.requirementCreateResponseSchema.parse({
            requirementId: result.requirement.id,
            revisionId: result.revision.id,
            title: result.revision.title,
            readinessStatus: result.revision.readinessStatus,
            validationIssues: result.revision.validationIssues ?? [],
        });
    }
    async createRevisionEndpoint(requirementId, body) {
        const input = contracts_1.requirementRevisionCreateRequestSchema.parse(body);
        const result = await this.createRevision.execute({
            requirementId,
            title: input.title,
            rawText: input.rawText,
            submitForReadinessCheck: input.submitForReadinessCheck,
        });
        return contracts_1.requirementRevisionCreateResponseSchema.parse({
            requirementId: result.requirement.id,
            revisionId: result.revision.id,
            title: result.revision.title,
            readinessStatus: result.revision.readinessStatus,
            validationIssues: result.revision.validationIssues ?? [],
        });
    }
    async qualifyRevisionEndpoint(revisionId) {
        const result = await this.qualifyRevision.execute({ revisionId });
        return contracts_1.requirementRevisionQualifyResponseSchema.parse({
            revisionId: result.revision.id,
            readinessStatus: result.revision.readinessStatus,
            validationIssues: result.revision.validationIssues ?? [],
        });
    }
};
exports.RequirementController = RequirementController;
__decorate([
    (0, common_1.Post)('/projects/:projectId/requirements'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], RequirementController.prototype, "createRequirementEndpoint", null);
__decorate([
    (0, common_1.Post)('/requirements/:requirementId/revisions'),
    __param(0, (0, common_1.Param)('requirementId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], RequirementController.prototype, "createRevisionEndpoint", null);
__decorate([
    (0, common_1.Post)('/requirement-revisions/:revisionId/qualify'),
    __param(0, (0, common_1.Param)('revisionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RequirementController.prototype, "qualifyRevisionEndpoint", null);
exports.RequirementController = RequirementController = __decorate([
    (0, common_1.Controller)('/api/v1'),
    __metadata("design:paramtypes", [create_requirement_usecase_1.CreateRequirementUseCase,
        create_revision_usecase_1.CreateRequirementRevisionUseCase,
        qualify_revision_usecase_1.QualifyRequirementRevisionUseCase])
], RequirementController);
