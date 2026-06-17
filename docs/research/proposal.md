# ReqImpact Research Proposal

## Working Title

ReqImpact: Evidence-backed Requirement-to-Code Impact Analysis with Static
Analysis and LLM Reasoning

## Problem

Requirement change impact analysis is still manual, fragile, and dependent on
repository-specific developer knowledge. Generic LLM assistants can suggest
likely files, but they usually do not provide bounded repository evidence,
review state, or auditable report provenance.

## Approach

ReqImpact narrows the problem to:

```text
requirement change
-> static artifact extraction
-> hybrid retrieval
-> LLM reasoning
-> evidence linking
-> human review
-> approved traceability report
```

The system is intentionally not a repo chatbot and not a code generation tool.

## Research Questions

1. RQ1: How accurately can ReqImpact identify impacted files for requirement
   changes compared with keyword retrieval and pure-LLM baselines?
2. RQ2: How much auditable evidence does ReqImpact attach to predicted impacted
   artifacts?
3. RQ3: What types of unknowns and QA risks are surfaced during human review?

## Dataset Plan

- Start with 10 to 15 public GitHub issue or requirement-change cases.
- Use 1 to 2 backend repositories.
- Store cases in `evaluation/datasets/cases.v0.json`.
- Use changed files from commit/PR ground truth for file-level evaluation.
- Keep method-level evaluation optional for later phases.

## Baselines

1. Pure LLM without repository context
2. Keyword / lexical retrieval baseline
3. Vector retrieval baseline
4. ReqImpact hybrid retrieval + static artifacts + evidence review

## Metrics

- File-level Precision
- File-level Recall
- File-level F1
- Recall@5
- Recall@10
- Evidence coverage
- Review burden

## Expected Limitations

- The first dataset version is small and curated.
- File-level evaluation is easier to reproduce than method-level evaluation.
- Pure-LLM comparisons require manual, secret-backed runs and are not part of
  default CI.
- Current benchmark claims must remain bounded until real cases are collected
  and scored.
