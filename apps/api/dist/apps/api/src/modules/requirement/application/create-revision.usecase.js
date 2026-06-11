"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateRequirementRevisionUseCase = void 0;
const requirement_policy_1 = require("../domain/requirement.policy");
const app_error_1 = require("../../../shared/app-error");
class CreateRequirementRevisionUseCase {
    constructor(repository, eventLog) {
        this.repository = repository;
        this.eventLog = eventLog;
    }
    async execute(params) {
        const requirement = await this.repository.findRequirementById(params.requirementId);
        if (!requirement) {
            throw new app_error_1.AppError('REQUIREMENT_NOT_FOUND', 'Requirement not found.');
        }
        requirement_policy_1.RequirementPolicy.validateRevisionInput({
            title: params.title,
            rawText: params.rawText,
        });
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
            eventType: 'REQUIREMENT_REVISION_CREATED',
            idempotencyKey: `requirement:${requirement.id}:revision:${revision.id}`,
            payload: { requirementId: requirement.id, revisionId: revision.id },
        });
        return { requirement, revision, readiness };
    }
}
exports.CreateRequirementRevisionUseCase = CreateRequirementRevisionUseCase;
