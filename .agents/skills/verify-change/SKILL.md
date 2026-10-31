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
4. Before database or browser mutation, require safe explicit test URLs. Never
   start development services or allow an empty related-test result to count
   as success. Follow mapped fallbacks or report the selector gap.
5. Review the unique ignored evidence directory for source SHA, diff
   fingerprint, commands, exit codes, skips, native reports, and blockers. A
   source change during verification invalidates that run's evidence.

Keep product invariants and security rules in the repository `AGENTS.md`.
Workflow details and test-target requirements belong in
[testing-strategy.md](../../../docs/agent/testing-strategy.md).
