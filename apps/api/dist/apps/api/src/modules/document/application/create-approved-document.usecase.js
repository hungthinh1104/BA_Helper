"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateApprovedDocumentUseCase = void 0;
class CreateApprovedDocumentUseCase {
    constructor(repository) {
        this.repository = repository;
    }
    async execute(params) {
        return this.repository.upsertApproved(params);
    }
}
exports.CreateApprovedDocumentUseCase = CreateApprovedDocumentUseCase;
