"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectRepository = void 0;
class ProjectRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createProject(name) {
        return this.prisma.project.create({
            data: { name },
        });
    }
    async findById(id) {
        return this.prisma.project.findUnique({
            where: { id },
        });
    }
}
exports.ProjectRepository = ProjectRepository;
