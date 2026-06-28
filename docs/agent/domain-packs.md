# Domain Packs

## Purpose

Domain packs are bounded domain profiles used as hints for retrieval, wording,
risk templates, QA scenario templates, and evaluation grouping.

They are not evidence. A pack may suggest that refund policy is important, but
only persisted `Evidence` linked to the analyzed snapshot or requirement
revision can support an `EVIDENCED` insight.

Domain packs are context adapters, not the product center:

```text
Domain pack = controlled terminology + risk/QA hint layer
Evidence = source of truth
Review = final authority
```

Adding a domain must improve evidence retrieval, unknown/risk quality, QA
scenario usefulness, or report provenance. A domain pack must never turn a
terminology match or template into a fact.

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

Runtime retrieval diagnostics and AI prompt context may use the selected
`DomainPack` concepts/templates as bounded hints. The selected pack is the
source of truth for runtime domain terminology; legacy `domain-profile` helpers
must not become a second runtime registry. Pack hints are never evidence and
must not create `EVIDENCED` impact without persisted source excerpts.

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
| `ecommerce@0.1.0` | `PARTIAL` | Explicit-select ecommerce order fulfillment profile for order, checkout, inventory reservation, shipment, return/refund, and customer notification workflows. No payment compliance, fraud scoring, or tax validation claim. |
| `general@0.0.0` | `FALLBACK` | Empty safe default with P7D defensive coverage; no booking-specific hints. |
| `healthcare@0.1.0` | `PARTIAL` | Explicit-select healthcare administrative workflow profile for scheduling, records, claims, billing, authorization, and order tracking. No clinical or compliance claim. |
| `rental@0.1.0` | `PARTIAL` | Bounded rental lifecycle profile with P7E fixture-backed coverage for deposits, room availability, and contract cancellation. |

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

`ecommerce@0.1.0` `PARTIAL` means the registry can identify bounded ecommerce
order fulfillment terminology and evaluation cases. Current coverage is limited
to order cancellation with inventory release, cart checkout inventory
reservation, and shipment consuming inventory reservation. It does not provide
payment compliance validation, fraud or risk scoring, tax calculation
validation, or complete order-management support. Ecommerce is explicit-select
only and is not auto-detected by the scanner.

`healthcare@0.1.0` `PARTIAL` means the registry can identify bounded healthcare
administrative workflow terminology and evaluation cases. It does not provide
medical advice, clinical decision support, diagnosis/treatment reasoning, HIPAA
or compliance validation, or PHI detection beyond existing input-quality and
redaction rules. Healthcare is explicit-select only; scanner profile strings
must not auto-select it.

`rental@0.1.0` `PARTIAL` means the registry can identify bounded rental
terminology and evaluation cases, but the product does not claim full rental
domain support. Current coverage is limited to deposit payment consistency,
room availability through a booking request, and contract cancellation effects
on payment records plus tenant/landlord notification. Maintenance request terms
exist only as terminology/noise coverage in this revision. Rental is explicit-
select only and is not auto-detected by the scanner.

## Glossary Metadata

Booking has static English and Vietnamese glossary assets under:

```text
packages/domain-packs/booking/en.glossary.json
packages/domain-packs/booking/vi.glossary.json
```

Rental has static English and Vietnamese glossary assets under:

```text
packages/domain-packs/rental/profile.json
packages/domain-packs/rental/en.glossary.json
packages/domain-packs/rental/vi.glossary.json
```

Healthcare admin workflows have static English and Vietnamese glossary assets
under:

```text
packages/domain-packs/healthcare/profile.json
packages/domain-packs/healthcare/en.glossary.json
packages/domain-packs/healthcare/vi.glossary.json
```

Ecommerce order fulfillment has static English and Vietnamese glossary assets
under:

```text
packages/domain-packs/ecommerce/profile.json
packages/domain-packs/ecommerce/en.glossary.json
packages/domain-packs/ecommerce/vi.glossary.json
```

The registry exposes only metadata for these assets: locale, glossary status,
version, and term count. Glossary assets remain terminology references. Domain
profile additions do not introduce Vietnamese runtime output, scanner changes,
or new AI behavior.

