# BA Helper: Requirement-to-Code Impact Analyzer

**BA Helper** is a specialized impact analyzer for backend teams. It bridges the gap between changing business requirements and backend architecture. In research contexts, the engine is referred to as **ReqImpact**.

## 1. The Problem
When a business requirement changes (e.g., "allow users to cancel paid bookings for a refund"), Technical Business Analysts (BAs) and QA Engineers must manually trace how that change cascades through the backend codebase. This process is historically slow, heavily reliant on tribal knowledge, and lacks an immutable audit trail—often resulting in missed edge cases and unhandled regression risks.

## 2. The Solution
BA Helper automates the heavy lifting of traceability while enforcing strict human oversight. Given a requirement change and a codebase snapshot, the system provides a complete audited workflow:
1. **Extraction:** Parses backend code and constructs an evidence-first impact graph.
2. **Analysis:** Exposes unknowns, risks, and targeted QA scenarios.
3. **Human Review:** Forces an analyst to explicitly accept or reject every proposed traceability link.
4. **Snapshot:** Freezes the reviewed decisions into a mathematically immutable snapshot.
5. **Final Export:** Generates a deterministic, audited markdown report directly from the locked snapshot.

## 3. Why It Is Different from a Repo Chatbot
Unlike generic AI coding assistants or repo chatbots:
- **No Hallucinated Claims:** Every insight must link to a persisted code `Evidence` record.
- **Stateful & Persistent:** It generates structured, queryable entities (Traceability Links, Evidence, Decisions).
- **Human-in-the-Loop:** It does not blindly trust AI output. The LLM acts as an analytical reader, and a human acts as the mandatory approver.
- **Audit-Style Gating:** You cannot download a final report until every single link is manually reviewed and a snapshot is locked.

## 4. Trust & Audit Guarantees
Our analysis is strictly constrained to prevent hallucinations and fabricated claims:
- **Immutable Snapshots:** Once a snapshot is taken, the historical record cannot be altered by subsequent live edits.
- **Gated Exports:** The system strictly blocks final exports if unreviewed links exist or if the snapshot is missing.
- **No AI in Final Export:** The final markdown report is generated strictly from the frozen database payload, with zero active LLM calls or retrieval processes during the export phase.

## 5. Demo Workflow
The primary golden path demo validates the core evidence-first pipeline (`scan → impact analysis → evidence → review → report → drift visibility`).

You can run the definitive automated integration test for the focused TypeScript/NestJS demo path:

```bash
pnpm demo:golden-path
```

**Visual Case Study:**
For a step-by-step visual walkthrough of this workflow, see the [Demo Case Study](docs/portfolio/case-study.md).

**Sample Requirement:**
> "When a paid booking is cancelled, the system must refund the tenant, prevent double refunds, update booking/payment state, and notify relevant parties."

## 6. Tech Stack
Built as a TypeScript modular monolith to balance speed of development with eventual microservice readiness:
- **Frontend:** Next.js App Router, Tailwind CSS, Shadcn UI (React 19).
- **Backend API:** NestJS HTTP API serving frontend requests.
- **Workers:** NestJS BullMQ background processors for heavy analysis and extraction.
- **Persistence:** PostgreSQL (Prisma) for relational state and pgvector for embeddings. Redis for job queues.
- **Contracts:** Shared Zod API schemas bounding the frontend and backend.

## 7. Test Coverage
This absolute immutability is proven by comprehensive invariant test suites:
- **E17A Backend Tests:** Asserts that missing snapshots and unreviewed links block the gate at the API level, and that final reports are derived purely from snapshot payloads.
- **E17B Frontend Tests:** MSW/JSDOM UI test suites assert that incomplete gate states visually disable export functionality, and complete states correctly dispatch the frozen markdown Blob to the user.

## Visual Overview

### 1. Golden Path Flow
```mermaid
graph TD
    A[Requirement Change] --> B(Repository Snapshot & Scan Health)
    B --> C{Evidence-first Impact Analysis}
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
git clone https://github.com/hungthinh1104/BA_Helper.git
cd ba-helper
pnpm install
```

### 3. Environment Variables
Create the environment files from their examples. The examples contain safe, pre-configured local placeholders (including a fake AI provider).

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

For containerized web runtime, keep two URLs straight:
- `NEXT_PUBLIC_API_URL`: browser-visible API origin, usually `http://localhost:3001`
- `INTERNAL_API_URL`: server-side API origin inside the web container, usually `http://api:3001`

### 4. Start Local Services
Launch the Postgres and Redis containers in the background:
```bash
docker compose up -d postgres redis
```

### 5. Run Migrations
Apply the Prisma schema to your local Postgres database:
```bash
pnpm --dir apps/api exec prisma generate
pnpm --dir apps/api exec prisma migrate deploy --schema prisma/schema.prisma
```

### 6. Run Golden-Path Demo (Automated)
Run the automated integration test to verify the deterministic, end-to-end impact analyzer flow.

```bash
pnpm demo:golden-path
# Or explicitly: pnpm test tests/demo/golden-path-demo.spec.ts
```
*Note: This automated command runs entirely locally using `FakeLlmProvider` and `FakeEmbeddingProvider` so CI stays deterministic. The manual UI demo uses Gemini when `AI_PROVIDER=google` and `GEMINI_API_KEY` or `GOOGLE_API_KEY` is set.*

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

