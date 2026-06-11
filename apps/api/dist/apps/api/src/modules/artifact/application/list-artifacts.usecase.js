"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListArtifactsUseCase = void 0;
const app_error_1 = require("../../../shared/app-error");
class ListArtifactsUseCase {
    constructor(repository, prisma) {
        this.repository = repository;
        this.prisma = prisma;
    }
    async execute(snapshotId) {
        const snapshot = await this.prisma.repositorySnapshot.findUnique({
            where: { id: snapshotId },
        });
        if (!snapshot) {
            throw new app_error_1.AppError('SNAPSHOT_NOT_FOUND', 'Snapshot not found.');
        }
        return this.repository.listBySnapshot(snapshotId);
    }
}
exports.ListArtifactsUseCase = ListArtifactsUseCase;
