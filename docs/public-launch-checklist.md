# Public Repository Launch Checklist

Before launching the repository publicly on GitHub or Product Hunt, ensure the
following items are completed. This checklist is for public repository
presentation, not a production SaaS launch.

## 1. Repository Settings
- [ ] **Repository Name**: Clean, descriptive, and accurately reflects the project (e.g., `requirement-impact-analyzer`).
- [ ] **Description**: Updated to match positioning: `"Requirement-to-code impact analyzer for backend teams: evidence-backed traceability, QA risks, review coverage, and report export."`
- [ ] **URL**: Add a link to the live demo, landing page, or the primary documentation site if available.
- [ ] **Topics**: Ensure the following topics are applied to the GitHub repository:
  - `requirements-traceability`
  - `impact-analysis`
  - `change-impact-analysis`
  - `traceability`
  - `qa-automation`
  - `business-analysis`
  - `static-analysis`
  - `developer-tools`
  - `software-architecture`
  - `nestjs`
  - `spring-boot`
  - `typescript`

## 2. Documentation & Assets
- [ ] **README.md**: Verify that all 13 required sections are present and accurately describe the MVP.
- [ ] **Public Demo Checklist**: Review `docs/demo/public-demo-checklist.md` before recording or presenting the project.
- [ ] **Claims Audit**: Confirm experimental scanner adapters are not described as production-grade multi-language support.
- [ ] **Screenshots/GIFs**: Add high-quality screenshots or compressed GIFs of
  the working application when available; do not publish broken placeholders.
  - Requirement Input UI
  - Impact Matrix
  - Evidence Drilldown
  - Review Coverage Panel
- [ ] **Sample Report**: Ensure `docs/sample-report.md` exists and accurately reflects the output of an analysis.

## 3. Code & Security
- [ ] **Secrets Check**: Run a secret scanner (e.g., TruffleHog or GitGuardian) to ensure no `.env` files, internal keys, or proprietary private repo URLs are hardcoded in the history.
- [ ] **Test Coverage**: Ensure all existing tests pass (`pnpm test`, `pnpm test:e2e`).
- [ ] **Build Check**: Ensure `pnpm --filter web build` and `pnpm --filter api build` complete successfully without missing dependencies.
- [ ] **Preview Boundary**: Confirm any hosted demo is private/controlled
      unless real hosted auth is enabled; never expose dev-login on a public API
      host.

## 4. Community & Contributing
- [ ] **Issue Templates**: Create basic GitHub Issue templates for Bug Reports and Feature Requests.
- [ ] **Pull Request Template**: Create a basic PR template referencing `AGENTS.md` rules.
- [ ] **License**: Ensure an appropriate open-source license (e.g., MIT, Apache 2.0) is added to the root directory.
