"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequirementRepository = void 0;
class RequirementRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createRequirement(projectId) {
        return this.prisma.requirement.create({
            data: { projectId },
        });
    }
    async findRequirementById(id) {
        return this.prisma.requirement.findUnique({
            where: { id },
        });
    }
    async createRevision(params) {
        return this.prisma.requirementRevision.create({
            data: {
                requirementId: params.requirementId,
                title: params.title,
                rawText: params.rawText,
                normalizedText: params.normalizedText,
                readinessStatus: params.readinessStatus,
                validationIssues: params.validationIssues,
            },
        });
    }
    async updateRevisionStatus(params) {
        return this.prisma.requirementRevision.update({
            where: { id: params.revisionId },
            data: {
                readinessStatus: params.readinessStatus,
                validationIssues: params.validationIssues,
            },
        });
    }
    async findRevisionById(id) {
        return this.prisma.requirementRevision.findUnique({
            where: { id },
        });
    }
}
exports.RequirementRepository = RequirementRepository;
