# Interview Narrative

*Use these answers to articulate the technical and product rationale behind the Requirement-to-Code Impact Analyzer during technical interviews.*

### 1. What problem does this project solve?
When business requirements change, backend systems are highly susceptible to hidden impacts. Traditional impact analysis is either entirely manual (relying on tribal knowledge) or requires heavy, proprietary integration. This project creates a deterministic bridge, identifying exactly which backend code paths are impacted, surfacing evidence to prove it, and generating QA scenarios so teams don't miss edge cases.

### 2. Why is it not just a repo chatbot?
Generic repo chatbots lack strict bounds. They operate on a floating window of files and often generate code blindly. This tool is an **impact audit tool**. It analyzes a frozen, immutable commit snapshot of the repository, forces a human review gate before finalizing anything, and prevents the AI from answering un-evidenced questions.

### 3. How do you prevent hallucination?
Through an uncompromising **Evidence Hierarchy**. The system is built with strict schema constraints: if the analyzer cannot extract a specific, deterministic code excerpt (AST node) from the repository, the LLM is prohibited from classifying it as an `EVIDENCED` impact. Instead, the AI must classify unsupported or ambiguous requirements as an `UNKNOWN`, `RISK`, or a `QUESTION`.

### 4. How does evidence work?
A headless scanner parses the repository (e.g., using TypeScript AST) into a relational graph of `CodeArtifacts`. When an impact analysis runs, hybrid semantic retrieval (`pgvector`) fetches relevant code chunks. The LLM evaluates the requirement against these chunks. If it claims an impact, it MUST link that claim back to the precise file and line numbers of the original artifact.

### 5. How do drift/freshness warnings work?
Every analysis is tied to an immutable `RepositorySnapshot` defined by a commit SHA. If a developer pushes new code during an active review cycle, the system calculates the content hashes of the new snapshot against the old one. If artifacts have changed or churned significantly, it flags the analysis as `STALE_ARTIFACTS` or `INCOMPATIBLE`, ensuring the reviewer knows their report is out of date.

### 6. How do domain packs work?
Domain Packs (like `booking@0.1.0`) are curated dictionaries of domain-specific concepts. They act strictly as **semantic hints** to guide the vector retrieval pipeline, ensuring the system pulls the most relevant code chunks. Crucially, they are hints, not evidence. If the domain pack suggests "refund logic" but the repository doesn't have refund code, the system correctly reports it as missing rather than hallucinating an answer.

### 7. What was the hardest technical decision?
Decoupling the AI output from the source of truth. It was tempting to let the LLM generate the final markdown reports directly. However, we realized that machine output must be treated as volatile. The hardest and best decision was enforcing a strict state machine where the LLM only outputs structured JSON insights, which must then pass through a mandatory database storage and human confirmation gate (`ReviewInsightUseCase`) before any final report can be generated.

### 8. What are current limitations?
- **Extraction Depth:** TypeScript/NestJS is the strongest scanner path. Java/Spring Boot is `PARTIAL`; Go, Python, C#, PHP, and Ruby adapters are `EXPERIMENTAL` capability proofs with bounded extraction.
- **Unsupported Patterns:** Unsupported routes, scan blind spots, and dependency boundaries become `UNKNOWN`/`RISK` diagnostics for human review.
- **Metrics:** Our evaluation metrics (precision/recall) are internal quality signals tuned to our specific fixtures, not universal LLM benchmarks.
- **SaaS Readiness:** The deterministic local demo path is implemented, but multi-tenant SaaS features (OAuth, Stripe billing, GitHub App integration) are currently incomplete.

### 9. How would you productionize it?
I would implement strict tenant isolation at the database level using Row-Level Security (RLS) in PostgreSQL. I would replace the `FakeLlmProvider` with a robust external provider adapter featuring rate-limiting and circuit breakers. Finally, I would integrate native GitHub App webhooks so that the analysis triggers automatically upon PR creation, and the finalized report posts directly back as a PR comment.
