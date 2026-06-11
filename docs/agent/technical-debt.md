# Technical Debt

This document tracks intentional shortcuts taken for the MVP and backend testing phases that must be resolved before a real production deployment.

## TD-001: Fake providers must not run in production
- **Current State**: `AiModule` and `EmbeddingModule` fall back to `fake` providers if environment variables are missing. We added a boot guard so it throws in production, but we still need to configure the real providers.
- **Resolution**: Ensure all production deployments provide valid `AI_PROVIDER` and `EMBEDDING_PROVIDER` along with required API keys.

## TD-002: Domain must come from request/project config
- **Current State**: `domain` is passed to the retrieval service, falling back to `BOOKING` if not provided. In the future, it should be rigorously pulled from `Organization`/`Project` settings.
- **Resolution**: Implement DB-backed `DomainProfile` and allow project-level overrides.

## TD-003: Workspace boundary is still project-scoped
- **Current State**: Dev-login/auth/RBAC exists, but `projectId` is still the MVP-level workspace boundary. Project membership, organization/team scoping, production-grade credentials auth, and private repository authorization are still future work.
- **Resolution**: Introduce the project membership/organization model and migrate `tenantId` to the eventual organization-scoped boundary. Update vector search and retrieval filters accordingly.

## TD-004: Evidence mapping robustness
- **Current State**: If an AI provider returns an evidence key that cannot be resolved against the snapshot, we silently ignore it (or in the first iteration, we only mapped `evidenceKeys[0]`).
- **Resolution**: Fully handle unresolved keys by logging warnings, marking the insight as having a validation issue, or downgrading its certainty.

## TD-005: Real embedding provider requires batching
- **Current State**: `EmbedSnapshotArtifactsUseCase` sends all chunks to the embedding provider at once. This works for the fake provider but will hit rate limits with real providers (OpenAI/Gemini).
- **Resolution**: Implement configurable batching (`EMBEDDING_BATCH_SIZE`) and rate limiting/retries before switching to a real provider.
