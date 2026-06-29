// Backend runtime exports
export * from './prisma/prisma.module';
export * from './prisma/prisma.service';

// To avoid deep module nesting, we re-export key infrastructure parts.
// We only export the modules and services needed by the runtime boundary.
export * from './event-log/event-log.module';
export * from './event-log/application/event-log.service';
export * from './event-log/infrastructure/event-log.repository';
export * from './event-log/infrastructure/event-log-port.adapter';
export * from './event-log/domain/event-log.policy';

export * from './ai/ai.module';
export * from './ai/infrastructure/fake-ai.provider';
export * from './ai/infrastructure/openai.provider';
export * from './ai/infrastructure/anthropic.provider';
export * from './ai/infrastructure/google.provider';
export * from './ai/infrastructure/deepseek.provider';

export * from './scanner/infrastructure/scan-job.repository';
export * from './scanner/application/run-scan-job.usecase';
export * from './scanner/application/run-scan-job-persistence.step';
export * from './scanner/domain/scan-job.policy';

export * from './repository/infrastructure/repository.repository';
export * from './impact-analysis/infrastructure/impact-analysis.repository';
export * from './impact-analysis/infrastructure/review-note.repository';
export * from './impact-analysis/infrastructure/review-clarification.repository';
export * from './impact-analysis/infrastructure/review-decision.repository';
export * from './artifact/infrastructure/artifact.repository';
export * from './evidence/infrastructure/evidence.repository';
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
export * from './document/application/run-document-job.usecase';
export * from './localization/localization.module';
export * from './localization/application/report-localization.service';
export * from './document/application/markdown-impact-report.types';
