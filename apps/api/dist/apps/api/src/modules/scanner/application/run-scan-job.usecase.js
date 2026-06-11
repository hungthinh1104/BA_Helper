"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunScanJobUseCase = void 0;
const app_error_1 = require("../../../shared/app-error");
const client_1 = require("@prisma/client");
class RunScanJobUseCase {
    constructor(scanJobRepository, eventLogService) {
        this.scanJobRepository = scanJobRepository;
        this.eventLogService = eventLogService;
    }
    async execute(params) {
        const job = await this.scanJobRepository.findById(params.jobId);
        if (!job) {
            throw new app_error_1.AppError('SCAN_JOB_NOT_FOUND', 'Scan job not found.');
        }
        if (job.status !== 'QUEUED') {
            throw new app_error_1.AppError('INVALID_SCAN_JOB_STATE', 'Job is not queued.');
        }
        await this.scanJobRepository.updateState({
            jobId: job.id,
            status: client_1.ScanJobStatus.RUNNING,
            stage: client_1.ScanJobStage.EXTRACTING_ARTIFACTS,
            progress: 10,
        });
        try {
            // TODO: Implement actual scanning using ts-morph in Phase 5/6
            await this.scanJobRepository.updateState({
                jobId: job.id,
                status: client_1.ScanJobStatus.COMPLETED,
                stage: client_1.ScanJobStage.DONE,
                progress: 100,
            });
            await this.eventLogService.recordEvent({
                eventType: 'SCAN_JOB_COMPLETED',
                idempotencyKey: `scan-job:${job.id}:completed`,
                payload: { jobId: job.id },
            });
        }
        catch (error) {
            await this.scanJobRepository.updateState({
                jobId: job.id,
                status: client_1.ScanJobStatus.FAILED,
                stage: client_1.ScanJobStage.DONE,
                progress: 0,
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
            });
            await this.eventLogService.recordEvent({
                eventType: 'SCAN_JOB_FAILED',
                idempotencyKey: `scan-job:${job.id}:failed`,
                payload: { jobId: job.id },
            });
            throw error;
        }
    }
}
exports.RunScanJobUseCase = RunScanJobUseCase;
