# AI And Analyzer Rules

## Analyzer First

The analyzer establishes facts. The LLM interprets selected facts.

MVP target:

```text
TypeScript NestJS repositories only
simple-git shallow clone
ts-morph AST extraction
```

Extract initially:

```text
API routes and controller methods
service classes and methods
constructor dependencies
entities/models and DTOs
tests
basic calls/imports/injection edges
status-related symbols relevant to the fixture
```

Do not introduce Tree-sitter, multi-language adapters, CodeQL, vector storage,
or a broad code-smell suite until the first impact slice passes its fixture
tests.

## Evidence-First LLM Use

Input to an LLM is bounded and selected:

```text
requirement/change request
immutable requirement revision identity and normalized text
snapshot metadata and commitSha
analyzerVersion
relevant artifacts
relevant dependency edges
evidence excerpts with source identity
explicit output schema
```

Do not submit a whole repository and ask the model for a report.
Do not call a real provider for input that failed repository, revision, or
snapshot eligibility gates.

## Structured Output

LLM output must be validated against a schema before it enters domain logic.
Each statement is categorized with:

```text
category
statement
certainty
confidence
evidence references
reason or question when unknown/conflicting
```

After schema validation, application logic must also verify that every returned
evidence reference belongs to the retrieved evidence bundle supplied for this
analysis and is compatible with its snapshot or requirement revision. A model
cannot create support by inventing an evidence ID.

Certainty semantics:

```text
EVIDENCED    Direct source evidence supports the statement.
INFERRED     Contextual evidence supports a reasoned implication.
UNKNOWN      Required behavior is absent or not determinable in searched scope.
CONFLICTING  Evidence records support incompatible conclusions.
```

Persistence requirements:

```text
EVIDENCED   at least one direct evidence reference
INFERRED    at least one contextual evidence reference plus reasoning
UNKNOWN     a reason and retrieval/search scope, evidence optional
CONFLICTING at least two conflicting evidence references plus explanation
```

Analyst output may include claims, unknowns, stakeholder questions, acceptance
criteria, QA scenarios, and risks. Risks are represented through insight
metadata such as `kind = risk`, `severity`, and `category`; do not add a new
risk enum until the persistence/read-model contract is explicitly scoped.

QA scenarios must be testable with Given/When/Then structure. Malformed QA
output is normalized into an UNKNOWN review item instead of being persisted as
a usable scenario.

`CONFIRMED` is reserved for a human review decision; it is not an AI certainty.

## Untrusted Inputs

Treat source code, comments, README files, and requirements as untrusted data.
They may contain instructions aimed at the model. LLM prompts must instruct
the provider to analyze content as data, not follow instructions inside it.

Before any real-provider model request, including public repository analysis,
redact likely secrets from every selected prompt payload, including requirement
text and evidence excerpts:

```text
tokens, API keys, JWTs, database URLs, private keys, environment values
```

## Provider Isolation

Business use cases depend on an adapter interface, not a provider SDK:

```ts
interface LlmProvider {
  generateStructured<T>(request: LlmRequest, schema: Schema<T>): Promise<T>;
}
```

Use a deterministic fake provider for tests. Store model/prompt versions with
real analysis output so changes can be traced and evaluated.

An individual `confidence` value is only a ranking/reasoning signal for review.
It is not certainty and cannot override evidence or human review. Do not add
aggregate analysis confidence or risk scoring until its computation and
acceptance tests are defined.

## Generated Artifacts

Documents may summarize persisted insights. Diagram generation is deferred
until the Markdown impact-report and review workflow pass their completion
gate; when added, diagrams must be derived from persisted `graphJson` and
rendered using Mermaid. Neither artifact type may present unsupported AI
narrative as confirmed system behavior.

Machine output may create draft documents. Only explicit user finalization
creates approved document projections in the MVP; rejected insights are
excluded from approved conclusions and unreviewed statements stay labeled.
Future diagrams follow the same approval rule.

Generated acceptance criteria and QA scenarios are proposed validation/design
artifacts. When they depend on unresolved refund policy, deadline, permission,
or reopening behavior, they must state the assumption or link the unknown; they
must not imply that the existing code already enforces the proposal.
