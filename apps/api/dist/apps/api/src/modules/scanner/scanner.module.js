"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScannerModule = void 0;
const common_1 = require("@nestjs/common");
const scan_job_controller_1 = require("./api/scan-job.controller");
const create_scan_job_usecase_1 = require("./application/create-scan-job.usecase");
const run_scan_job_usecase_1 = require("./application/run-scan-job.usecase");
const scan_job_repository_1 = require("./infrastructure/scan-job.repository");
const repository_repository_1 = require("../repository/infrastructure/repository.repository");
const prisma_module_1 = require("../prisma/prisma.module");
const prisma_service_1 = require("../prisma/prisma.service");
const event_log_module_1 = require("../event-log/event-log.module");
const event_log_service_1 = require("../event-log/application/event-log.service");
const repository_module_1 = require("../repository/repository.module");
let ScannerModule = class ScannerModule {
};
exports.ScannerModule = ScannerModule;
exports.ScannerModule = ScannerModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, event_log_module_1.EventLogModule, repository_module_1.RepositoryModule],
        controllers: [scan_job_controller_1.ScanJobController],
        providers: [
            {
                provide: scan_job_repository_1.ScanJobRepository,
                useFactory: (prisma) => new scan_job_repository_1.ScanJobRepository(prisma),
                inject: [prisma_service_1.PrismaService],
            },
            {
                provide: run_scan_job_usecase_1.RunScanJobUseCase,
                useFactory: (scanRepo, eventLog) => new run_scan_job_usecase_1.RunScanJobUseCase(scanRepo, eventLog),
                inject: [scan_job_repository_1.ScanJobRepository, event_log_service_1.EventLogService],
            },
            {
                provide: repository_repository_1.RepositoryRepository,
                useFactory: (prisma) => new repository_repository_1.RepositoryRepository(prisma),
                inject: [prisma_service_1.PrismaService],
            },
            {
                provide: create_scan_job_usecase_1.CreateScanJobUseCase,
                useFactory: (scanRepo, repoRepo, eventLog) => new create_scan_job_usecase_1.CreateScanJobUseCase(scanRepo, repoRepo, eventLog),
                inject: [scan_job_repository_1.ScanJobRepository, repository_repository_1.RepositoryRepository, event_log_service_1.EventLogService],
            },
        ],
        exports: [run_scan_job_usecase_1.RunScanJobUseCase, scan_job_repository_1.ScanJobRepository],
    })
], ScannerModule);
