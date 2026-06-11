# ADR-0006: Domain Profile Strategy

- **Status**: Accepted
- **Date**: 2026-05-28
- **Deciders**: Engineering + BA

---

## Context

The core impact analysis engine (`Requirement → Evidence → Artifact → Insight`) is
domain-agnostic. However, different business domains (Booking, Logistics, Healthcare,
Finance) have distinct vocabulary, risk categories, and QA scenario patterns.

Two wrong approaches were explicitly rejected:

1. **Separate UI per domain** — hard to maintain, duplicates the core workspace.
2. **Static generic risk generation** — generating risks based on domain category alone,
   without grounding in code evidence, produces hallucinated, low-value output.

---

## Decision

### Two-layer DomainProfile architecture

**MVP (current):**

```text
Static DomainProfile config file per domain
No Prisma model for DomainProfile
Injected into AI reasoning context and retrieval pipeline
```

**Future (B2B scale):**

```text
DB-backed DomainProfile (seed from static configs)
ProjectDomainOverride per company/project (e.g., "consignment" overrides "shipment")
Managed via API, not hardcoded
```

### Prompt injection rule

`DomainProfile` is injected into prompts in a **targeted, minimal** way:

```text
systemPrompt =
  base AI rules
  + DomainProfile.promptContext   ← short domain context paragraph only

userPrompt =
  changeRequest
  + retrieved evidence
  + DomainProfile.riskCategories  ← as focus areas/hints, not full glossary
```

**Glossary is NOT dumped into prompts.** It is used exclusively for:

- Lexical search keyword expansion
- Artifact/domain concept matching in retrieval
- Surfacing domain-relevant symbols during evidence selection

### Evidence-grounding invariant

> **Domain risks MUST be grounded in persisted Evidence.**
> `DomainProfile.riskCategories` are retrieval and reasoning hints only.
> No domain risk insight (`BaInsight`) is valid without at least one linked `Evidence` record.

**Wrong:**
```text
domain = healthcare
→ auto-generate privacy risk   ✗
```

**Correct:**
```text
domain = healthcare
+ evidence: change touches PatientRecordService (persisted Evidence)
→ AI generates privacy/audit risk with evidence link   ✓
```

This is a concrete application of the existing global invariant in `AGENTS.md`:
> An `EVIDENCED` insight must link to at least one persisted `Evidence` record.

### File location

```text
apps/api/src/modules/domain-profile/profiles/<domain>.domain-profile.ts
```

`DomainProfile` is **not** an AI concern. It lives in its own `domain-profile` module.
When FE or other packages need it, move to `packages/shared/domain-profiles/`.

### What NOT to do

- Do not create a Prisma model for `DomainProfile` in MVP.
- Do not build separate UI workspaces per domain.
- Do not inject the full glossary into prompts.
- Do not generate `BaInsight` with `EVIDENCED` basis without an `Evidence` link.

---

## Consequences

- Adding a new domain = add one profile file + no DB migration.
- Domain risks are always traceable back to specific code evidence.
- Core UI layout (`Impact Analysis Workspace`) remains the same across all domains.
- Domain-specific sections (`Domain Risks`, `QA Scenarios`) are rendered using the
  active domain profile config, not hardcoded per domain.
- Future B2B customization path is clear without rewriting core logic.
