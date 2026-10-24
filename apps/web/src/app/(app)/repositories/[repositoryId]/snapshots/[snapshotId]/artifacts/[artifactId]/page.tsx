"use client"

import { lazy, Suspense, use, useState } from "react"
import type { ReactNode } from "react"
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, FileCode2, GitBranch, Loader2 } from "lucide-react"
import { WorkspacePageHeader } from "@/components/workspace/shared/page-header"
import { BackButton } from "@/components/workspace/shared/back-button"
import { useLocalizedHref } from "@/i18n/navigation"
import { useCodeComprehension } from "@/hooks/api/use-code-comprehension"
import type { CodeComprehensionResponse, ComprehensionScenario, TestStaticBehaviorClaim } from "@ba-helper/contracts"

const CodeComprehensionTraceFlow = lazy(() => import("./_components/code-comprehension-trace-flow").then((module) => ({ default: module.CodeComprehensionTraceFlow })))

interface PageProps {
  params: Promise<{ repositoryId: string; snapshotId: string; artifactId: string }>
}

export default function CodeComprehensionPage({ params }: PageProps) {
  const { repositoryId, snapshotId, artifactId } = use(params)
  const href = useLocalizedHref()
  const { data, isLoading, isError, error } = useCodeComprehension(snapshotId, artifactId)

  if (isLoading) {
    return <StateCard icon={<Loader2 className="h-5 w-5 animate-spin" />} title="Loading code evidence" detail="Reading the bounded projection for this immutable snapshot." />
  }
  if (isError || !data) {
    return <StateCard icon={<AlertTriangle className="h-5 w-5" />} title="Code evidence unavailable" detail={error instanceof Error ? error.message : "The snapshot or artifact could not be read."} />
  }

  return (
    <div className="app-page-scroll">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-4 pb-20">
        <BackButton href={href(`/repositories/${repositoryId}`)} label="Back to repository" className="mb-0 w-fit" />
        <WorkspacePageHeader
          title={data.selectedCode.name}
          description={<ArtifactLocation filePath={data.selectedCode.filePath} startLine={data.selectedCode.startLine} />}
        />

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded-full border border-border/50 px-2 py-1">{data.selectedCode.artifactType}</span>
          <span className="rounded-full border border-border/50 px-2 py-1">{data.snapshotContext.coverageStatus} snapshot</span>
          <span className="rounded-full border border-warning/30 bg-warning/5 px-2 py-1 text-warning">Static evidence only</span>
          <span className="font-mono">commit {data.snapshotContext.commitSha.slice(0, 12)}</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
          <div className="flex min-w-0 flex-col gap-6">
            <SourceEvidence evidence={data.codeEvidence.source} highlights={[
              ...data.codeEvidence.parameters, ...(data.codeEvidence.returnType ? [data.codeEvidence.returnType] : []),
              ...data.codeEvidence.conditions, ...data.codeEvidence.exceptionHandlers,
            ]} />
            <CodeEvidenceDetails data={data} />
            <StaticDependencies data={data} />
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            <Limitations data={data} />
            <ScenarioList scenarios={data.relatedScenarios} snapshotContext={data.snapshotContext} pagination={data.scenarioPagination} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ArtifactLocation({ filePath, startLine }: { filePath: string; startLine: number | null }) {
  return <span className="flex items-center gap-1.5 font-mono text-[12px] text-muted-foreground"><FileCode2 className="h-3.5 w-3.5" />{filePath}:{startLine ?? "?"}</span>
}

function SourceEvidence({ evidence, highlights = [] }: { evidence: { filePath: string; startLine: number | null; endLine: number | null; excerpt: string; commitSha: string }; highlights?: Array<{ startLine: number | null; endLine: number | null }> }) {
  const lines = evidence.excerpt ? evidence.excerpt.split("\n") : []
  return (
    <section className="overflow-hidden rounded-xl border border-border/40 bg-surface/50 shadow-sm" aria-labelledby="source-evidence-title">
      <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-3">
        <div><h2 id="source-evidence-title" className="text-[14px] font-semibold">Source evidence</h2><p className="font-mono text-[11px] text-muted-foreground">{evidence.filePath}:{evidence.startLine ?? "?"}-{evidence.endLine ?? "?"}</p></div>
        <CheckCircle2 className="h-4 w-4 text-success" aria-label="Persisted source evidence" />
      </div>
      {lines.length > 0 ? (
        <pre className="max-h-[480px] overflow-auto bg-background/60 p-4 text-[12px] leading-5"><code>{lines.map((line, index) => { const lineNumber = (evidence.startLine ?? 1) + index; const highlighted = highlights.some(item => item.startLine !== null && item.endLine !== null && lineNumber >= item.startLine && lineNumber <= item.endLine); return <span key={`${index}-${line}`} className={`block ${highlighted ? "bg-primary/10" : ""}`}><span className="mr-4 inline-block w-8 select-none text-right text-muted-foreground/60">{lineNumber}</span>{line}</span> })}</code></pre>
      ) : (
        <p className="p-4 text-[12px] text-warning">No excerpt was persisted for this artifact. The location remains explicit, but source review is incomplete.</p>
      )}
    </section>
  )
}

function CodeEvidenceDetails({ data }: { data: CodeComprehensionResponse }) {
  const { parameters, returnType, conditions, exceptionHandlers } = data.codeEvidence
  const entries = [
    ...parameters.map((item, index) => ({ key: `parameter-${index}`, label: `Parameter ${index + 1}`, evidence: item })),
    ...(returnType ? [{ key: "return-type", label: "Return type", evidence: returnType }] : []),
    ...conditions.map((item, index) => ({ key: `condition-${index}`, label: `Condition ${index + 1}`, evidence: item })),
    ...exceptionHandlers.map((item, index) => ({ key: `exception-${index}`, label: `Exception ${index + 1}`, evidence: item })),
  ]
  return <section className="rounded-xl border border-border/40 bg-surface/50 p-4 shadow-sm" aria-labelledby="code-logic-title">
    <div className="flex items-center gap-2"><FileCode2 className="h-4 w-4 text-muted-foreground" /><h2 id="code-logic-title" className="text-[14px] font-semibold">Static code logic</h2></div>
    <p className="mt-1 text-[12px] text-muted-foreground">Signature, conditions, and exception declarations are AST evidence from this commit. They do not describe runtime values.</p>
    {entries.length === 0 ? <p className="mt-4 text-[12px] text-warning">Structured code metadata was not persisted for this artifact.</p> : <ul className="mt-3 space-y-2">{entries.map(({ key, label, evidence }) => <li key={key} className="rounded border border-border/30 px-2 py-1.5"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span><code className="mt-1 block break-words text-[11px]">{evidence.excerpt}</code><span className="mt-1 block font-mono text-[10px] text-muted-foreground">{evidence.filePath}:{evidence.startLine ?? "?"}-{evidence.endLine ?? "?"}</span></li>)}</ul>}
  </section>
}

function StaticDependencies({ data }: { data: CodeComprehensionResponse }) {
  return (
    <section className="rounded-xl border border-border/40 bg-surface/50 p-4 shadow-sm" aria-labelledby="static-path-title">
      <div className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-muted-foreground" /><h2 id="static-path-title" className="text-[14px] font-semibold">Static dependencies</h2></div>
      <p className="mt-1 text-[12px] text-muted-foreground">These relationships come from the persisted snapshot graph. They do not imply test execution.</p>
      {data.codeEvidence.dependencies.length === 0 && data.codeEvidence.staticCalls.length === 0 ? <p className="mt-4 text-[12px] text-muted-foreground">No bounded direct relationships were recorded.</p> : (
        <ul className="mt-4 divide-y divide-border/40">
          {data.codeEvidence.dependencies.map((dependency) => <li key={dependency.id} className="flex items-center justify-between gap-3 py-2"><span className="truncate text-[13px]">{dependency.name}</span><span className="shrink-0 font-mono text-[10px] text-muted-foreground">{dependency.filePath}:{dependency.startLine ?? "?"}</span></li>)}
        </ul>
      )}
      {data.codeEvidence.staticCalls.length > 0 && <p className="mt-3 text-[11px] text-muted-foreground">{data.codeEvidence.staticCalls.length} direct CALLS edge(s) with persisted graph provenance.</p>}
    </section>
  )
}

function Limitations({ data }: { data: { limitations: Array<{ code: string; message: string; severity: string }>; snapshotContext: { runtimeObservations: string }; truncated: boolean } }) {
  return (
    <section className="rounded-xl border border-border/40 bg-surface/50 p-4 shadow-sm" aria-labelledby="uncertainty-title">
      <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /><h2 id="uncertainty-title" className="text-[14px] font-semibold">Uncertainty and limits</h2></div>
      <p className="mt-1 text-[12px] text-muted-foreground">Runtime observations: {data.snapshotContext.runtimeObservations}. {data.truncated ? "The result was bounded and may be incomplete." : "No projection bound was reached."}</p>
      <ul className="mt-3 space-y-2">{data.limitations.map((item) => <li key={`${item.code}-${item.message}`} className="rounded-lg border border-border/40 px-3 py-2"><span className={`mr-2 text-[10px] font-semibold ${item.severity === "WARN" ? "text-warning" : "text-muted-foreground"}`}>{item.severity}</span><span className="font-mono text-[10px]">{item.code}</span><p className="mt-1 text-[11px] text-muted-foreground">{item.message}</p></li>)}</ul>
    </section>
  )
}

type SnapshotEvidenceContext = Pick<CodeComprehensionResponse["snapshotContext"], "snapshotId" | "commitSha">

function ScenarioList({ scenarios, snapshotContext, pagination }: { scenarios: ComprehensionScenario[]; snapshotContext: SnapshotEvidenceContext; pagination: CodeComprehensionResponse["scenarioPagination"] }) {
  return (
    <section className="rounded-xl border border-border/40 bg-surface/50 p-4 shadow-sm" aria-labelledby="scenario-title">
      <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-muted-foreground" /><h2 id="scenario-title" className="text-[14px] font-semibold">Related Jest scenarios</h2></div>
      <p className="mt-1 text-[12px] text-muted-foreground">Declarations are shown with their exact static source claims. No execution or coverage is inferred.</p>
      {scenarios.length === 0 ? <p className="mt-4 text-[12px] text-muted-foreground">No supported test-to-code reference was persisted. This does not prove that no tests exist; inspect the scan limitations above.</p> : <div className="mt-3 space-y-2">{scenarios.map((scenario) => <Scenario key={scenario.testArtifact.id} scenario={scenario} snapshotContext={snapshotContext} />)}</div>}
      {pagination.hasMore && <p className="mt-3 rounded border border-warning/30 bg-warning/5 px-2 py-1.5 text-[11px] text-warning">More related scenarios are available beyond this bounded page ({pagination.offset + 1}-{pagination.offset + scenarios.length} shown).</p>}
      {scenarios.length > 1 && <ScenarioComparison scenarios={scenarios} />}
    </section>
  )
}

export function Scenario({ scenario, snapshotContext }: { scenario: ComprehensionScenario; snapshotContext?: SnapshotEvidenceContext }) {
  const [showTrace, setShowTrace] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState<TestStaticBehaviorClaim | null>(null)
  const groups: Array<[string, TestStaticBehaviorClaim[]]> = [
    ["Setup", scenario.setup], ["Inputs", scenario.inputs], ["Invocations", scenario.invocations],
    ["Assertions", scenario.assertions], ["Mocks", scenario.mockedBoundaries], ["Expected outcomes", scenario.expectedOutcomes],
  ]
  const scenarioTitle = scenario.testCase?.title ?? scenario.testArtifact.name
  return <details className="rounded-lg border border-border/40 bg-background/30 px-3 py-2"><summary className="cursor-pointer list-none"><span className="text-[13px] font-medium">{scenarioTitle}</span><span className="ml-2 text-[10px] text-muted-foreground">{scenario.trace?.relation ?? "UNRESOLVED"}</span></summary><div className="mt-3 space-y-3"><div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">{scenario.trace?.artifacts.map((artifact, index) => <span key={artifact.id} className="inline-flex items-center gap-1"><span className="rounded border border-border/50 px-1.5 py-0.5">{artifact.name}</span>{index < (scenario.trace?.artifacts.length ?? 0) - 1 && <ArrowRight className="h-3 w-3" />}</span>)}</div><button type="button" className="rounded border border-border/50 px-2 py-1 text-left text-[11px] font-medium hover:border-primary/50" aria-expanded={showTrace} onClick={() => setShowTrace((value) => !value)}>{showTrace ? "Hide visual trace" : "Show visual trace"}</button>{showTrace && <Suspense fallback={<p role="status" className="text-[11px] text-muted-foreground">Loading visual trace…</p>}><CodeComprehensionTraceFlow scenario={scenario} snapshotContext={snapshotContext} /></Suspense>}{scenario.behaviorAssociations.length > 0 && <div className="rounded border border-border/30 bg-background/50 p-2"><h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">AST-linked behavior</h3><ul className="mt-1 space-y-1">{scenario.behaviorAssociations.map((association) => <li key={association.associationId} className="text-[11px]"><button type="button" className="rounded px-1 text-left hover:bg-primary/10" onClick={() => setSelectedClaim(association.assertion)}><span className={association.invocation ? "text-foreground" : "text-warning"}>{association.invocation?.sourceText ?? "Invocation unresolved"}</span><span className="mx-1 text-muted-foreground">→</span><span>{association.assertion.sourceText}</span></button>{association.expectedOutcomes.length > 0 && <span className="ml-1 text-muted-foreground">({association.expectedOutcomes.length} expected value(s))</span>}</li>)}</ul></div>}{groups.filter(([, claims]) => claims.length > 0).map(([label, claims]) => <ClaimGroup key={label} label={label} claims={claims} selectedClaim={selectedClaim} onSelect={setSelectedClaim} />)}{selectedClaim && <ClaimEvidenceInspector claim={selectedClaim} scenarioTitle={scenarioTitle} snapshotContext={snapshotContext} />}{scenario.unresolved.length > 0 && <p className="text-[11px] text-warning">{scenario.unresolved.map((item) => `${item.code}: ${item.message}`).join(" ")}</p>}</div></details>
}

export function ScenarioComparison({ scenarios }: { scenarios: ComprehensionScenario[] }) {
  const [leftId, setLeftId] = useState(scenarios[0]?.testArtifact.id ?? "")
  const [rightId, setRightId] = useState(scenarios[1]?.testArtifact.id ?? "")
  const left = scenarios.find((scenario) => scenario.testArtifact.id === leftId) ?? scenarios[0]
  const right = scenarios.find((scenario) => scenario.testArtifact.id === rightId) ?? scenarios[1]
  const groups: Array<[string, TestStaticBehaviorClaim[], TestStaticBehaviorClaim[]]> = [
    ["Setup", left.setup, right.setup], ["Inputs", left.inputs, right.inputs],
    ["Invocations", left.invocations, right.invocations], ["Assertions", left.assertions, right.assertions],
    ["Mocks", left.mockedBoundaries, right.mockedBoundaries], ["Expected outcomes", left.expectedOutcomes, right.expectedOutcomes],
  ]
  return <div className="mt-4 rounded-lg border border-border/40 bg-background/40 p-3" aria-label="Scenario comparison"><h3 className="text-[12px] font-semibold">Compare extracted scenarios</h3><div className="mt-2 grid gap-2 sm:grid-cols-2"><select aria-label="First scenario" value={leftId} onChange={(event) => setLeftId(event.target.value)} className="rounded border border-border/50 bg-background px-2 py-1 text-[11px]">{scenarios.map((scenario) => <option key={scenario.testArtifact.id} value={scenario.testArtifact.id}>{scenario.testCase?.title ?? scenario.testArtifact.name}</option>)}</select><select aria-label="Second scenario" value={rightId} onChange={(event) => setRightId(event.target.value)} className="rounded border border-border/50 bg-background px-2 py-1 text-[11px]">{scenarios.map((scenario) => <option key={scenario.testArtifact.id} value={scenario.testArtifact.id}>{scenario.testCase?.title ?? scenario.testArtifact.name}</option>)}</select></div><ul className="mt-3 grid gap-2 text-[11px] text-muted-foreground">{groups.map(([label, leftClaims, rightClaims]) => { const difference = compareClaims(leftClaims, rightClaims); return <li key={label} className={difference.onlyLeft.length || difference.onlyRight.length ? "text-warning" : ""}><span>{label}: {leftClaims.length} vs {rightClaims.length} static declaration(s)</span>{difference.onlyLeft.length > 0 && <span className="mt-1 block text-[10px]">Only first: {difference.onlyLeft.join(" · ")}</span>}{difference.onlyRight.length > 0 && <span className="mt-1 block text-[10px]">Only second: {difference.onlyRight.join(" · ")}</span>}</li> })}<li className={left.trace?.relationships.length === right.trace?.relationships.length ? "" : "text-warning"}>Relationships: {left.trace?.relationships.length ?? 0} vs {right.trace?.relationships.length ?? 0} static edge(s)</li></ul><p className="mt-2 text-[10px] text-muted-foreground">Differences compare exact extracted source claims and static relationships only; they do not compare runtime behavior or test outcomes.</p></div>
}

function compareClaims(left: TestStaticBehaviorClaim[], right: TestStaticBehaviorClaim[]) {
  const key = (claim: TestStaticBehaviorClaim) => `${claim.sourceLocation.relativePath}:${claim.sourceLocation.startOffset}:${claim.sourceText}`
  const rightKeys = new Set(right.map(key))
  const leftKeys = new Set(left.map(key))
  return {
    onlyLeft: left.filter((claim) => !rightKeys.has(key(claim))).map((claim) => claim.sourceText).slice(0, 5),
    onlyRight: right.filter((claim) => !leftKeys.has(key(claim))).map((claim) => claim.sourceText).slice(0, 5),
  }
}

function ClaimGroup({ label, claims, selectedClaim, onSelect }: { label: string; claims: TestStaticBehaviorClaim[]; selectedClaim: TestStaticBehaviorClaim | null; onSelect: (claim: TestStaticBehaviorClaim) => void }) {
  return <div><h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</h3><ul className="mt-1 space-y-1">{claims.map((claim) => <li key={`${claim.kind}-${claim.sourceLocation.startOffset}`} className={`rounded border border-border/30 ${selectedClaim?.sourceLocation.startOffset === claim.sourceLocation.startOffset ? "border-primary/60 bg-primary/5" : ""}`}><button type="button" className="w-full px-2 py-1.5 text-left hover:bg-primary/5" onClick={() => onSelect(claim)}><code className="break-words text-[11px]">{claim.sourceText}</code><span className="mt-1 block font-mono text-[10px] text-muted-foreground">{claim.sourceLocation.relativePath}:{claim.sourceLocation.startLine}:{claim.sourceLocation.startColumn}</span></button></li>)}</ul></div>
}

function ClaimEvidenceInspector({ claim, scenarioTitle, snapshotContext }: { claim: TestStaticBehaviorClaim; scenarioTitle: string; snapshotContext?: SnapshotEvidenceContext }) {
  return <section className="rounded border border-primary/30 bg-primary/5 p-2" aria-label="Selected static claim evidence"><h3 className="text-[11px] font-semibold uppercase tracking-wide text-primary">Selected static evidence</h3><code className="mt-1 block break-words text-[11px]">{claim.sourceText}</code><p className="mt-1 font-mono text-[10px] text-muted-foreground">{claim.sourceLocation.relativePath}:{claim.sourceLocation.startLine}:{claim.sourceLocation.startColumn}-{claim.sourceLocation.endLine}:{claim.sourceLocation.endColumn}</p><p className="mt-1 text-[10px] text-muted-foreground">{claim.evidenceKind} · claim commit {claim.commitSha}</p><p className="mt-1 text-[10px] text-muted-foreground">Scenario: {scenarioTitle}{snapshotContext ? ` · snapshot ${snapshotContext.snapshotId} · snapshot commit ${snapshotContext.commitSha}` : ""}</p></section>
}

function StateCard({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className="app-page-scroll"><div className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 py-20 text-center"><span className="text-warning">{icon}</span><h1 className="text-lg font-semibold">{title}</h1><p className="text-sm text-muted-foreground">{detail}</p></div></div>
}
