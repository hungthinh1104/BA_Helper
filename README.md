# Requirement-to-Code Impact Analyzer

**Requirement-to-code impact analyzer for backend teams: evidence-backed traceability, QA risks, review coverage, and report export.**

## The Problem
When a business requirement changes, backend systems are highly susceptible to hidden impacts. Traditional impact analysis is either entirely manual (relying on tribal knowledge) or requires heavy, proprietary integration. Generic AI chatbots lack repository-wide context and fail to provide auditable evidence of *why* specific code blocks are impacted, leading to brittle updates and missed QA regressions.

## What It Does
Given a requirement change, the system securely scans backend repositories, identifies impacted code artifacts, extracts explicit evidence, highlights architectural and QA risks, supports human review workflows, and generates immutable traceability reports.

## Core Workflow
Requirement change &rarr; Impact Matrix &rarr; Evidence Drilldown &rarr; Review Coverage &rarr; Final Report

## In Action

*(TODO: Replace with real application screenshot before launch.)*
- **Requirement Input**: ![Requirement Input](docs/assets/01-requirement-input.png)

*(TODO: Replace with real application screenshot before launch.)*
- **Impact Matrix**: ![Impact Matrix](docs/assets/02-impact-matrix.png)

*(TODO: Replace with real application screenshot before launch.)*
- **Evidence Drilldown**: ![Evidence Drilldown](docs/assets/03-evidence-drilldown.png)

*(TODO: Replace with real application screenshot before launch.)*
- **Review Coverage**: ![Review Coverage](docs/assets/04-review-coverage.png)

*(TODO: Replace with real application screenshot before launch.)*
- **Final Report**: ![Final Report](docs/assets/05-merged-report-export.png)
- [View a sample Markdown report](docs/sample-report.md)

## Why not just ask ChatGPT/Copilot?
Generic AI coding agents are excellent at generating code blocks but struggle with system-wide impact analysis. This tool differs by focusing exclusively on:
- **Snapshot-scoped repository analysis**: It analyzes code frozen at a specific commit SHA, not a floating window of active files.
- **Evidence-backed impact links**: Every claimed impact is tied to an explicit, extracted `Evidence` record from your code.
- **Review coverage gates**: Machine output is explicitly separated from human finalization; AI never autonomously finalizes a report.
- **Matrix/drilldown auditability**: Understand exactly *why* a file was flagged without reading through a massive unstructured chat transcript.
- **Finalized immutable reports**: Output is designed for stakeholder sign-off, QA test generation, and compliance.

## Quickstart

### Prerequisites
- Docker & Docker Compose
- Node.js (v20+)
- pnpm
- A valid OpenAI API Key (or use the fake provider for testing)

### Installation
```bash
git clone https://github.com/your-org/requirement-impact-analyzer.git
cd requirement-impact-analyzer
pnpm install
```

### Environment Setup
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

### Run Locally
```bash
# 1. Start the database and cache
docker compose up -d postgres redis

# 2. Start the backend API
PORT=3001 ENABLE_DEV_LOGIN=true WORKSPACE_MODE=dev-single-user \
  AI_PROVIDER=fake EMBEDDING_PROVIDER=fake pnpm --dir apps/api dev

# 3. Start the background worker
WORKSPACE_MODE=dev-single-user AI_PROVIDER=fake EMBEDDING_PROVIDER=fake \
  pnpm --dir apps/worker dev

# 4. Start the frontend web application
NEXT_PUBLIC_API_URL=http://localhost:3001 NEXTAUTH_SECRET=replace-with-a-long-random-secret-32-chars-min \
  pnpm --dir apps/web dev
```
Open `http://localhost:3000/login` and sign in using the dev-login bypass.

> **Known local setup caveats:**
> The setup currently assumes a UNIX-like environment. Windows users should use WSL2. The `fake` AI provider allows testing the pipeline without an LLM key, but impact analysis quality will be mock data.

## Trust & Security Model
We prioritize keeping your proprietary code safe:
- **No Remote Code Execution**: The scanner performs static regex and AST-based extraction. It never executes your repository code.
- **Bounded Diagnostics**: Scans are bounded by file size and count limits to prevent OOM errors. 
- **Explicit Skips**: Large files, vendor directories (`node_modules`), binaries, and unsafe symlinks are automatically skipped and explicitly logged.
- **PARTIAL vs FULL Coverage**: If limits are hit, the scan is explicitly marked as `PARTIAL`. A `PARTIAL` scan is not a failure, but explicitly warns reviewers that the LLM may be missing context.
- **Immutable Reports**: Once finalized, reports are immutable and tied to a specific requirement revision and repository snapshot. **Reports are snapshot-scoped and evidence-backed. Finalized exports use immutable report snapshots and do not recompute live state.**
- **No Global Vector Search**: All RAG operations are strictly isolated by Tenant, Project, Repository, and Commit SHA.

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

## Limitations
- **Multi-language**: Full AST parsing is currently only available for TypeScript. Java Spring is heavily best-effort.
- **Single User Dev Mode**: The MVP defaults to a single-user workspace bypass for local testing.
- **Integrations**: Direct Jira/Confluence/GitHub App syncs are currently out of scope.

## Roadmap
1. Enhance Java Spring AST parser for `FULL` scan coverage.
2. Introduce Mermaid.js architectural graph generation.
3. Multi-user RBAC and workspace organization management.
4. Native OAuth and GitHub App integrations.

## Contributing
Please see our [agent rules](AGENTS.md) and [coding standards](docs/agent/code-quality-governance.md) before submitting pull requests. All code must adhere to the modular monolith boundaries and state machine invariants.
