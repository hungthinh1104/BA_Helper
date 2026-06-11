"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvidenceModule = void 0;
const common_1 = require("@nestjs/common");
const evidence_controller_1 = require("./api/evidence.controller");
const list_evidence_usecase_1 = require("./application/list-evidence.usecase");
const evidence_repository_1 = require("./infrastructure/evidence.repository");
const prisma_module_1 = require("../prisma/prisma.module");
const prisma_service_1 = require("../prisma/prisma.service");
let EvidenceModule = class EvidenceModule {
};
exports.EvidenceModule = EvidenceModule;
exports.EvidenceModule = EvidenceModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [evidence_controller_1.EvidenceController],
        providers: [
            {
                provide: evidence_repository_1.EvidenceRepository,
                useFactory: (prisma) => new evidence_repository_1.EvidenceRepository(prisma),
                inject: [prisma_service_1.PrismaService],
            },
            {
                provide: list_evidence_usecase_1.ListEvidenceUseCase,
                useFactory: (repo, prisma) => new list_evidence_usecase_1.ListEvidenceUseCase(repo, prisma),
                inject: [evidence_repository_1.EvidenceRepository, prisma_service_1.PrismaService],
            },
        ],
    })
], EvidenceModule);
