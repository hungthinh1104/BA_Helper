"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScanJobController = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("../../../../../../packages/contracts/src/index.ts");
const create_scan_job_usecase_1 = require("../application/create-scan-job.usecase");
const scan_job_repository_1 = require("../infrastructure/scan-job.repository");
const app_error_1 = require("../../../shared/app-error");
let ScanJobController = class ScanJobController {
    constructor(createScanJob, scanJobRepository) {
        this.createScanJob = createScanJob;
        this.scanJobRepository = scanJobRepository;
    }
    async get(scanJobId) {
        const job = await this.scanJobRepository.findById(scanJobId);
        if (!job) {
            throw new app_error_1.AppError('SCAN_JOB_NOT_FOUND', 'Scan job not found.');
        }
        return contracts_1.scanJobResponseSchema.parse({
            id: job.id,
            status: job.status,
            stage: job.stage,
            progress: job.progress,
            error: job.errorCode
                ? { code: job.errorCode, message: job.errorMessage ?? '' }
                : null,
            result: {
                sourceTargetId: job.sourceTargetId,
                snapshotId: job.snapshotId,
                snapshotCoverageStatus: null,
            },
            capabilities: {
                canCancel: job.status === 'QUEUED' || job.status === 'RUNNING',
                canRerun: job.status === 'FAILED' ||
                    job.status === 'CANCELLED' ||
                    job.status === 'COMPLETED',
            },
            createdAt: job.createdAt.toISOString(),
            updatedAt: job.updatedAt.toISOString(),
        });
    }
    async create(repositoryId, body) {
        const input = contracts_1.scanJobCreateRequestSchema.parse(body);
        const job = await this.createScanJob.execute({
            repositoryId,
            requestKey: input.requestKey,
            requestedRef: input.ref,
        });
        const response = contracts_1.scanJobResponseSchema.parse({
            id: job.id,
            status: job.status,
            stage: job.stage,
            progress: job.progress,
            error: job.errorCode
                ? { code: job.errorCode, message: job.errorMessage ?? '' }
                : null,
            result: {
                sourceTargetId: job.sourceTargetId,
                snapshotId: job.snapshotId,
                snapshotCoverageStatus: null,
            },
            capabilities: {
                canCancel: job.status === 'QUEUED' || job.status === 'RUNNING',
                canRerun: job.status === 'FAILED' ||
                    job.status === 'CANCELLED' ||
                    job.status === 'COMPLETED',
            },
            createdAt: job.createdAt.toISOString(),
            updatedAt: job.updatedAt.toISOString(),
        });
        return response;
    }
};
exports.ScanJobController = ScanJobController;
__decorate([
    (0, common_1.Get)('/api/v1/scan-jobs/:scanJobId'),
    __param(0, (0, common_1.Param)('scanJobId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ScanJobController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Param)('repositoryId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ScanJobController.prototype, "create", null);
exports.ScanJobController = ScanJobController = __decorate([
    (0, common_1.Controller)('/api/v1/repositories/:repositoryId/scan-jobs'),
    __metadata("design:paramtypes", [create_scan_job_usecase_1.CreateScanJobUseCase,
        scan_job_repository_1.ScanJobRepository])
], ScanJobController);
