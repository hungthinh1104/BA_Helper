"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArtifactModule = void 0;
const common_1 = require("@nestjs/common");
const artifact_controller_1 = require("./api/artifact.controller");
const list_artifacts_usecase_1 = require("./application/list-artifacts.usecase");
const artifact_repository_1 = require("./infrastructure/artifact.repository");
const prisma_module_1 = require("../prisma/prisma.module");
const prisma_service_1 = require("../prisma/prisma.service");
let ArtifactModule = class ArtifactModule {
};
exports.ArtifactModule = ArtifactModule;
exports.ArtifactModule = ArtifactModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [artifact_controller_1.ArtifactController],
        providers: [
            {
                provide: artifact_repository_1.ArtifactRepository,
                useFactory: (prisma) => new artifact_repository_1.ArtifactRepository(prisma),
                inject: [prisma_service_1.PrismaService],
            },
            {
                provide: list_artifacts_usecase_1.ListArtifactsUseCase,
                useFactory: (repo, prisma) => new list_artifacts_usecase_1.ListArtifactsUseCase(repo, prisma),
                inject: [artifact_repository_1.ArtifactRepository, prisma_service_1.PrismaService],
            },
        ],
    })
], ArtifactModule);
