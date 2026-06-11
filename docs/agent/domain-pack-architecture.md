# Domain Pack Architecture

## Overview

The Domain Pack architecture provides a structured, versioned mechanism to inject domain-specific hints into the Requirement-to-Code Impact Analyzer.

**Domain packs are hints only.** They provide guidance for retrieval, risk analysis, and QA scenario generation. They are *not* sources of truth. The final source of truth for an impact analysis must always be the extracted code evidence.

## Selection Rules

Domain packs are selected through the `DomainPackRegistry` based on the repository's configuration.

- If a repository specifies a `domain` (e.g., in its profile or through manual configuration), the registry will attempt to load the matching domain pack.
- If the domain is unknown, missing, or unrecognized, the registry **will safely fall back to the `general@0.0.0` default pack.**
- The `booking@0.1.0` pack is never globally applied to unknown repositories.

## Evidence Hierarchy

The fundamental rule of the impact analyzer is that all impacts must be backed by evidence from the codebase.

1. **Evidence is King:** An impact is only marked as `EVIDENCED` if there is a verified snippet of code confirming the behavior.
2. **Hints are Guides:** A domain pack may suggest that a "booking cancellation" should involve a "refund". The AI will use this hint to search for refund logic.
3. **Missing Evidence:** If the domain pack suggests a refund should occur, but no code evidence supports it, the system must produce an `UNKNOWN`, `RISK`, or `QUESTION` insight. It must never fabricate an `EVIDENCED` impact based solely on the domain pack's suggestion.

## Evaluation & Metrics

Domain pack heuristics are evaluated internally to measure improvement in artifact recall and unknown/risk generation. 

- Evaluation cases declare their `expectedConceptKeys` and `packId` to verify deterministic concept matching.
- Real retrieval smoke tests verify that domain hints positively influence scoring and lexical filtering.
- Strict CI checks guarantee that domain hints cannot generate `EVIDENCED` impacts on their own. The engine's diagnostic `DOMAIN_PACK_APPLIED` proves which pack ran, but explicitly excludes generating text that might masquerade as real code facts.

## Built-in Packs

Currently, the system ships with:

- `booking@0.1.0`: The primary testbed domain, covering bookings, payments, refunds, and notifications.
- `general@0.0.0`: The safe empty default for unknown repositories.

We keep the number of built-in packs narrow to focus on the core capability of the Requirement-to-Code Impact Analyzer rather than turning it into a generic business rule generator.

## Versioning Rules

Domain packs include a semver version string (e.g., `0.1.0`). As domain concepts evolve, the version should be bumped. When retrieving an analysis, the version of the domain pack applied at the time is recorded in the `DOMAIN_PACK_APPLIED` diagnostic metadata, ensuring reproducibility.

## How to Add a Future Pack

1. Create a new file in `apps/api/src/modules/domain-pack/packs/` (e.g., `healthcare.v0.1.0.ts`).
2. Define the `DomainPack` following the schema, including concepts, retrieval hints, risk templates, QA templates, and unknown templates.
3. Register the pack in `apps/api/src/modules/domain-pack/application/domain-pack.registry.ts`.
4. Ensure the fallback logic still returns `general@0.0.0` when appropriate.
