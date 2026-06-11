# Requirement-to-Code Impact Analyzer

Map requirement changes to impacted backend code, evidence, QA risks, review coverage, and immutable reports.

**BA Helper** is a requirement-to-code impact analyzer for backend teams.

## The Problem
When a business requirement changes, backend systems are highly susceptible to hidden impacts. Traditional impact analysis is either entirely manual (relying on tribal knowledge) or requires heavy, proprietary integration. Generic AI chatbots lack repository-wide context and fail to provide auditable evidence of *why* specific code blocks are impacted, leading to brittle updates and missed QA regressions.

## What It Does
Given a requirement change, the system securely scans backend repositories and provides a complete flow:
- Requirement change
- Impacted backend code artifacts
- Evidence
- Unknowns / Risks / QA scenarios
- Human review
- Traceability / Report
- Drift / Freshness warning

## What It Is Not
- **Not a generic repo chatbot**
- **Not a generic AI coding agent**
- **Not a code generator**
- **Not a public benchmark**

## Why It Is Trustworthy
Our analysis is strictly constrained to prevent hallucinations and fabricated claims:
- **Evidence-backed impacts:** Every claim links to extracted code.
- **Scan health:** Explicit PARTIAL/FULL scan limits prevent silent omissions.
- **Review coverage:** Human review gating ensures humans are accountable for finalization.
- **Snapshot drift:** Analyzes frozen commits and provides clear staleness warnings if code changes.]
- **Bounded diagnostics:** Output size and structure are strictly bounded.
- **Domain packs as hints only:** Domain packs influence retrieval but do not generate un-evidenced claims.
- **No evidence fabrication:** Only explicit parser-derived code excerpts can be cited as evidence.

## Golden Path Demo
Run the definitive automated integration test that proves the core MVP Requirement-to-Code Impact Analyzer flow works end-to-end:

```bash
pnpm test tests/demo/golden-path-demo.spec.ts
```

This demo validates the entire pipeline:
`scan → impact analysis → evidence → review → report → drift visibility`

**Demo Details:**
- **Fixture:** `nestjs-booking-with-payment`
- **Domain Pack:** `booking@0.1.0`
- **External Dependencies:** External LLM/embedding calls are mocked/fake for deterministic CI runs.
- **Drift:** The drift check is at a smoke-level.

## Sample Requirement
Read the [Sample Requirement Docs](docs/demo/sample-requirement-change.md) or use this text directly:

```text
When a paid booking is cancelled, the system must refund the tenant, prevent double refunds, update booking/payment state, and notify relevant parties.
```

## Visual Overview

### 1. Golden Path Flow
```mermaid
graph TD
    A[Requirement Change] --> B(Repository Snapshot & Scan Health)
    B --> C{Impact Analysis}
    C -->|Domain Pack Hints| D[Evidence-backed Impacted Artifacts]
    C -->|Missing Code| E[Unknowns / Risks / QA Scenarios]
    D --> F[Human Review Gate]
    E --> F
    F --> G[Traceability Report]
    G -.-> H[Drift / Freshness Warning]
```

### 2. Trust Model & Evidence Hierarchy
```mermaid
graph BT
    A[Scanned Code Evidence] -->|Base Truth| B[Human Review Finalization]
    C[Domain Pack Hints] -.->|Guides Search| B
    D[LLM Suggestions] -.->|Structures Claims| B
```
*Note: EVIDENCED impacts require Scanned Code Evidence. Domain Packs and LLM Suggestions cannot fabricate evidence.*

### 3. Screenshot Capture Checklist (TODO)
When UI development is finalized, the following screenshots will be captured to replace these text placeholders:
- [ ] `Dashboard`: High-level project overview showing scanned repos.
- [ ] `Terminal`: `pnpm demo:golden-path` running in under 3 seconds.
- [ ] `Impact Analysis`: UI mapping requirement to code artifacts.
- [ ] `Evidence Appendix`: Detailed view of specific code lines cited by the LLM.
- [ ] `Review Coverage`: Human-in-the-loop sign-off gate.
- [ ] `Drift Warning`: UI alert showing `STALE_ARTIFACTS`.
- [ ] `Final Report`: The generated Markdown/PDF traceability report.

- [View a sample Markdown report](docs/sample-report.md)

## Quickstart & Reproducibility

We designed this project to be highly reproducible locally. No real LLM or embedding API keys are required to run the automated demo test or spin up the platform.

### Reproducibility Checklist
```text
Fresh clone validation:
[ ] pnpm install works
[ ] local DB starts
[ ] migrations apply
[ ] typecheck passes
[ ] golden path demo passes
[ ] no external AI keys required
```

### 1. Prerequisites
- Docker & Docker Compose (for Postgres/pgvector and Redis)
- Node.js (v20+)
- pnpm (v9+)

### 2. Install
```bash
git clone https://github.com/your-org/requirement-impact-analyzer.git
cd requirement-impact-analyzer
pnpm install
```

