"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectModule = void 0;
const common_1 = require("@nestjs/common");
const project_controller_1 = require("./api/project.controller");
const create_project_usecase_1 = require("./application/create-project.usecase");
const project_repository_1 = require("./infrastructure/project.repository");
const prisma_module_1 = require("../prisma/prisma.module");
const prisma_service_1 = require("../prisma/prisma.service");
const event_log_module_1 = require("../event-log/event-log.module");
const event_log_service_1 = require("../event-log/application/event-log.service");
let ProjectModule = class ProjectModule {
};
exports.ProjectModule = ProjectModule;
exports.ProjectModule = ProjectModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, event_log_module_1.EventLogModule],
        controllers: [project_controller_1.ProjectController],
        providers: [
            {
                provide: project_repository_1.ProjectRepository,
                useFactory: (prisma) => new project_repository_1.ProjectRepository(prisma),
                inject: [prisma_service_1.PrismaService],
            },
            {
                provide: create_project_usecase_1.CreateProjectUseCase,
                useFactory: (repo, eventLog) => new create_project_usecase_1.CreateProjectUseCase(repo, eventLog),
                inject: [project_repository_1.ProjectRepository, event_log_service_1.EventLogService],
            },
        ],
    })
], ProjectModule);
