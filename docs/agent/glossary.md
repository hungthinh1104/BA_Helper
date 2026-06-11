# Glossary

```text
Repository
  A configured source-code repository identity, such as a GitHub URL.

RepositoryTarget
  A selected branch, tag, or pinned commit identity whose latest successful
  safe source-resolution observation provides freshness context for an
  analysis, even when later extraction fails.

RepositorySnapshot
  A published, usable immutable extracted state of a repository at one commit
  SHA and analyzer version. Processing failures remain ScanJob state.

ScanJob
  An asynchronous execution that produces or attempts to produce a snapshot.

CodeArtifact
  An extracted API route, method, service, entity, DTO, test, or related symbol.

DependencyEdge
  A supported or inferred relationship between two code artifacts.

Evidence
  A traceable supporting record with explicit source origin, such as code,
  test, requirement input, coverage finding, static extraction, or human note.

Requirement
  The identity/container for a user supplied change request.

RequirementRevision
  An immutable submitted title plus raw and normalized version of a
  requirement, with readiness validation outcome, used as an analysis input.

ImpactAnalysis
  Evaluation of one analysis-ready requirement revision against one repository
  snapshot.

BaInsight
  A BA-facing fact, inferred impact, unknown, conflict, risk, question,
  acceptance criterion, or QA scenario.

TraceabilityLink
  An evidenced or inferred relationship between an analysis and an affected
  code artifact; unknown behavior is not represented as a link.

ReviewStatus
  Human workflow status independent from machine certainty.

Stale
  A freshness projection indicating output is not based on the latest
  successfully observed commit for its moving target ref. It does not replace
  lifecycle status or promise live remote monitoring.
```
