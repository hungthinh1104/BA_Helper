"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphRepository = void 0;
class GraphRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listBySnapshot(snapshotId) {
        return this.prisma.dependencyEdge.findMany({
            where: { snapshotId },
        });
    }
}
exports.GraphRepository = GraphRepository;
