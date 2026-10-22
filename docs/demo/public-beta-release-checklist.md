# Controlled Beta Release Checklist

Historical checklist snapshot. Checked items record an earlier freeze and do
not certify the current checkout or hosted CI. Current open gates are in the
[roadmap status](../release/roadmap-status.md); use its linked evidence for a
release decision. The supported beta boundary is local-password accounts
against public GitHub TypeScript/NestJS repositories; hosted SaaS remains locked.

## Verification Tasks

- [x] **Setup Verified:** The documented local setup flows (`pnpm install`, Docker, DB migrations) work and have been hardened.
- [x] **Typecheck Passed:** `pnpm run typecheck` executes cleanly with zero errors.
- [x] **Tests Passed:** The full automated test suite (`pnpm test`) runs successfully without failing assertions.
- [x] **Golden Path Passed:** The integration demo (`pnpm demo:golden-path`) passes deterministically, proving the impact analyzer flow works end-to-end.
- [x] **Multi-Repo Golden Path Passed:** `pnpm demo:multi-repo-golden-path` passes deterministically, proving the merged-report workflow remains covered.
- [x] **Links Audited:** All documentation and README links (e.g. to demo docs, limitations) resolve correctly and are not broken.
- [x] **Secrets Audited:** `.env.example`, documentation, templates, and test fixtures contain zero real API keys, private URLs, or personal tokens. Fake AI flags and placeholder credentials are used.
- [x] **Public Claims Audited:** We properly classify TypeScript/NestJS as the primary stable demo path, Java Spring as `PARTIAL`, other pilot adapters as `EXPERIMENTAL`, Domain Packs as hints, and Evaluation Metrics as internal quality signals rather than benchmark claims.
- [x] **Evidence Hierarchy Consistent:** Documentation explicitly dictates that all claims must be strictly backed by deterministic code evidence.
- [x] **Known Limitations Accepted:** Limitations regarding production SaaS readiness, formal security certification, and single-user MVP boundaries are honestly documented.
- [x] **Visual Proof Pack Checked:** Public-facing docs link only to existing
      visual proof material and do not include broken screenshot or GIF
      placeholders.
- [x] **Production Startup Drilled:** API, worker, and web production images
      started successfully with database, pgvector, Redis, and queue health up.
- [x] **Restore Drilled:** A logical backup was restored into an isolated
      database and representative persisted counts plus pgvector were verified.
- [x] **Machine Gate Added:** `pnpm verify:release-drill && pnpm verify:controlled-beta-readiness`
      boots the production stack and validates the executed, commit-matched
      evidence above (production-startup + restore-drill derive from the drill).

Historical status note: this checklist recorded controlled-beta readiness
before real BA/QC product observations were available. It does not establish
current readiness; consult the roadmap and commit-matched release evidence.
