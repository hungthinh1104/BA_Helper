"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateScanJobUseCase = void 0;
const scan_job_policy_1 = require("../domain/scan-job.policy");
const app_error_1 = require("../../../shared/app-error");
class CreateScanJobUseCase {
    constructor(scanJobRepository, repositoryRepository, eventLog) {
        this.scanJobRepository = scanJobRepository;
        this.repositoryRepository = repositoryRepository;
        this.eventLog = eventLog;
    }
    async execute(params) {
        const repository = await this.repositoryRepository.findById(params.repositoryId);
        if (!repository) {
            throw new app_error_1.AppError('REPOSITORY_NOT_FOUND', 'Repository not found.');
        }
        scan_job_policy_1.ScanJobPolicy.validateRef(params.requestedRef);
        const existing = await this.scanJobRepository.findByRepositoryAndRequestKey({
            repositoryId: params.repositoryId,
            requestKey: params.requestKey,
        });
        if (existing) {
            if (existing.requestedRef !== (params.requestedRef ?? null)) {
                throw new app_error_1.AppError('REQUEST_KEY_MISMATCH', 'Request key reuse with different payload.');
            }
            return existing;
        }
        const job = await this.scanJobRepository.createQueued({
            repositoryId: params.repositoryId,
            requestKey: params.requestKey,
            requestedRef: params.requestedRef,
        });
        await this.eventLog.recordEvent({
            eventType: 'SCAN_JOB_QUEUED',
            idempotencyKey: `scan:${job.id}:queued`,
            payload: {
                repositoryId: job.repositoryId,
                scanJobId: job.id,
                requestKey: job.requestKey,
            },
        });
        return job;
    }
}
exports.CreateScanJobUseCase = CreateScanJobUseCase;
