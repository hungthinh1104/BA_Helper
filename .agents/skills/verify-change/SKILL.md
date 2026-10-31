---
name: verify-change
description: Use in BA_Helper when inspecting changed files, choosing FOCUSED/AFFECTED/FULL checks, running verification, or assessing selector evidence.
---

# Verify a BA_Helper change

1. Read [testing-strategy.md](../../../docs/agent/testing-strategy.md), inspect
   `git status --short`, and preserve staged, unstaged, and untracked work.
2. Run `pnpm verify:change --level focused` while iterating. Run default
   `pnpm verify:change` before handoff. Run `pnpm verify:change --level full`
   for releases or changes to CI, verification scripts, Jest/Playwright
   configuration, or this Skill.
3. Use `--plan` to inspect native discovery and prerequisites without executing
   tests or starting services. Use `--files <paths...>` only for an intentional
   scope; inspect the report's outside-scope list. Use `--base` when committed
   changes since a merge base belong in scope.
4. Before database or browser mutation, require explicit local test URLs and a
   matching `BA_HELPER_TEST_DATABASE_IDENTITY`. Use the advisory lease through
   the repository entrypoints; nested commands must prove its live owner
   session. Never start development services or treat failed/malformed
   discovery as successful fallback selection.
5. Check the exact Jest/Playwright inventory approval and native report
   validity. A baseline marked `PENDING_REVIEW` or changed skip/test identity
   blocks qualified readiness; never regenerate it as automatic approval.
6. Review the unique ignored evidence directory for source SHA, full diff
   fingerprint, commands, exit codes, fallback use, skips, native reports,
   inventory differences, and blockers. A source change during verification
   invalidates that run's evidence. FOCUSED/AFFECTED are scoped feedback; FULL
   still requires exact-SHA hosted checks before release eligibility.

Keep product invariants and security rules in the repository `AGENTS.md`.
Workflow details and test-target requirements belong in
[testing-strategy.md](../../../docs/agent/testing-strategy.md).
