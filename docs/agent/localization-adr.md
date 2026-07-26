# Post-v0.1 Backlog: Localized Report Rendering

## Status

APPROVED as post-v0.1 backlog design.
DO NOT implement before v0.1 tag.

This is not part of v0.1 debt closure. It must only be implemented after the v0.1 boundary hardening is verified on the remote branch, including real `@ba-helper/backend-runtime` extraction, removal of `@ba-helper/api/*`, removal of worker imports from `apps/api/src`, and CI architecture checks.

---

## 1. Core Invariant

Analysis remains English-only and evidence-backed.

Localization is a derived presentation artifact over a canonical English approved report. It must not mutate canonical report data, create new insights, create evidence, change traceability, or invoke scanner/retrieval/impact-analysis use cases.

Canonical source:

English approved report / canonical structured report context. This is the technical/audit source for review, traceability, and export provenance.

Localized report:

A derived presentation artifact for a target locale such as `vi-VN`, `ja-JP`, or another supported BCP-47 locale. It is not the canonical review source.

---

## 2. Implementation Boundary

Localization transforms structured report context, validates invariants, then renders localized Markdown.

It must not blindly translate final Markdown, because Markdown translation can corrupt code fences, tables, anchors, file paths, evidence formatting, and traceability references.

Correct pipeline:

```txt
CanonicalReportContext EN
-> select translatable fields
-> translate selected text fields
-> validate structural invariants
-> LocalizedReportContext vi-VN
-> MarkdownImpactReportBuilder
-> LocalizedReportArtifact.contentMarkdown
```

Wrong pipeline:

```txt
English Markdown
-> LLM translate entire Markdown
-> save translated Markdown
```

The second approach is forbidden.

---

## 3. Component Design

Primary service name:

```txt
ReportLocalizationService
```

Alternative acceptable names:

```txt
LocalizedReportRenderer
ReportLocalizationRenderer
```

Do not call it `TranslationWorkerService` unless the implementation is actually queue-backed. If async processing is later needed, add a separate processor:

```txt
ReportLocalizationJobProcessor
```

Responsibilities of `ReportLocalizationService`:

```txt
1. Load canonical English approved report context.
2. Validate target locale against supported locale registry.
3. Load domain glossary for target locale.
4. Select only translatable fields from structured report context.
5. Call translation provider with strict schema.
6. Validate returned localized context structurally.
7. Render localized Markdown via MarkdownImpactReportBuilder.
8. Save LocalizedReportArtifact.
9. Mark FAILED and fallback to English if validation fails.
```

It must not call:

```txt
RunScanJobUseCase
RunImpactAnalysisUseCase
retrieval services
scanner/analyzer services
evidence collection steps
AI reasoning steps
```

Localization is not analysis.

---

## 4. Field Policy

### Never translate

These fields must remain byte-for-byte or value-equivalent unchanged:

```txt
id
analysisId
runId
snapshotId
repositoryId
artifactId
insightId
evidenceId
artifactKey
insightKey
evidenceKey
filePath
startLine
endLine
commitSha
symbolName
className
methodName
functionName
API route
HTTP method
enum
status
certainty
linkType
review decision
artifact reference
evidence reference
traceability link
```

### Quote or snippet policy

```txt
- Source code snippets: never translate.
- File paths, symbols, routes, method names: never translate.
- Requirement/business text quotes: preserve original quote.
- Never replace original quoteOrSnippet.
- Optionally add localizedExplanation beside the original quote.
```

Correct example:

```ts
{
  quoteOrSnippet: "return paymentService.refund(booking.id)",
  localizedExplanation: "Đoạn code này cho thấy luồng hủy có gọi xử lý hoàn tiền."
}
```

Wrong example:

```ts
{
  quoteOrSnippet: "Trả về thao tác hoàn tiền cho booking..."
}
```

### Translate allowed

Only human-facing presentation fields may be translated:

```txt
report title
section heading
human summary
risk description
unknown description
QA scenario description
recommended action
business explanation
review note label text
localizedExplanation
```

### Translate with glossary constraint

Domain terms must follow glossary:

```txt
cancellation
refund
booking
deposit
contract
tenant
landlord
inventory reservation
shipment
payment
approval
rejection
reservation
```

Glossary must be domain-aware and locale-aware.

---

## 5. Locale Registry Policy

Use BCP-47 locale tags.

