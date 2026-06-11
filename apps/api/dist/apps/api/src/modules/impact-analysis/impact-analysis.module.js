"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImpactAnalysisModule = void 0;
const common_1 = require("@nestjs/common");
const impact_analysis_controller_1 = require("./api/impact-analysis.controller");
const create_impact_analysis_usecase_1 = require("./application/create-impact-analysis.usecase");
const get_impact_analysis_usecase_1 = require("./application/get-impact-analysis.usecase");
const finalize_impact_analysis_usecase_1 = require("./application/finalize-impact-analysis.usecase");
const run_impact_analysis_usecase_1 = require("./application/run-impact-analysis.usecase");
const impact_analysis_repository_1 = require("./infrastructure/impact-analysis.repository");
const requirement_repository_1 = require("../requirement/infrastructure/requirement.repository");
const artifact_repository_1 = require("../artifact/infrastructure/artifact.repository");
const evidence_repository_1 = require("../evidence/infrastructure/evidence.repository");
const insight_repository_1 = require("../insight/infrastructure/insight.repository");
const traceability_repository_1 = require("../traceability/infrastructure/traceability.repository");
const prisma_module_1 = require("../prisma/prisma.module");
const prisma_service_1 = require("../prisma/prisma.service");
const event_log_module_1 = require("../event-log/event-log.module");
const event_log_service_1 = require("../event-log/application/event-log.service");
const document_module_1 = require("../document/document.module");
const queue_module_1 = require("../queue/queue.module");
const queue_service_1 = require("../queue/queue.service");
let ImpactAnalysisModule = class ImpactAnalysisModule {
};
exports.ImpactAnalysisModule = ImpactAnalysisModule;
exports.ImpactAnalysisModule = ImpactAnalysisModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, event_log_module_1.EventLogModule, document_module_1.DocumentModule, queue_module_1.QueueModule],
        controllers: [impact_analysis_controller_1.ImpactAnalysisController],
        providers: [
            {
                provide: impact_analysis_repository_1.ImpactAnalysisRepository,
                useFactory: (prisma) => new impact_analysis_repository_1.ImpactAnalysisRepository(prisma),
                inject: [prisma_service_1.PrismaService],
            },
            {
                provide: requirement_repository_1.RequirementRepository,
                useFactory: (prisma) => new requirement_repository_1.RequirementRepository(prisma),
                inject: [prisma_service_1.PrismaService],
            },
            {
                provide: artifact_repository_1.ArtifactRepository,
                useFactory: (prisma) => new artifact_repository_1.ArtifactRepository(prisma),
                inject: [prisma_service_1.PrismaService],
            },
            {
                provide: evidence_repository_1.EvidenceRepository,
                useFactory: (prisma) => new evidence_repository_1.EvidenceRepository(prisma),
                inject: [prisma_service_1.PrismaService],
            },
            {
                provide: insight_repository_1.InsightRepository,
                useFactory: (prisma) => new insight_repository_1.InsightRepository(prisma),
                inject: [prisma_service_1.PrismaService],
            },
            {
                provide: traceability_repository_1.TraceabilityRepository,
                useFactory: (prisma) => new traceability_repository_1.TraceabilityRepository(prisma),
                inject: [prisma_service_1.PrismaService],
            },
            {
                provide: create_impact_analysis_usecase_1.CreateImpactAnalysisUseCase,
                useFactory: (repo, requirementRepo, prisma, eventLog, queue) => new create_impact_analysis_usecase_1.CreateImpactAnalysisUseCase(repo, requirementRepo, prisma, eventLog, queue),
                inject: [
                    impact_analysis_repository_1.ImpactAnalysisRepository,
                    requirement_repository_1.RequirementRepository,
                    prisma_service_1.PrismaService,
                    event_log_service_1.EventLogService,
                    queue_service_1.QueueService,
                ],
            },
            {
                provide: get_impact_analysis_usecase_1.GetImpactAnalysisUseCase,
                useFactory: (repo) => new get_impact_analysis_usecase_1.GetImpactAnalysisUseCase(repo),
                inject: [impact_analysis_repository_1.ImpactAnalysisRepository],
            },
            {
                provide: run_impact_analysis_usecase_1.RunImpactAnalysisUseCase,
                useFactory: (repo, artifactRepo, evidenceRepo, insightRepo, traceabilityRepo) => new run_impact_analysis_usecase_1.RunImpactAnalysisUseCase(repo, artifactRepo, evidenceRepo, insightRepo, traceabilityRepo),
                inject: [
                    impact_analysis_repository_1.ImpactAnalysisRepository,
                    artifact_repository_1.ArtifactRepository,
                    evidence_repository_1.EvidenceRepository,
                    insight_repository_1.InsightRepository,
                    traceability_repository_1.TraceabilityRepository,
                ],
            },
            {
                provide: finalize_impact_analysis_usecase_1.FinalizeImpactAnalysisUseCase,
                useFactory: (repo, docRepo, eventLog) => new finalize_impact_analysis_usecase_1.FinalizeImpactAnalysisUseCase(repo, docRepo, eventLog),
                inject: [impact_analysis_repository_1.ImpactAnalysisRepository, 'DocumentRepository', event_log_service_1.EventLogService],
            },
        ],
    })
], ImpactAnalysisModule);
