"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentModule = void 0;
const common_1 = require("@nestjs/common");
const document_controller_1 = require("./api/document.controller");
const list_documents_usecase_1 = require("./application/list-documents.usecase");
const document_repository_1 = require("./infrastructure/document.repository");
const prisma_module_1 = require("../prisma/prisma.module");
const prisma_service_1 = require("../prisma/prisma.service");
let DocumentModule = class DocumentModule {
};
exports.DocumentModule = DocumentModule;
exports.DocumentModule = DocumentModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [document_controller_1.DocumentController],
        providers: [
            {
                provide: 'DocumentRepository',
                useFactory: (prisma) => new document_repository_1.DocumentRepository(prisma),
                inject: [prisma_service_1.PrismaService],
            },
            {
                provide: list_documents_usecase_1.ListDocumentsUseCase,
                useFactory: (repo) => new list_documents_usecase_1.ListDocumentsUseCase(repo),
                inject: ['DocumentRepository'],
            },
        ],
        exports: ['DocumentRepository'],
    })
], DocumentModule);
