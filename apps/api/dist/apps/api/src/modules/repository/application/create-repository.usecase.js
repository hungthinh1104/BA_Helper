"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateRepositoryUseCase = void 0;
const repository_policy_1 = require("../domain/repository.policy");
const app_error_1 = require("../../../shared/app-error");
class CreateRepositoryUseCase {
    constructor(repository, projectRepository, eventLog) {
        this.repository = repository;
        this.projectRepository = projectRepository;
        this.eventLog = eventLog;
    }
    async execute(params) {
        const project = await this.projectRepository.findById(params.projectId);
        if (!project) {
            throw new app_error_1.AppError('PROJECT_NOT_FOUND', 'Project not found.');
        }
        const normalized = repository_policy_1.RepositoryPolicy.normalizeUrl(params.url);
        const existing = await this.repository.findByProjectAndUrl({
            projectId: params.projectId,
            canonicalUrl: normalized.canonicalUrl,
        });
        if (existing) {
            return existing;
        }
        const created = await this.repository.createRepository({
            projectId: params.projectId,
            canonicalUrl: normalized.canonicalUrl,
        });
        await this.eventLog.recordEvent({
            eventType: 'REPOSITORY_CREATED',
            idempotencyKey: `repository:${created.id}:created`,
            payload: {
                projectId: created.projectId,
                repositoryId: created.id,
            },
        });
        return created;
    }
}
exports.CreateRepositoryUseCase = CreateRepositoryUseCase;
