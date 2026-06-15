# Visual Demo Proof Pack

This document contains text-based and Mermaid visual artifacts to help reviewers understand the Requirement-to-Code Impact Analyzer in under 60 seconds without relying on external image hosting.

## 1. Golden Path Flow

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
    
    classDef secure fill:#e1f5fe,stroke:#0288d1,stroke-width:2px;
    classDef evidence fill:#e8f5e9,stroke:#388e3c,stroke-width:2px;
    classDef review fill:#fff3e0,stroke:#f57c00,stroke-width:2px;
    class A,B secure;
    class D evidence;
    class F,G,H review;
```

## 2. Trust Model & Evidence Hierarchy

```mermaid
graph BT
    A[Scanned Code Evidence] -->|Base Truth| B[Human Review Finalization]
    C[Domain Pack Hints] -.->|Guides Search| B
    D[LLM Suggestions] -.->|Structures Claims| B
    
    style A fill:#4caf50,stroke:#2e7d32,color:white,stroke-width:4px
    style B fill:#2196f3,stroke:#1565c0,color:white,stroke-width:2px
    style C fill:#ffeb3b,stroke:#fbc02d,color:black,stroke-dasharray: 5 5
    style D fill:#ffeb3b,stroke:#fbc02d,color:black,stroke-dasharray: 5 5
```
*Note: EVIDENCED impacts require Scanned Code Evidence. Domain Packs and LLM Suggestions cannot fabricate evidence.*

## 3. System Architecture Diagram

```mermaid
graph LR
    UI[Frontend / UI] <--> API[NestJS API]
    API --> SCAN[AST Scanner]
    SCAN --> STORE[(Artifact Store / Postgres)]
    STORE --> RETRIEVE[Hybrid Retrieval pgvector]
    RETRIEVE --> ANALYZE[Impact Analyzer]
    ANALYZE --> REVIEW[Review / Report Gen]
    REVIEW --> DRIFT[Drift & Evaluation Monitors]
```

## 4. Screenshot Capture Checklist

The following visual assets demonstrate the finalized UI flows and capabilities:

- **README / project overview**: High-level dashboard showing scanned repos.
  *(See Demo Repositories screenshot below)*

- **golden path test output**: Terminal screenshot showing `pnpm demo:golden-path` passing locally.
  *(Terminal proof managed separately)*

- **scan health panel**: Component displaying `READY` vs `PARTIAL` extraction constraints and scanner maturity.
  ![Scan Status and Maturity](../assets/demo/01-scan-status-maturity.png)

- **impact analysis screen**: UI showing requirement mapped to code artifacts.
  ![Impact Analysis Result](../assets/demo/02-impact-analysis-result.png)

- **evidence appendix/report**: Detailed view of specific code lines cited by the LLM.
  ![Evidence-Backed Artifacts](../assets/demo/03-evidence-backed-artifacts.png)

- **unknown/risk diagnostics**: View showing unknown components properly isolated.
  ![Unknown Risk Diagnostics](../assets/demo/04-unknown-risk-diagnostics.png)

- **human review panel**: Reviewer gate for confirming/rejecting insights.
  ![Human Review Panel](../assets/demo/05-human-review-panel.png)

- **traceability report preview**: Approved markdown report.
  ![Traceability Report](../assets/demo/06-traceability-report.png)

- **drift warning**: UI alert showing `STALE_ARTIFACTS` when a commit is pushed during review.
  *(Captured via separate test fixture)*

- **domain pack evaluation summary**: Terminal or UI showing precision/recall internal quality metrics.
  *(Terminal proof managed separately)*
