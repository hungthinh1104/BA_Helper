# CV Bullets

*Use these bullets on a resume or LinkedIn profile to accurately and professionally highlight the system architecture and value delivered.*

- Built a Requirement-to-Code Impact Analyzer using TypeScript, NestJS, and PostgreSQL that maps requirement changes to impacted backend artifacts, code evidence, QA scenarios, and drift-aware traceability reports.
- Designed a deterministic, evidence-backed AI workflow integrating static parsers and `pgvector` semantic retrieval so impact claims must link to repository code evidence.
- Engineered a robust deterministic evaluation harness to calculate domain concept retrieval precision and recall, safeguarding the retrieval pipeline against prompt and embedding regressions.
- Implemented strict state machine invariants and a "Golden Path" automated integration test suite for the focused TypeScript/NestJS impact analysis flow.
- Architected snapshot-level caching and drift-visibility mechanics to flag stale analysis output and safely isolate embedding reuse per repository commit.
- Developed versioned "Domain Packs" (e.g., `booking@0.1.0`) serving as bounded semantic hints, successfully guiding AI context without compromising the strict evidence hierarchy.
