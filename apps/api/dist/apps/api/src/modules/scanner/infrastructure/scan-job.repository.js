"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScanJobRepository = void 0;
const client_1 = require("@prisma/client");
class ScanJobRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findById(id) {
        return this.prisma.scanJob.findUnique({
            where: { id },
        });
    }
    async findByRepositoryAndRequestKey(params) {
        return this.prisma.scanJob.findUnique({
            where: {
                repositoryId_requestKey: {
                    repositoryId: params.repositoryId,
                    requestKey: params.requestKey,
                },
            },
        });
    }
    async createQueued(params) {
        return this.prisma.scanJob.create({
            data: {
                repositoryId: params.repositoryId,
                requestKey: params.requestKey,
                requestedRef: params.requestedRef,
                status: client_1.ScanJobStatus.QUEUED,
                stage: client_1.ScanJobStage.WAITING,
                progress: 0,
            },
        });
    }
    async updateState(params) {
        return this.prisma.scanJob.update({
            where: { id: params.jobId },
            data: {
                status: params.status,
                stage: params.stage,
                progress: params.progress,
                errorMessage: params.errorMessage ?? null,
            },
        });
    }
}
exports.ScanJobRepository = ScanJobRepository;
