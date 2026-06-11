"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepositoryModule = void 0;
const common_1 = require("@nestjs/common");
const repository_controller_1 = require("./api/repository.controller");
const create_repository_usecase_1 = require("./application/create-repository.usecase");
const repository_repository_1 = require("./infrastructure/repository.repository");
const project_repository_1 = require("../project/infrastructure/project.repository");
const prisma_module_1 = require("../prisma/prisma.module");
const prisma_service_1 = require("../prisma/prisma.service");
const event_log_module_1 = require("../event-log/event-log.module");
const event_log_service_1 = require("../event-log/application/event-log.service");
let RepositoryModule = class RepositoryModule {
};
exports.RepositoryModule = RepositoryModule;
exports.RepositoryModule = RepositoryModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, event_log_module_1.EventLogModule],
        controllers: [repository_controller_1.RepositoryController],
        providers: [
            {
                provide: repository_repository_1.RepositoryRepository,
                useFactory: (prisma) => new repository_repository_1.RepositoryRepository(prisma),
                inject: [prisma_service_1.PrismaService],
            },
            {
                provide: project_repository_1.ProjectRepository,
                useFactory: (prisma) => new project_repository_1.ProjectRepository(prisma),
                inject: [prisma_service_1.PrismaService],
            },
            {
                provide: create_repository_usecase_1.CreateRepositoryUseCase,
                useFactory: (repo, projectRepo, eventLog) => new create_repository_usecase_1.CreateRepositoryUseCase(repo, projectRepo, eventLog),
                inject: [repository_repository_1.RepositoryRepository, project_repository_1.ProjectRepository, event_log_service_1.EventLogService],
            },
        ],
    })
], RepositoryModule);
