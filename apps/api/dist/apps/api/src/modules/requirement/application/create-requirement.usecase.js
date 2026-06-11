"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateRequirementUseCase = void 0;
const requirement_policy_1 = require("../domain/requirement.policy");
const app_error_1 = require("../../../shared/app-error");
class CreateRequirementUseCase {
    constructor(repository, projectRepository, eventLog) {
        this.repository = repository;
        this.projectRepository = projectRepository;
        this.eventLog = eventLog;
    }
    async execute(params) {
        requirement_policy_1.RequirementPolicy.validateRevisionInput({
            title: params.title,
            rawText: params.rawText,
        });
        const project = await this.projectRepository.findById(params.projectId);
        if (!project) {
            throw new app_error_1.AppError('PROJECT_NOT_FOUND', 'Project not found.');
        }
        const requirement = await this.repository.createRequirement(params.projectId);
        const normalizedText = params.rawText.trim();
        const readiness = params.submitForReadinessCheck
            ? requirement_policy_1.RequirementPolicy.qualifyReadiness(params.rawText)
            : { status: 'DRAFT', issues: [] };
        const revision = await this.repository.createRevision({
            requirementId: requirement.id,
            title: params.title.trim(),
            rawText: params.rawText,
            normalizedText,
            readinessStatus: readiness.status,
            validationIssues: readiness.issues,
        });
        await this.eventLog.recordEvent({
            eventType: 'REQUIREMENT_CREATED',
            idempotencyKey: `requirement:${requirement.id}:created`,
            payload: { requirementId: requirement.id, revisionId: revision.id },
        });
        return { requirement, revision, readiness };
    }
}
exports.CreateRequirementUseCase = CreateRequirementUseCase;
