// Backend runtime exports
export * from './prisma/prisma.module';
export * from './prisma/prisma.service';

// To avoid deep module nesting, we re-export key infrastructure parts.
// We only export the modules and services needed by the runtime boundary.
export * from './event-log/event-log.module';
export * from './event-log/application/event-log.service';
export * from './event-log/infrastructure/event-log.repository';
export * from './event-log/infrastructure/event-log-port.adapter';

export * from './ai/ai.module';
export * from './ai/infrastructure/fake-ai.provider';
export * from './ai/infrastructure/openai.provider';
export * from './ai/infrastructure/anthropic.provider';
export * from './ai/infrastructure/google.provider';
export * from './ai/infrastructure/deepseek.provider';

export * from './scanner/infrastructure/scan-job.repository';
export * from './scanner/infrastructure/runtime-scan-job-runner.adapter';
export * from './scanner/scanner-runtime.module';
export * from './scanner/application/run-scan-job-persistence.step';
export * from './scanner/application/incremental-scan-classifier';
export * from './scanner/application/scan-diagnostic-summary';
export * from './scanner/application/scan-persistence-mappers';
export * from './scanner/application/scan-workspace-cleanup.policy';

export * from './repository/infrastructure/repository.repository';
export * from './impact-analysis/infrastructure/impact-analysis.repository';
export * from './impact-analysis/infrastructure/review-note.repository';
export * from './impact-analysis/infrastructure/review-clarification.repository';
export * from './impact-analysis/infrastructure/review-decision.repository';
export * from './impact-analysis/infrastructure/multi-repo-analysis-run.repository';
export * from './impact-analysis/infrastructure/multi-repo-merged-report.repository';
export * from './impact-analysis/infrastructure/merged-multi-repo-report-review-decision.repository';
export * from './impact-analysis/infrastructure/get-impact-diff.provider';
export * from './artifact/infrastructure/artifact.repository';
export * from './evidence/infrastructure/evidence.repository';
export * from './clarification/infrastructure/clarification.repository';
export * from './graph/infrastructure/graph.repository';
export * from './traceability/infrastructure/traceability.repository';
export * from './insight/infrastructure/insight.repository';
export * from './document/infrastructure/document.repository';
export * from './document/document-runtime.module';

export * from './domain-pack/domain-pack.module';
export * from './domain-pack/application/domain-pack.registry';
export * from './domain-pack/packs/booking.v0.1.0';
export * from './domain-pack/packs/ecommerce.v0.1.0';
export * from './domain-pack/packs/general.v0.0.0';
export * from './domain-pack/packs/healthcare.v0.1.0';
export * from './domain-pack/packs/rental.v0.1.0';
export * from './retrieval/retrieval.module';
export * from './retrieval/application/hybrid-retrieval.service';
export * from './embedding/infrastructure/embedding-chunk.repository';
export * from './embedding/infrastructure/fake-embedding.provider';

export * from './queue/queue.module';
export * from './queue/queue.service';
export * from './document/infrastructure/runtime-document-job-runner.adapter';
export * from './localization/localization.module';
export * from './localization/application/report-localization.service';
export { computeCanonicalReportHash } from './localization/domain/report-hash';
export * from './document/application/markdown-impact-report.types';
export * from './document/application/render/markdown-impact-report.builder';
export * from './document/application/render/reviewed-snapshot-report-context.adapter';
export * from './document/application/mermaid-impact-diagram.builder';
export * from './document/application/evaluation-context.adapter';
export * from './document/application/report-review-coverage.summary';
export * from './document/application/evidence-quality.annotator';
export * from './document/application/evidence-quality.rules';
export * from './document/application/evidence-quality.types';
export * from './document/domain/approved-report-metadata';
export * from './document/application/render/report-localization.types';
export * from './document/application/render/report-localization';
export * from './artifact/domain/universal-artifact-kind';
export * from './impact-analysis/infrastructure/analyzer-version';
export * from './impact-analysis/domain/impact-analysis.types';
export * from './ai/domain/llm-provider.interface';
export * from './ai/domain/ai-config';
export * from './ai/domain/ai.schema';
export * from './ai/domain/ai.errors';
export * from './ai/domain/prompt-registry';
export * from './ai/application/evidence-pack.formatter';
export * from './ai/application/ai.service';
