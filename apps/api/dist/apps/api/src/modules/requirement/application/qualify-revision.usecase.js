"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualifyRequirementRevisionUseCase = void 0;
const requirement_policy_1 = require("../domain/requirement.policy");
const app_error_1 = require("../../../shared/app-error");
class QualifyRequirementRevisionUseCase {
    constructor(repository, eventLog) {
        this.repository = repository;
        this.eventLog = eventLog;
    }
    async execute(params) {
        const revision = await this.repository.findRevisionById(params.revisionId);
        if (!revision) {
            throw new app_error_1.AppError('REQUIREMENT_REVISION_NOT_FOUND', 'Requirement revision not found.');
        }
        const readiness = requirement_policy_1.RequirementPolicy.qualifyReadiness(revision.rawText);
        const updated = await this.repository.updateRevisionStatus({
            revisionId: revision.id,
            readinessStatus: readiness.status,
            validationIssues: readiness.issues,
        });
        await this.eventLog.recordEvent({
            eventType: 'REQUIREMENT_REVISION_QUALIFIED',
            idempotencyKey: `requirement:${revision.requirementId}:qualified:${revision.id}`,
            payload: { revisionId: revision.id, readinessStatus: readiness.status },
        });
        return { revision: updated, readiness };
    }
}
exports.QualifyRequirementRevisionUseCase = QualifyRequirementRevisionUseCase;
