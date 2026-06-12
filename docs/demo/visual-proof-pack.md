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

The following visual assets should be captured when the UI is finalized. **(Currently TODO Placeholders)**

- [ ] `README / project overview`: High-level dashboard showing scanned repos.
- [ ] `golden path test output`: Terminal screenshot showing `pnpm demo:golden-path` passing locally.
- [ ] `impact analysis screen`: UI showing requirement mapped to code artifacts.
- [ ] `evidence appendix/report`: Detailed view of specific code lines cited by the LLM.
- [ ] `drift warning`: UI alert showing `STALE_ARTIFACTS` when a commit is pushed during review.
- [ ] `scan health panel`: Component displaying `READY` vs `PARTIAL` extraction constraints and scanner maturity.
- [ ] `domain pack evaluation summary`: Terminal or UI showing precision/recall internal quality metrics.
