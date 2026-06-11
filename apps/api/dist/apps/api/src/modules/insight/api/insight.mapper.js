"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapInsightList = void 0;
const mapInsightList = (items) => items.map((insight) => ({
    id: insight.id,
    category: insight.insightType,
    statement: insight.description,
    certainty: insight.certainty,
    reviewStatus: insight.reviewStatus,
    confidence: insight.confidence ?? null,
    evidence: insight.evidenceLinks.map((link) => ({
        id: link.evidence.id,
        sourceType: link.evidence.sourceType,
        filePath: link.evidence.sourcePath,
        startLine: link.evidence.startLine,
        endLine: link.evidence.endLine,
        excerpt: link.evidence.excerpt,
    })),
}));
exports.mapInsightList = mapInsightList;
