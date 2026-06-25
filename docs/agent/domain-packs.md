# Domain Packs

## Purpose

Domain packs are bounded domain profiles used as hints for retrieval, wording,
risk templates, QA scenario templates, and evaluation grouping.

They are not evidence. A pack may suggest that refund policy is important, but
only persisted `Evidence` linked to the analyzed snapshot or requirement
revision can support an `EVIDENCED` insight.

## Registry

The built-in domain profile registry lives in:

```text
apps/api/src/modules/domain-pack/application/domain-pack.registry.ts
```

Each public profile exposes:

```text
id
name
version
status
description
glossaryMetadata
```

Registry summaries must stay bounded and must not expose executable hint bodies
such as retrieval hints, risk templates, QA templates, unknown templates, prompt
payloads, source code, or evidence excerpts.

## Capability Status

Status values:

```text
STABLE        Supported MVP domain with explicit evaluation coverage.
PARTIAL       Bounded domain support exists, but documented gaps remain.
EXPERIMENTAL  Internal or exploratory profile; not a product support claim.
FALLBACK      Safe empty/default profile used when no specific profile applies.
```

Current profiles:

| Profile | Status | Notes |
| --- | --- | --- |
| `booking@0.1.0` | `STABLE` | MVP Booking / Payment / Refund domain with P7C fixture-backed coverage for cancellation, refund, double-refund prevention, inventory release, and payment state. |
| `general@0.0.0` | `FALLBACK` | Empty safe default with P7D defensive coverage; no booking-specific hints. |

Do not claim broad multi-domain support until each new profile has status,
limits, evaluation cases, and fallback behavior documented.

`booking@0.1.0` `STABLE` means the current fixture-backed evaluation set covers
the MVP booking cancellation/refund slice. It does not claim complete booking
runtime support, broad multi-domain behavior, or Vietnamese product mode.

`general@0.0.0` `FALLBACK` means no supported domain profile was selected. It
must stay conservative: no concepts, no retrieval hints, no risk/QA/unknown
templates, and no glossary metadata. Fallback diagnostics may expose bounded
metadata such as id, version, status, selectedBy, and counts, but must not
expose template bodies, prompt payloads, source code, or evidence excerpts.

## Glossary Metadata

Booking has static English and Vietnamese glossary assets under:

```text
packages/domain-packs/booking/en.glossary.json
packages/domain-packs/booking/vi.glossary.json
```

The registry exposes only metadata for these assets: locale, glossary status,
version, and term count. Glossary assets remain terminology references. P7A does
not introduce Vietnamese runtime output, scanner changes, or new AI behavior.

## Adding A Profile

Before adding a new `PARTIAL` or `STABLE` profile:

1. Define explicit capability status and limits.
2. Keep `general@0.0.0` as the fallback for unknown or unsupported domains.
3. Add deterministic registry and concept-matching tests.
4. Add evaluation cases before claiming quality improvements.
5. Prove hints cannot create `EVIDENCED` impact without persisted evidence.
