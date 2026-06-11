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
exports.ArtifactController = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("../../../../../../packages/contracts/src/index.ts");
const list_artifacts_usecase_1 = require("../application/list-artifacts.usecase");
let ArtifactController = class ArtifactController {
    constructor(listArtifacts) {
        this.listArtifacts = listArtifacts;
    }
    async list(snapshotId) {
        const items = await this.listArtifacts.execute(snapshotId);
        const mapped = items.map((artifact) => ({
            id: artifact.id,
            artifactKey: artifact.artifactKey,
            name: artifact.name,
            artifactType: artifact.artifactType,
            filePath: artifact.filePath,
            startLine: artifact.startLine,
            endLine: artifact.endLine,
            language: artifact.language,
        }));
        return contracts_1.artifactListResponseSchema.parse({ items: mapped });
    }
};
exports.ArtifactController = ArtifactController;
__decorate([
    (0, common_1.Get)('/snapshots/:snapshotId/artifacts'),
    __param(0, (0, common_1.Param)('snapshotId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ArtifactController.prototype, "list", null);
exports.ArtifactController = ArtifactController = __decorate([
    (0, common_1.Controller)('/api/v1'),
    __metadata("design:paramtypes", [list_artifacts_usecase_1.ListArtifactsUseCase])
], ArtifactController);
