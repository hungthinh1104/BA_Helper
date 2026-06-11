"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequirementModule = void 0;
const common_1 = require("@nestjs/common");
const requirement_controller_1 = require("./api/requirement.controller");
const requirement_repository_1 = require("./infrastructure/requirement.repository");
const create_requirement_usecase_1 = require("./application/create-requirement.usecase");
const create_revision_usecase_1 = require("./application/create-revision.usecase");
const qualify_revision_usecase_1 = require("./application/qualify-revision.usecase");
const prisma_module_1 = require("../prisma/prisma.module");
const prisma_service_1 = require("../prisma/prisma.service");
const event_log_module_1 = require("../event-log/event-log.module");
const event_log_service_1 = require("../event-log/application/event-log.service");
const project_repository_1 = require("../project/infrastructure/project.repository");
let RequirementModule = class RequirementModule {
};
exports.RequirementModule = RequirementModule;
exports.RequirementModule = RequirementModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, event_log_module_1.EventLogModule],
        controllers: [requirement_controller_1.RequirementController],
        providers: [
            {
                provide: requirement_repository_1.RequirementRepository,
                useFactory: (prisma) => new requirement_repository_1.RequirementRepository(prisma),
                inject: [prisma_service_1.PrismaService],
            },
            {
                provide: project_repository_1.ProjectRepository,
                useFactory: (prisma) => new project_repository_1.ProjectRepository(prisma),
                inject: [prisma_service_1.PrismaService],
            },
            {
                provide: create_requirement_usecase_1.CreateRequirementUseCase,
                useFactory: (repo, projectRepo, eventLog) => new create_requirement_usecase_1.CreateRequirementUseCase(repo, projectRepo, eventLog),
                inject: [requirement_repository_1.RequirementRepository, project_repository_1.ProjectRepository, event_log_service_1.EventLogService],
            },
            {
                provide: create_revision_usecase_1.CreateRequirementRevisionUseCase,
                useFactory: (repo, eventLog) => new create_revision_usecase_1.CreateRequirementRevisionUseCase(repo, eventLog),
                inject: [requirement_repository_1.RequirementRepository, event_log_service_1.EventLogService],
            },
            {
                provide: qualify_revision_usecase_1.QualifyRequirementRevisionUseCase,
                useFactory: (repo, eventLog) => new qualify_revision_usecase_1.QualifyRequirementRevisionUseCase(repo, eventLog),
                inject: [requirement_repository_1.RequirementRepository, event_log_service_1.EventLogService],
            },
        ],
    })
], RequirementModule);
