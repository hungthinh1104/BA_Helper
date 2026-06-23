# Contributing to BA Helper

Thank you for your interest in contributing to the Requirement-to-Code Impact Analyzer!

This project is in **Public Beta**. To maintain the integrity of our impact analysis and deterministic tests, please adhere to the following guidelines.

## Local Setup

1. **Install dependencies**:
   ```bash
   pnpm install
   ```
2. **Start Local DB & Redis**:
   ```bash
   docker compose up -d postgres redis
   ```
3. **Run Migrations**:
   ```bash
   pnpm --dir apps/api prisma generate
   pnpm --dir apps/api prisma migrate dev
   ```

## Development Workflow

### Branch Naming Convention

Please follow this format when creating branches: `[type]/[optional-ticket-id]-[short-description]`

Allowed `type` prefixes:
- `feat/`: New features or significant capabilities (e.g., `feat/p4-snapshot-drift`)
- `fix/`: Bug fixes (e.g., `fix/123-ui-alignment`)
- `refactor/`: Code improvements without behavior changes (e.g., `refactor/analyzer-extraction`)
- `chore/`: Maintenance, dependency updates, or pipeline adjustments (e.g., `chore/update-eslint`)
- `docs/`: Documentation updates only (e.g., `docs/update-readme`)
- `release/`: Release preparation branches (e.g., `release/v1.2.0`)

Before submitting a Pull Request, ensure you verify your changes:

1. **Typecheck**:
   ```bash
   pnpm typecheck
   ```
2. **Golden Path Demo**:
   Our core automated integration test proves the system works end-to-end.
   ```bash
   pnpm demo:golden-path
   ```
3. **Evaluation Tests** (if changing AI logic):
   ```bash
   pnpm test tests/evaluation/impact-evaluation.spec.ts
   ```

## Architectural Guidelines

- **Evidence Hierarchy Rule**: Do not bypass the evidence constraints. Every generated impact must be strictly linked to code excerpts parsed by the analyzer. Do not let the LLM hallucinate unstructured impacts without links.
- **Domain Packs are Hints Only**: Domain packs (`booking@0.1.0`, `general@0.0.0`) are designed to guide the semantic retrieval phase. They must not be used to fabricate claims if the relevant code is absent from the repository.
- **No Real Provider Calls in Deterministic Tests**: The `golden-path-demo.spec.ts` test strictly uses `FakeLlmProvider` and `FakeEmbeddingProvider`. Do not add real external API calls or require API keys for standard testing.
- **Do NOT Include Secrets**: Do not commit real API keys, private URLs, or production credentials in code, issues, or PRs.
