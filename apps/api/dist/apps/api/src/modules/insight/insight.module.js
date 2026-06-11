"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsightModule = void 0;
const common_1 = require("@nestjs/common");
const insight_controller_1 = require("./api/insight.controller");
const list_insights_usecase_1 = require("./application/list-insights.usecase");
const review_insight_usecase_1 = require("./application/review-insight.usecase");
const insight_repository_1 = require("./infrastructure/insight.repository");
const prisma_module_1 = require("../prisma/prisma.module");
const prisma_service_1 = require("../prisma/prisma.service");
const event_log_module_1 = require("../event-log/event-log.module");
const event_log_service_1 = require("../event-log/application/event-log.service");
let InsightModule = class InsightModule {
};
exports.InsightModule = InsightModule;
exports.InsightModule = InsightModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, event_log_module_1.EventLogModule],
        controllers: [insight_controller_1.InsightController],
        providers: [
            {
                provide: insight_repository_1.InsightRepository,
                useFactory: (prisma) => new insight_repository_1.InsightRepository(prisma),
                inject: [prisma_service_1.PrismaService],
            },
            {
                provide: list_insights_usecase_1.ListInsightsUseCase,
                useFactory: (repo) => new list_insights_usecase_1.ListInsightsUseCase(repo),
                inject: [insight_repository_1.InsightRepository],
            },
            {
                provide: review_insight_usecase_1.ReviewInsightUseCase,
                useFactory: (repo, eventLog) => new review_insight_usecase_1.ReviewInsightUseCase(repo, eventLog),
                inject: [insight_repository_1.InsightRepository, event_log_service_1.EventLogService],
            },
        ],
    })
], InsightModule);
