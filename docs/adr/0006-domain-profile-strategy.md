# ADR-0006: Domain Profile Strategy

- **Status**: Superseded by `docs/agent/domain-packs.md`
- **Date**: 2026-05-28
- **Superseded**: 2026-06-27

## Context

This ADR recorded the original static `DomainProfile` direction for domain
terminology, prompt context, retrieval hints, risk categories, and QA scenario
patterns.

That design has been replaced by the Domain Pack registry.

## Current Decision

Runtime domain terminology, capability status, and bounded hint metadata come
from `apps/api/src/modules/domain-pack/application/domain-pack.registry.ts`.

The legacy `domain-profile` helpers and duplicated static profile modules were
removed so the system has one runtime registry and no BOOKING-by-default
fallback path.

## Preserved Invariants

- Domain packs are hints, not evidence.
- `EVIDENCED` claims still require persisted source evidence.
- Unknown or unsupported domains use `general@0.0.0` with `FALLBACK` status.
- Frontend components render backend-authored domain-pack status; they do not
  infer capability from scanner profile strings or domain ids.
- Adding a new domain requires explicit status, limits, evaluation cases, and
  documentation in `docs/agent/domain-packs.md`.
