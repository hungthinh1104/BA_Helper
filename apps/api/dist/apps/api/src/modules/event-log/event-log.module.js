"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventLogModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../prisma/prisma.module");
const event_log_service_1 = require("./application/event-log.service");
const event_log_repository_1 = require("./infrastructure/event-log.repository");
const prisma_service_1 = require("../prisma/prisma.service");
let EventLogModule = class EventLogModule {
};
exports.EventLogModule = EventLogModule;
exports.EventLogModule = EventLogModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        providers: [
            event_log_service_1.EventLogService,
            {
                provide: event_log_repository_1.EventLogRepository,
                useFactory: (prisma) => new event_log_repository_1.EventLogRepository(prisma),
                inject: [prisma_service_1.PrismaService],
            },
        ],
        exports: [event_log_service_1.EventLogService],
    })
], EventLogModule);
