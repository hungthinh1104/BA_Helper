"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("./modules/prisma/prisma.module");
const event_log_module_1 = require("./modules/event-log/event-log.module");
const project_module_1 = require("./modules/project/project.module");
const repository_module_1 = require("./modules/repository/repository.module");
const scanner_module_1 = require("./modules/scanner/scanner.module");
const requirement_module_1 = require("./modules/requirement/requirement.module");
const impact_analysis_module_1 = require("./modules/impact-analysis/impact-analysis.module");
const insight_module_1 = require("./modules/insight/insight.module");
const traceability_module_1 = require("./modules/traceability/traceability.module");
const document_module_1 = require("./modules/document/document.module");
const evidence_module_1 = require("./modules/evidence/evidence.module");
const artifact_module_1 = require("./modules/artifact/artifact.module");
const graph_module_1 = require("./modules/graph/graph.module");
const queue_module_1 = require("./modules/queue/queue.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            event_log_module_1.EventLogModule,
            project_module_1.ProjectModule,
            repository_module_1.RepositoryModule,
            scanner_module_1.ScannerModule,
            requirement_module_1.RequirementModule,
            impact_analysis_module_1.ImpactAnalysisModule,
            insight_module_1.InsightModule,
            traceability_module_1.TraceabilityModule,
            document_module_1.DocumentModule,
            evidence_module_1.EvidenceModule,
            artifact_module_1.ArtifactModule,
            graph_module_1.GraphModule,
            queue_module_1.QueueModule,
        ],
    })
], AppModule);
