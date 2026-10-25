"use client"

import { lazy, Suspense, useState } from "react"
import { ArrowRight } from "lucide-react"
import type { CodeComprehensionResponse, ComprehensionScenario, TestStaticBehaviorClaim } from "@ba-helper/contracts"

const CodeComprehensionTraceFlow = lazy(() => import("./code-comprehension-trace-flow").then((module) => ({ default: module.CodeComprehensionTraceFlow })))

type SnapshotEvidenceContext = Pick<CodeComprehensionResponse["snapshotContext"], "snapshotId" | "commitSha">
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

