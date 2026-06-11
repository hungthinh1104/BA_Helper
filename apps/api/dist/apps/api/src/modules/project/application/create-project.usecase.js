"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateProjectUseCase = void 0;
const app_error_1 = require("../../../shared/app-error");
class CreateProjectUseCase {
    constructor(repository, eventLog) {
        this.repository = repository;
        this.eventLog = eventLog;
    }
    async execute(params) {
        const name = params.name.trim();
        if (!name) {
            throw new app_error_1.AppError('INVALID_PROJECT_NAME', 'Project name is required.');
        }
        const project = await this.repository.createProject(name);
        await this.eventLog.recordEvent({
            eventType: 'PROJECT_CREATED',
            idempotencyKey: `project:${project.id}:created`,
            payload: { projectId: project.id },
        });
        return project;
    }
}
exports.CreateProjectUseCase = CreateProjectUseCase;