### 3. Environment Variables
Create the environment files from their examples. The examples contain safe, pre-configured local placeholders (including a fake AI provider).

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

### 4. Start Local Services
Launch the Postgres and Redis containers in the background:
```bash
docker compose up -d postgres redis
```

### 5. Run Migrations
Apply the Prisma schema to your local Postgres database:
```bash
pnpm --dir apps/api prisma generate
pnpm --dir apps/api prisma migrate dev
```

### 6. Run Golden-Path Demo (Automated)
Run the automated integration test to verify the deterministic, end-to-end impact analyzer flow.

```bash
pnpm demo:golden-path
# Or explicitly: pnpm test tests/demo/golden-path-demo.spec.ts
```
*Note: This command runs entirely locally using `FakeLlmProvider` and `FakeEmbeddingProvider`. No network API keys are required.*

### 7. Run Evaluation Tests (Optional)
If you wish to test the retrieval and domain matching logic explicitly:
```bash
pnpm test tests/evaluation/impact-evaluation.spec.ts
```

### 8. Start the Application (Optional)
If you wish to run the full UI and Backend locally:
```bash
# Start backend API (Port 3001)
pnpm dev:api

# Start background worker
pnpm dev:worker

# Start frontend web app (Port 3000)
pnpm dev:web
```
Open `http://localhost:3000/login` and sign in using the dev-login bypass.

## Troubleshooting

- **Database Connection Fails:** Ensure Docker is running. The default `.env.example` points to `postgresql://ba_helper:ba_helper@localhost:5432/ba_helper` which matches the `docker-compose.yml` credentials.
- **Fixture Path Not Found:** If you see "0 artifacts extracted" in the demo test, ensure you did not modify the `tests/fixtures/nestjs-booking-with-payment` directory structure.
- **Prisma Client Issues:** If types are out of sync or tests fail to compile, run `pnpm --dir apps/api prisma generate` to refresh the client.
- **Port Conflicts:** Ensure ports `3000` (Web), `3001` (API), `5432` (Postgres), and `6379` (Redis) are free on your host machine.

## Trust & Security Model
We prioritize keeping your proprietary code safe without overclaiming formal security certifications:
- **No Remote Code Execution**: The scanner performs static regex and AST-based extraction. It never executes your repository code.
- **No Raw Vectors**: No raw embedding vectors are dumped in diagnostics or reports.
- **Bounded Diagnostics**: Scans are bounded by file size and count limits to prevent OOM errors.
- **Evidence Hierarchy**: Strict constraints to prevent orphaned AI claims.
- **Review Gate**: Manual human-in-the-loop review ensures safe outputs.
- **Snapshot-Scoped Embedding Reuse**: Vectors are tightly scoped to a specific repository snapshot commit; no old snapshot chunk leakage is permitted.
- **Safe Fallback**: Unrecognized domains fallback to the `general@0.0.0` domain pack.

## Architecture
Built as a TypeScript modular monolith to balance speed of development with eventual microservice readiness:
- **apps/web**: Next.js App Router frontend (React, Tailwind, Shadcn).
- **apps/api**: NestJS HTTP API serving frontend requests.
- **apps/worker**: NestJS BullMQ background processors for heavy analysis and extraction.
- **packages/analyzer**: Headless TypeScript and Java Spring code extraction utilities.
- **packages/contracts**: Shared Zod API schemas bounding the frontend and backend.
- **Persistence**: PostgreSQL (Prisma) for relational state and pgvector for embeddings. Redis for job queues.

*For more details, see [Architecture Documentation](docs/agent/architecture.md).*

## Current Capabilities
- **Languages/Frameworks**: Deep AST extraction for **TypeScript/NestJS**.
- **Java Spring (Pilot)**: Regex-based extraction for Java Spring Boot. *Note: Spring support is currently marked as a pilot adapter and will always yield `PARTIAL` scan coverage.*
- **Output Generation**: Impact Matrices, QA Scenarios, Unknown Area tracking, and Markdown Exports.

## Public Limitations
- TypeScript/NestJS is the strongest scanner path.
- Java Spring support is partial/pilot.
- Domain packs are hints, not evidence.
- Evaluation metrics are internal quality signals, not public benchmarks.
- Golden path uses fake providers for deterministic CI.
- Production SaaS concerns such as GitHub App auth, billing, and hosted multi-tenant deployment are not complete.

## Roadmap
1. Harden Java Spring pilot extraction while keeping scan coverage explicitly PARTIAL until parser confidence improves.
2. Introduce Mermaid.js architectural graph generation.
3. Harden multi-user workspace flows, invite/onboarding, and project administration.
4. Native OAuth and GitHub App integrations.

## Contributing
Please see our [agent rules](AGENTS.md) and [coding standards](docs/agent/code-quality-governance.md) before submitting pull requests. All code must adhere to the modular monolith boundaries and state machine invariants.
