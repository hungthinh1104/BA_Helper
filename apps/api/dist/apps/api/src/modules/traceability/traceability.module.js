"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TraceabilityModule = void 0;
const common_1 = require("@nestjs/common");
const traceability_controller_1 = require("./api/traceability.controller");
const list_traceability_usecase_1 = require("./application/list-traceability.usecase");
const review_traceability_usecase_1 = require("./application/review-traceability.usecase");
const traceability_repository_1 = require("./infrastructure/traceability.repository");
const prisma_module_1 = require("../prisma/prisma.module");
const prisma_service_1 = require("../prisma/prisma.service");
const event_log_module_1 = require("../event-log/event-log.module");
const event_log_service_1 = require("../event-log/application/event-log.service");
let TraceabilityModule = class TraceabilityModule {
};
exports.TraceabilityModule = TraceabilityModule;
exports.TraceabilityModule = TraceabilityModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, event_log_module_1.EventLogModule],
        controllers: [traceability_controller_1.TraceabilityController],
        providers: [
            {
                provide: traceability_repository_1.TraceabilityRepository,
                useFactory: (prisma) => new traceability_repository_1.TraceabilityRepository(prisma),
                inject: [prisma_service_1.PrismaService],
            },
            {
                provide: list_traceability_usecase_1.ListTraceabilityUseCase,
                useFactory: (repo) => new list_traceability_usecase_1.ListTraceabilityUseCase(repo),
                inject: [traceability_repository_1.TraceabilityRepository],
            },
            {
                provide: review_traceability_usecase_1.ReviewTraceabilityUseCase,
                useFactory: (repo, eventLog) => new review_traceability_usecase_1.ReviewTraceabilityUseCase(repo, eventLog),
                inject: [traceability_repository_1.TraceabilityRepository, event_log_service_1.EventLogService],
            },
        ],
    })
], TraceabilityModule);
