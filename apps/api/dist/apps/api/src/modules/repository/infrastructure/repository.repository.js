"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepositoryRepository = void 0;
class RepositoryRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findByProjectAndUrl(params) {
        return this.prisma.repository.findUnique({
            where: {
                projectId_canonicalUrl: {
                    projectId: params.projectId,
                    canonicalUrl: params.canonicalUrl,
                },
            },
        });
    }
    async createRepository(params) {
        return this.prisma.repository.create({
            data: {
                projectId: params.projectId,
                canonicalUrl: params.canonicalUrl,
            },
        });
    }
    async findById(id) {
        return this.prisma.repository.findUnique({
            where: { id },
        });
    }
}
exports.RepositoryRepository = RepositoryRepository;