### 9. Real Runtime Smoke Lanes
The default CI and golden path stay on fake providers. Real-provider smoke is explicit and manual:

```bash
# Deterministic local smoke
pnpm --dir apps/api smoke:public-github

# Real Gemini LLM + fake embeddings
AI_PROVIDER=google EMBEDDING_PROVIDER=fake pnpm --dir apps/api smoke:public-github:real-llm

# Real Gemini LLM + Google embeddings
AI_PROVIDER=google EMBEDDING_PROVIDER=google pnpm --dir apps/api smoke:public-github:real-path
```

When running the containerized stack, use the dedicated migration owner first:

```bash
docker compose up -d --build migrate api worker web
```

This compose topology now matches the current project shape:
- `migrate` owns schema deployment
- `api` serves the backend on `3001`
- `worker` handles queued jobs
- `web` serves the Next.js frontend on `3000`

Avoid `docker compose config` in shared logs when real provider keys are loaded in your shell, because Compose expands current environment values into the resolved output.

## Troubleshooting

- **Database Connection Fails:** Ensure Docker is running. The default `.env.example` points to `postgresql://ba_helper:ba_helper@localhost:5432/ba_helper` which matches the `docker-compose.yml` credentials.
- **Fixture Path Not Found:** If you see "0 artifacts extracted" in the demo test, ensure you did not modify the `tests/fixtures/nestjs-booking-with-payment` directory structure.
- **Prisma Client Issues:** If types are out of sync or tests fail to compile, run `pnpm --dir apps/api prisma generate` to refresh the client.
- **Port Conflicts:** Ensure ports `3000` (Web), `3001` (API), `5432` (Postgres), and `6379` (Redis) are free on your host machine.

## Trust & Security Model
We prioritize keeping your proprietary code safe without overclaiming formal security certifications:
- **No Remote Code Execution**: The scanner performs static regex and AST-based extraction. It never executes your repository code.
- **Production Failsafe**: The application is hardened to fail fast if critical environment variables are missing or set to weak development defaults in production.
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
- **packages/analyzer**: Headless static extraction utilities with explicit scanner capability metadata.
- **packages/contracts**: Shared Zod API schemas bounding the frontend and backend.
- **Persistence**: PostgreSQL (Prisma) for relational state and pgvector for embeddings. Redis for job queues.

*For more details, see [Architecture Documentation](docs/agent/architecture.md).*

## Current Capabilities
- **Primary demo stack:** TypeScript/NestJS is the strongest and `STABLE` scanner path.
- **Pilot scanner adapters:** Java/Spring Boot is `PARTIAL`; Go `net/http`, Go/Gin, Python/FastAPI, C#/ASP.NET Core, PHP/Laravel, and Ruby/Rails are `EXPERIMENTAL` capability proofs.
- **Capability metadata:** Every scan exposes `SCANNER_CAPABILITY_SUMMARY` so reviewers can see whether a result came from a `STABLE`, `PARTIAL`, or `EXPERIMENTAL` adapter.
- **Output generation:** Impact matrices, QA scenarios, unknown/risk tracking, human review, Markdown/PDF exports, and drift-aware traceability reports.

## Known Limits
- TypeScript/NestJS is the strongest scanner path.
- Multi-language adapters are bounded pilots. They demonstrate deterministic extraction contracts, not full compiler-level semantic analysis.
- Unsupported route patterns, file scan blind spots, artifact uncertainty, and dependency boundaries become diagnostics, `UNKNOWN`, or `RISK` items requiring review.
- Experimental scanners must not be presented as production-grade language support.
- Domain packs are hints, not evidence.
- LLM output is constrained by extracted evidence and human review; it is not allowed to finalize reports by itself.
- Evaluation metrics are internal quality signals, not public benchmarks.
- Automated CI golden path uses fake providers; manual UI demo runs with Gemini real LLM when configured.
- Production SaaS concerns such as GitHub App auth, billing, and hosted multi-tenant deployment are not complete.

## Roadmap
1. Keep TypeScript/NestJS as the primary public demo story.
2. Harden pilot scanner adapters while keeping capability status explicit.
3. Improve visual review and traceability flows without weakening the evidence hierarchy.
4. Native OAuth and GitHub App integrations.

## Documentation & Assets
- **[Golden Path Demo Guide](docs/demo/golden-path.md)**
- **[Sample Requirement Change](docs/demo/sample-requirement-change.md)**
- **[Public Beta Release Note](docs/demo/public-beta-release-note.md)**
- **[Portfolio Proof Pack](docs/demo/portfolio-proof-pack.md)**
- **[Public Demo Checklist](docs/demo/public-demo-checklist.md)**
- **[Impact Evaluation Docs](docs/evaluation/impact-evaluation.md)**
- **[Domain Pack Architecture](docs/agent/domain-pack-architecture.md)**
- **[Security Policy](SECURITY.md)**
- **[Contributing Guide](CONTRIBUTING.md)**

## Contributing
Please see our [agent rules](AGENTS.md) and [coding standards](docs/agent/code-quality-governance.md) before submitting pull requests. All code must adhere to the modular monolith boundaries and state machine invariants.
