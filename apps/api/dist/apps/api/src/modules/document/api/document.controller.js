"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentController = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("../../../../../../packages/contracts/src/index.ts");
const list_documents_usecase_1 = require("../application/list-documents.usecase");
let DocumentController = class DocumentController {
    constructor(listDocuments) {
        this.listDocuments = listDocuments;
    }
    async list(analysisId) {
        const docs = await this.listDocuments.execute(analysisId);
        const mapped = docs.map((doc) => ({
            id: doc.id,
            type: doc.type,
            status: doc.status,
            commitSha: doc.impactAnalysis.snapshot.commitSha,
            isStale: doc.impactAnalysis.sourceTarget.resolvedRefType !== 'COMMIT' &&
                doc.impactAnalysis.sourceTarget.latestObservedCommitSha !==
                    doc.impactAnalysis.snapshot.commitSha,
        }));
        return contracts_1.documentListResponseSchema.parse({ items: mapped });
    }
};
exports.DocumentController = DocumentController;
__decorate([
    (0, common_1.Get)('/impact-analyses/:analysisId/documents'),
    __param(0, (0, common_1.Param)('analysisId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DocumentController.prototype, "list", null);
exports.DocumentController = DocumentController = __decorate([
    (0, common_1.Controller)('/api/v1'),
    __metadata("design:paramtypes", [list_documents_usecase_1.ListDocumentsUseCase])
], DocumentController);
