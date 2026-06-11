"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArtifactRepository = void 0;
class ArtifactRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listBySnapshot(snapshotId) {
        return this.prisma.codeArtifact.findMany({
            where: { snapshotId },
        });
    }
}
exports.ArtifactRepository = ArtifactRepository;