Runtime selection is backend-owned. API clients may send `domainPackId` using a
backend registry value such as `healthcare@0.1.0`; the backend persists resolved
canonical metadata on the analysis as first-class fields:

```json
{
  "requestedDomainPackId": "healthcare",
  "resolvedDomainPackId": "healthcare",
  "resolvedDomainPackVersion": "0.1.0",
  "resolvedDomainPackStatus": "PARTIAL",
  "selectedBy": "EXPLICIT",
  "resolvedAt": "2026-06-27T00:00:00.000Z"
}
```

The worker and report renderer use this persisted resolved metadata. They must
not reinterpret a transient queue payload or frontend label.

For compatibility, analysis metadata may also contain `selectedDomainPack`,
`domainPack`, and `reportProvenance`, but those JSON fields are not the primary
source of truth for new records. New runtime paths read first-class columns
first and use metadata only for legacy rows.

Report provenance must include the resolved domain pack identity:

```json
{
  "requestedDomainPackId": "healthcare",
  "domainPackId": "healthcare",
  "domainPackVersion": "0.1.0",
  "domainPackStatus": "PARTIAL",
  "selectedBy": "EXPLICIT",
  "resolvedAt": "2026-06-27T00:00:00.000Z",
  "manifestDigest": null,
  "registryVersion": null
}
```

`domainPackManifestDigest` and `domainPackRegistryVersion` are nullable for
legacy reports and for records created before manifest-source hardening. Do not
populate them with placeholder values.

Workspace and report UI must render capability status from backend-authored
domain-pack metadata. Frontend components may localize labels for `STABLE`,
`PARTIAL`, `EXPERIMENTAL`, and `FALLBACK`, but must not infer capability status
from a domain id or scanner profile string.

## Governance Validation

Run the domain-pack governance check before adding or changing packs:

```bash
pnpm verify:domain-packs
```

The check validates only pack definitions, registry metadata, and glossary
metadata. It must not call scanner, retrieval, LLM, DB, Prisma, or worker code.

The check fails hard for:

```text
invalid pack id or semver version
multiple active versions for one domain id
duplicate canonical pack version
duplicate alias across packs
duplicate concept key inside one pack
PARTIAL pack without known limits
PARTIAL pack that does not require explicit selection
healthcare/admin pack without medical/clinical/compliance safety limits
glossary termCount mismatch
```

Current registry policy:

```text
BA Helper supports one active version per domain id in the built-in registry.
Short aliases such as "healthcare" must resolve to exactly one canonical pack
version.
Parallel active versions for the same domain id are not enabled yet.
```

Version bumps are required when behavior-affecting or materially user-visible
pack semantics change:

```text
concepts
retrieval hints
risk templates
QA templates
unknown templates
glossary semantics or term counts
safety limits or known limits
```

Current `manifestDigest` is a deterministic hash over canonical pack content
plus registry metadata such as aliases, display name, known limits, and explicit
selection policy. It intentionally excludes runtime-only values such as
`resolvedAt`, `selectedBy`, environment variables, DB state, and registry
response order. The digest may change for both analytical content changes and
presentation or registry metadata changes.

Future production policy may split this into:

```text
executionDigest  concepts, retrieval hints, templates, glossary metadata
registryDigest   aliases, display name, status, known limits, selection policy
```

Future parallel-version support should allow the same `pack.id` across
different versions, reject only duplicate `${id}@${version}`, and keep each
short alias mapped to one active version unless alias resolution explicitly
supports versioned channels.

Do not mutate an existing released domain pack version silently. If concepts,
templates, glossary semantics, aliases, limits, or other manifest semantics
change, bump the pack version or intentionally record a new manifest digest.

## Adding A Profile

Before adding a new `PARTIAL` or `STABLE` profile:

1. Define explicit capability status and limits.
2. Keep `general@0.0.0` as the fallback for unknown or unsupported domains.
3. Add deterministic registry and concept-matching tests.
4. Add evaluation cases before claiming quality improvements.
5. Prove hints cannot create `EVIDENCED` impact without persisted evidence.
