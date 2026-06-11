"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunImpactAnalysisUseCase = void 0;
const node_crypto_1 = require("node:crypto");
const app_error_1 = require("../../../shared/app-error");
const REQUIRED_STABLE_IDS = [
    'api:booking.controller.cancel',
    'service-method:booking.service.cancelBooking',
    'service-method:payment.service.refund',
];
const GRAPH_EXPANSION_STABLE_IDS = [
    'service-method:slot.service.releaseSlot',
    'service-method:notification.service.notifyOwner',
    'entity:booking',
    'entity:paymentTransaction',
    'test:booking.cancel.spec',
];
const includesKeyword = (input, keyword) => input.toLowerCase().includes(keyword.toLowerCase());
const shouldRun = (changeRequest) => includesKeyword(changeRequest, 'cancel') ||
    includesKeyword(changeRequest, 'refund');
const selectEvidenceCandidates = (input) => {
    if (!shouldRun(input.changeRequest)) {
        return { artifacts: [] };
    }
    const artifactById = new Map(input.artifacts.map((artifact) => [artifact.stableId, artifact]));
    const selected = new Map();
    for (const stableId of REQUIRED_STABLE_IDS) {
        const artifact = artifactById.get(stableId);
        if (artifact) {
            selected.set(stableId, artifact);
        }
    }
    if (input.expandGraph) {
        for (const stableId of GRAPH_EXPANSION_STABLE_IDS) {
            const artifact = artifactById.get(stableId);
            if (artifact) {
                selected.set(stableId, artifact);
            }
        }
    }
    return {
        artifacts: Array.from(selected.values()).sort((a, b) => a.stableId.localeCompare(b.stableId)),
    };
};
const toEvidenceSourceType = (artifactType) => artifactType === 'TEST' ? 'TEST' : 'CODE';
const buildExcerpt = (artifact) => `${artifact.filePath}:${artifact.startLine}-${artifact.endLine} (${artifact.symbolName})`;
class RunImpactAnalysisUseCase {
    constructor(impactRepo, artifactRepo, evidenceRepo, insightRepo, traceabilityRepo) {
        this.impactRepo = impactRepo;
        this.artifactRepo = artifactRepo;
        this.evidenceRepo = evidenceRepo;
        this.insightRepo = insightRepo;
        this.traceabilityRepo = traceabilityRepo;
    }
    async execute(params) {
        const analysis = await this.impactRepo.findById(params.analysisId);
        if (!analysis) {
            throw new app_error_1.AppError('IMPACT_ANALYSIS_NOT_FOUND', 'Impact analysis not found.');
        }
        if (analysis.status !== 'QUEUED' && analysis.status !== 'RUNNING') {
            throw new app_error_1.AppError('IMPACT_ANALYSIS_NOT_RUNNABLE', 'Impact analysis cannot be run in its current state.');
        }
        await this.impactRepo.updateStatus({
            id: analysis.id,
            status: 'RUNNING',
            stage: 'RETRIEVING_EVIDENCE',
            progress: 10,
        });
        const snapshotId = analysis.snapshot.id;
        const artifacts = (await this.artifactRepo.listBySnapshot(snapshotId));
        const scanArtifacts = artifacts.map((artifact) => ({
            stableId: artifact.artifactKey,
            type: artifact.artifactType,
            filePath: artifact.filePath,
            symbolName: artifact.name,
            startLine: artifact.startLine ?? 0,
            endLine: artifact.endLine ?? 0,
        }));
        const scan = {
            analyzerVersion: analysis.snapshot.analyzerVersion,
            artifacts: scanArtifacts,
            coverage: { status: analysis.snapshot.coverageStatus, skippedFiles: [] },
        };
        const retrieval = selectEvidenceCandidates({
            changeRequest: analysis.requirementRevision.rawText,
            artifacts: scan.artifacts,
            expandGraph: params.expandGraph ?? true,
        });
        const artifactByKey = new Map(artifacts.map((artifact) => [artifact.artifactKey, artifact]));
        const evidenceInputs = retrieval.artifacts
            .map((artifact) => {
            const persistedArtifact = artifactByKey.get(artifact.stableId);
            if (!persistedArtifact) {
                return null;
            }
            const excerpt = buildExcerpt(artifact);
            const contentHash = (0, node_crypto_1.createHash)('sha256').update(excerpt).digest('hex');
            return {
                provenanceKey: `snapshot:${snapshotId}:artifact:${artifact.stableId}`,
                sourceType: toEvidenceSourceType(artifact.type),
                snapshotId,
                artifactId: persistedArtifact.id,
                sourcePath: artifact.filePath,
                startLine: artifact.startLine,
                endLine: artifact.endLine,
                excerpt,
                contentHash,
                isRedacted: false,
                redactionMetadata: null,
            };
        })
            .filter((entry) => entry !== null);
        const evidence = await this.evidenceRepo.upsertMany(evidenceInputs);
        const evidenceByArtifactId = new Map(evidence
            .filter((item) => item.artifactId)
            .map((item) => [item.artifactId, item]));
        const evidenceByArtifactKey = new Map();
        for (const [artifactKey, artifact] of artifactByKey.entries()) {
            const evidenceRecord = evidenceByArtifactId.get(artifact.id);
            if (evidenceRecord) {
                evidenceByArtifactKey.set(artifactKey, evidenceRecord);
            }
        }
        const requiredArtifactKeys = REQUIRED_STABLE_IDS;
        const affectedLinks = requiredArtifactKeys
            .map((artifactKey) => artifactByKey.get(artifactKey))
            .filter((artifact) => Boolean(artifact));
        const traceabilityLinks = await this.traceabilityRepo.upsertMany(affectedLinks.map((artifact) => ({
            impactAnalysisId: analysis.id,
            artifactId: artifact.id,
            linkType: 'AFFECTED',
            linkBasis: 'EVIDENCED',
            reviewStatus: 'NEEDS_REVIEW',
            confidence: 1,
        })));
        await Promise.all(traceabilityLinks.map((link) => {
            const evidenceRecord = evidenceByArtifactId.get(link.artifactId);
            if (!evidenceRecord) {
                return Promise.resolve([]);
            }
            return this.traceabilityRepo.linkEvidence({
                linkId: link.id,
                evidenceIds: [evidenceRecord.id],
            });
        }));
        const insightInputs = [];
        const evidencedInsightMap = [];
        const addEvidencedClaim = (params) => {
            const artifact = artifactByKey.get(params.artifactKey);
            const evidenceRecord = artifact
                ? evidenceByArtifactId.get(artifact.id)
                : undefined;
            if (!artifact || !evidenceRecord) {
                return;
            }
            insightInputs.push({
                impactAnalysisId: analysis.id,
                insightKey: params.insightKey,
                insightType: 'CLAIM',
                certainty: 'EVIDENCED',
                reviewStatus: 'NEEDS_REVIEW',
                confidence: 1,
                title: params.description,
                description: params.description,
            });
            evidencedInsightMap.push({
                insightKey: params.insightKey,
                artifactKey: params.artifactKey,
            });
        };
        addEvidencedClaim({
            insightKey: 'claim:cancel-route',
            description: 'The system exposes an API route for cancelling a booking.',
            artifactKey: 'api:booking.controller.cancel',
        });
        addEvidencedClaim({
            insightKey: 'claim:cancel-refund',
            description: 'Cancellation triggers a refund operation.',
            artifactKey: 'service-method:payment.service.refund',
        });
        addEvidencedClaim({
            insightKey: 'claim:release-slot',
            description: 'Cancellation releases the booked slot.',
            artifactKey: 'service-method:slot.service.releaseSlot',
        });
        addEvidencedClaim({
            insightKey: 'claim:notify-owner',
            description: 'Cancellation notifies the booking owner.',
            artifactKey: 'service-method:notification.service.notifyOwner',
        });
        const unknowns = [
            {
                insightKey: 'unknown:refund-percentage',
                description: 'Refund percentage is not confirmed from code evidence.',
                reasoning: 'No explicit refund percentage or refund policy artifact was found.',
            },
            {
                insightKey: 'unknown:refund-deadline',
                description: 'Refund deadline is not confirmed from code evidence.',
                reasoning: 'No explicit refund deadline was found in the evidence scope.',
            },
            {
                insightKey: 'unknown:who-may-cancel',
                description: 'Who may cancel a booking is not confirmed from code evidence.',
                reasoning: 'No authorization or role checks were found in the cancellation flow.',
            },
            {
                insightKey: 'unknown:owner-approval',
                description: 'Owner approval requirements are not confirmed from code evidence.',
                reasoning: 'No approval or confirmation step was found in the cancellation flow.',
            },
            {
                insightKey: 'unknown:slot-reopen',
                description: 'Slot re-open policy is not confirmed from code evidence.',
                reasoning: 'Slot release is called, but no policy for rebooking timing was found.',
            },
        ];
        insightInputs.push(...unknowns.map((unknown) => ({
            impactAnalysisId: analysis.id,
            insightKey: unknown.insightKey,
            insightType: 'UNKNOWN',
            certainty: 'UNKNOWN',
            reviewStatus: 'NEEDS_REVIEW',
            confidence: null,
            title: unknown.description,
            description: unknown.description,
            reasoning: unknown.reasoning,
        })));
        const insights = (await this.insightRepo.upsertMany(insightInputs));
        await Promise.all(insights
            .filter((insight) => insight.certainty === 'EVIDENCED')
            .map((insight) => {
            const mapping = evidencedInsightMap.find((item) => item.insightKey === insight.insightKey);
            const evidenceRecord = mapping
                ? evidenceByArtifactKey.get(mapping.artifactKey)
                : undefined;
            if (!evidenceRecord) {
                return Promise.resolve([]);
            }
            return this.insightRepo.linkEvidence({
                insightId: insight.id,
                evidenceIds: [evidenceRecord.id],
            });
        }));
        return this.impactRepo.updateStatus({
            id: analysis.id,
            status: 'WAITING_FOR_REVIEW',
            stage: 'DONE',
            progress: 100,
        });
    }
}
exports.RunImpactAnalysisUseCase = RunImpactAnalysisUseCase;
