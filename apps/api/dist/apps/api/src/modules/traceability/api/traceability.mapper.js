"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapTraceabilityList = void 0;
const mapTraceabilityList = (items) => items.map((link) => ({
    id: link.id,
    artifactId: link.artifactId,
    linkType: link.linkType,
    linkBasis: link.linkBasis,
    reviewStatus: link.reviewStatus,
    confidence: link.confidence ?? null,
    evidence: link.evidenceLinks.map((evidenceLink) => ({
        id: evidenceLink.evidence.id,
        sourceType: evidenceLink.evidence.sourceType,
        filePath: evidenceLink.evidence.sourcePath,
        startLine: evidenceLink.evidence.startLine,
        endLine: evidenceLink.evidence.endLine,
        excerpt: evidenceLink.evidence.excerpt,
    })),
}));
exports.mapTraceabilityList = mapTraceabilityList;
