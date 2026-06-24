# Localization And Domain Glossary

## Purpose

Localization in the MVP is a presentation concern. It helps the workspace render
stable labels in the user's language without changing persisted state, API
contracts, analyzer behavior, retrieval behavior, or evidence semantics.

PR5E establishes the foundation only:

- fixed analysis workspace labels live in centralized locale dictionaries
- status labels are mapped from English contract values at render time
- Booking terminology has static English and Vietnamese glossary files
- default runtime locale remains English

This is not a full Vietnamese product mode and not multi-domain runtime support.

## Invariants

- Contracts, enum values, database values, and API payload keys stay English.
- UI components render translated labels only through the i18n mapping layer.
- Do not store Vietnamese enum values in PostgreSQL.
- Do not rename contract enum values to match a locale.
- Do not translate evidence excerpts, code paths, artifact keys, provenance IDs,
  commit SHAs, source line ranges, or backend-provided analysis text.
- Missing label mappings may fall back mechanically for display, but must not
  create or infer a new business state.

## Glossary Boundary

Glossary JSON files under `packages/domain-packs` are terminology references.
They are allowed to describe domain terms such as booking, cancellation, refund,
inventory release, and payment state in multiple locales.

The domain pack registry may expose bounded glossary metadata such as locale,
asset status, version, and term count. It must not expose glossary term bodies
as evidence or as a runtime language mode.

They are not executable analyzer rules:

- do not inject these glossary files into prompts in this phase
- do not use them to create risks, unknowns, QA scenarios, or evidence
- do not use them to claim a new supported domain
- do not use them as a replacement for persisted evidence links

Domain behavior still comes from the existing backend domain-profile and
retrieval code. Any future connection between glossary assets and analyzer
behavior requires explicit scope, tests, and documentation updates.

## Adding Locale Labels

Add labels by extending the centralized dictionaries under
`apps/web/src/lib/i18n`. Keep component code focused on selecting the correct
label, not on embedding translated text.

When adding a new status-like value:

1. Keep the contract value in English.
2. Add English and Vietnamese render labels.
3. Add a focused test for the mapping.
4. Confirm unknown values fall back without inventing business meaning.

## Adding Glossary Terms

Glossary files must include:

- `domain`
- `locale`
- `status`
- `version`
- `terms`

Term keys should remain stable English identifiers. Term values are localized
display/reference text.
