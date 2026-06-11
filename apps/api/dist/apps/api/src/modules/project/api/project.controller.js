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
exports.ProjectController = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("../../../../../../packages/contracts/src/index.ts");
const create_project_usecase_1 = require("../application/create-project.usecase");
let ProjectController = class ProjectController {
    constructor(createProject) {
        this.createProject = createProject;
    }
    async create(body) {
        const input = contracts_1.projectCreateRequestSchema.parse(body);
        const project = await this.createProject.execute({ name: input.name });
        const response = contracts_1.projectCreateResponseSchema.parse({
            projectId: project.id,
            name: project.name,
            createdAt: project.createdAt.toISOString(),
        });
        return response;
    }
};
exports.ProjectController = ProjectController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "create", null);
exports.ProjectController = ProjectController = __decorate([
    (0, common_1.Controller)('/api/v1/projects'),
    __metadata("design:paramtypes", [create_project_usecase_1.CreateProjectUseCase])
], ProjectController);