Example registry:

```ts
export const supportedReportLocales = ['en', 'vi-VN', 'ja-JP'] as const;

export type SupportedReportLocale = typeof supportedReportLocales[number];
```

Rules:

```txt
1. Unsupported locale requests are rejected before localization starts.
2. Locale must be validated before creating a localization job/artifact.
3. English canonical report is always available.
4. Target locale cannot overwrite English canonical content.
```

---

## 6. Glossary Policy

Domain-specific localization must fail closed if glossary is unavailable.

Rule:

```txt
No glossary, no localized domain-specific report.
```

Failure code:

```txt
GLOSSARY_NOT_AVAILABLE
```

Generic UI/report labels may use static locale dictionaries, but domain-specific report content requires glossary.

Examples:

```txt
"Summary" -> can use static dictionary
"Cancellation policy" -> requires domain glossary
"Refund after booking cancellation" -> requires domain glossary
```

---

## 7. Database Design

Localized reports must be stored as derived artifacts, separate from canonical generated documents.

Recommended model:

```prisma
model LocalizedReportArtifact {
  id                 String   @id @default(uuid())

  sourceDocumentId   String
  sourceDocument     GeneratedDocument @relation(fields: [sourceDocumentId], references: [id], onDelete: Cascade)

  locale             String   // BCP-47 locale tag, e.g. "vi-VN"
  sourceLocale       String   @default("en")
  localizationStatus LocalizationStatus

  contentMarkdown    String?
  sourceContentHash  String   // Hash of canonical structured report context

  glossaryVersion            String?
  provider                   String?
  model                      String?
  translationPromptVersion   String?
  structuralValidatorVersion String?
  fieldPolicyVersion         String?

  errorCode          String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@unique([sourceDocumentId, locale])
  @@index([sourceDocumentId])
  @@index([locale])
  @@index([localizationStatus])
}

enum LocalizationStatus {
  QUEUED
  COMPLETED
  FAILED
}
```

If Prisma requires a back-reference, add this to `GeneratedDocument`:

```prisma
localizedArtifacts LocalizedReportArtifact[]
```

---

## 8. Source Content Hash

`sourceContentHash` must be computed from a canonical JSON serialization of `CanonicalReportContext`.

It must not be computed from:

```txt
localized Markdown
non-deterministic object order
translated text
rendered HTML
client-side output
```

Recommended rule:

```txt
Hash source = canonical structured report context, not final Markdown.
```

If the canonical report context changes, existing localized artifacts whose `sourceContentHash` no longer matches must be considered stale and must not be served as current.

---

## 9. Localization Status Invariants

Application/service layer must enforce:

```txt
If localizationStatus = COMPLETED:
  contentMarkdown must be non-null.

If localizationStatus = FAILED:
  contentMarkdown must be null or ignored.
  errorCode should be present.

If localizationStatus = QUEUED:
  contentMarkdown must be null.
```

These can be enforced through service tests if Prisma/DB check constraints are not used.

---

## 10. Translation Prompt Constraint

The translation LLM must receive a narrow task. It must not analyze code or infer new business logic.

Base instruction:

```txt
You are localizing a finalized technical impact report. Do not infer new risks, do not add evidence, do not remove evidence, do not change IDs, keys, file paths, code symbols, enum values, statuses, line numbers, or snippets. Translate only fields explicitly marked as translatable.
```

Additional required instruction:

```txt
Preserve all IDs, artifact keys, evidence keys, file paths, code symbols, HTTP methods, enum values, certainty values, review decisions, and traceability references exactly. Do not create, remove, reorder, or merge array items. Return output that matches the provided schema exactly.
```

---

## 11. Structural Validation

The validator must enforce:

```txt
1. Same IDs.
2. Same artifact/evidence references.
3. Same file paths.
4. Same code symbols.
5. Same commit SHAs.
6. Same line numbers.
7. Same enum/status/certainty/linkType values.
8. Same array cardinality.
9. Same ordering unless explicitly allowed.
10. No new risks.
11. No new unknowns.
12. No new QA scenarios.
13. No new evidence.
14. No removed evidence.
15. No changed traceability links.
16. Raw source code snippets unchanged.
17. quoteOrSnippet preserved.
18. Only allowed fields are localized.
```

If validation fails:

```txt
localizationStatus = FAILED
errorCode = STRUCTURAL_VALIDATION_FAILED
fallback to English canonical report
do not save invalid localized Markdown as completed
```

