"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapEvidenceList = void 0;
const mapEvidenceList = (items) => items.map((evidence) => ({
    id: evidence.id,
    sourceType: evidence.sourceType,
    filePath: evidence.sourcePath,
    startLine: evidence.startLine,
    endLine: evidence.endLine,
    excerpt: evidence.excerpt,
}));
exports.mapEvidenceList = mapEvidenceList;
