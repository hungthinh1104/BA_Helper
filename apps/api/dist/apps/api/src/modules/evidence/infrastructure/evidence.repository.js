"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvidenceRepository = void 0;
class EvidenceRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listByAnalysis(params) {
        return this.prisma.evidence.findMany({
            where: {
                OR: [
                    { snapshotId: params.snapshotId },
                    { requirementRevisionId: params.revisionId },
                ],
            },
        });
    }
    async upsertMany(items) {
        if (items.length === 0) {
            return [];
        }
        await this.prisma.evidence.createMany({
            data: items.map((item) => ({
                provenanceKey: item.provenanceKey,
                sourceType: item.sourceType,
                snapshotId: item.snapshotId ?? null,
                artifactId: item.artifactId ?? null,
                requirementRevisionId: item.requirementRevisionId ?? null,
                sourcePath: item.sourcePath ?? null,
                startLine: item.startLine ?? null,
                endLine: item.endLine ?? null,
                excerpt: item.excerpt,
                contentHash: item.contentHash,
                isRedacted: item.isRedacted,
                redactionMetadata: (item.redactionMetadata ?? null),
            })),
            skipDuplicates: true,
        });
        return this.prisma.evidence.findMany({
            where: {
                provenanceKey: { in: items.map((item) => item.provenanceKey) },
            },
        });
    }
}
exports.EvidenceRepository = EvidenceRepository;