---

## 12. Failure Behavior

Localization failure must not block canonical export.

Rules:

```txt
1. Canonical English report remains available.
2. Failed localization marks artifact/job as FAILED.
3. User sees fallback English report.
4. Failure is visible through status/errorCode.
5. Failed localization does not mutate canonical report.
6. Failed localization does not rerun analysis.
```

Common failure codes:

```txt
UNSUPPORTED_LOCALE
GLOSSARY_NOT_AVAILABLE
TRANSLATION_PROVIDER_FAILED
TRANSLATION_OUTPUT_INVALID
STRUCTURAL_VALIDATION_FAILED
SOURCE_DOCUMENT_NOT_FOUND
SOURCE_DOCUMENT_NOT_APPROVED
SOURCE_HASH_MISMATCH
```

---

## 13. Acceptance Criteria

1. Localized report preserves all IDs and artifact/evidence references.
2. File paths, code symbols, commit SHAs, and line numbers are unchanged.
3. Raw code snippets are unchanged.
4. Array cardinality is unchanged.
5. English canonical report remains available.
6. Localized report is marked as derived from English source.
7. Failed localization does not block canonical report export.
8. Glossary version is stored in metadata.
9. Output schema validation strictly enforces structural invariants.
10. Localized artifact stores `sourceContentHash` and `sourceDocumentId`.
11. Localization never calls scanner, retrieval, or impact-analysis use cases.
12. Localization prompt/output cannot create new risks, unknowns, QA scenarios, or evidence links.
13. Unsupported locale is rejected before localization starts.
14. Localization operates on structured report context, not raw full Markdown.
15. Existing localized artifact becomes stale if `sourceContentHash` no longer matches canonical source.
16. Glossary absence follows explicit policy: fail closed by default.
17. Code fences, Markdown tables, anchors, and evidence formatting are generated by the report builder, not by direct LLM translation of Markdown.
18. If `localizationStatus = COMPLETED`, `contentMarkdown` is non-null.
19. If `localizationStatus = FAILED`, invalid localized Markdown is not served as completed output.
20. Translation metadata includes provider, model, glossaryVersion, translationPromptVersion, structuralValidatorVersion, and fieldPolicyVersion.

---

## 14. Suggested Post-v0.1 Implementation Order

Only start after v0.1 tag and verified boundary hardening.

Recommended phase name:

```txt
v0.2-localized-report-rendering
```

Implementation sequence:

```txt
1. Add ADR/backlog design note for Localized Report Rendering.
2. Add supported locale registry.
3. Add glossary lookup contract for report localization.
4. Add LocalizedReportArtifact schema and migration.
5. Add sourceContentHash canonicalization helper.
6. Add field-selection policy for CanonicalReportContext.
7. Add ReportLocalizationService skeleton.
8. Add translation provider port.
9. Add fake deterministic translation provider for tests.
10. Add structural validator.
11. Add Markdown rendering from LocalizedReportContext.
12. Add persistence flow for LocalizedReportArtifact.
13. Add failure behavior and fallback to English.
14. Add API endpoint only after service tests pass.
15. Add UI selector only after API contract is stable.
```

---

## 15. Tests Required

Minimum tests:

```txt
1. Unsupported locale is rejected.
2. Missing glossary fails closed.
3. Source code snippets are unchanged.
4. File paths are unchanged.
5. Artifact IDs are unchanged.
6. Evidence IDs are unchanged.
7. Array lengths are unchanged.
8. New risk added by translation output is rejected.
9. Removed evidence is rejected.
10. Changed line number is rejected.
11. Changed enum/status/certainty is rejected.
12. Failed localization does not block English report.
13. Completed localization requires contentMarkdown.
14. Stale localized artifact detected by sourceContentHash mismatch.
15. Markdown builder renders localized context without corrupting code fences.
```

---

## 16. Final Decision

This backlog item is approved as a post-v0.1 design.

Do not implement before v0.1 tag.

Before this begins, the repository must already have:

```txt
1. Real @ba-helper/backend-runtime extraction on remote.
2. No @ba-helper/api/* alias.
3. No worker include/import from apps/api/src.
4. CI architecture verification.
5. API, worker, backend-runtime builds in CI.
6. Review coverage contract parsing.
7. v0.1 release tag.
```
