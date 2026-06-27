// Application use cases
export { RunImpactAnalysisUseCase } from './application/run-impact-analysis.usecase';
export { ImpactEvidenceCollectionStep } from './application/steps/impact-evidence-collection.step';
export { ImpactAiReasoningStep } from './application/steps/impact-ai-reasoning.step';
export { ImpactDiagnosticPropagationStep } from './application/steps/impact-diagnostic-propagation.step';
export { buildDomainPackPromptContext } from './domain/domain-pack-context';

// Ports
export type { ImpactAnalysisRepositoryPort, ImpactAnalysisRecord, ImpactAnalysisStatusUpdate } from './ports/impact-analysis.repository.port';
export type { ArtifactRepositoryPort, PersistedArtifact } from './ports/artifact.repository.port';
export type { EvidenceRepositoryPort, EvidenceUpsertInput, EvidenceRecord } from './ports/evidence.repository.port';
export type { InsightRepositoryPort, InsightInputParams, InsightRecord } from './ports/insight.repository.port';
export type { TraceabilityRepositoryPort, TraceabilityUpsertInput, TraceabilityRecord } from './ports/traceability.repository.port';
export type { RetrievalPort, RetrievalRequest, RetrievedArtifact } from './ports/retrieval.port';
export { LlmProviderPort } from './ports/llm-provider.port';
export type { LlmRequest, LlmRequestOptions, LlmCallMetadata, LlmResult } from './ports/llm-provider.port';
export type { EventLogPort } from './ports/event-log.port';
export type { DomainPackSelectionPort, DomainPackSelectionInput, DomainPackSelectionResult } from './ports/domain-pack-selection.port';

// Domain types
export type { ImpactEvidenceCollectionResult, ImpactAiReasoningResult } from './domain/impact-analysis-step.types';
export { DiagnosticRiskEvaluator } from './domain/diagnostic-risk.evaluator';

// AI utilities (impact-analysis slice only)
export { AiOutputError } from './ai/ai.errors';
export type { AiOutputErrorCode } from './ai/ai.errors';
export { impactAnalysisAiSchema } from './ai/ai.schema';
export type { ImpactAnalysisAiResponse } from './ai/ai.schema';
export { EvidencePackFormatter } from './ai/evidence-pack.formatter';
export type { EvidenceCandidate } from './ai/evidence-pack.formatter';
export { renderPrompt } from './ai/prompt-registry';
