"use client"

import { use } from "react"
import type { ReactNode } from "react"
import { AlertTriangle, CheckCircle2, FileCode2, GitBranch, Loader2 } from "lucide-react"
import { WorkspacePageHeader } from "@/components/workspace/shared/page-header"
import { BackButton } from "@/components/workspace/shared/back-button"
import { useLocalizedHref } from "@/i18n/navigation"
import { mergeComprehensionPages, useCodeComprehension } from "@/hooks/api/use-code-comprehension"
import { ScenarioList } from "./_components/scenario-list"
import type { CodeComprehensionResponse } from "@ba-helper/contracts"

interface PageProps {
  params: Promise<{ repositoryId: string; snapshotId: string; artifactId: string }>
  searchParams: Promise<{ studyCondition?: string | string[] }>
}

export default function CodeComprehensionPage({ params, searchParams }: PageProps) {
  const { repositoryId, snapshotId, artifactId } = use(params)
  const { studyCondition: requestedCondition } = use(searchParams)
  const studyCondition = Array.isArray(requestedCondition) ? requestedCondition[0] : requestedCondition
  const isExistingWorkflow = studyCondition === "EXISTING_WORKFLOW"
  const href = useLocalizedHref()
  const query = useCodeComprehension(snapshotId, artifactId, !isExistingWorkflow)
  const data = mergeComprehensionPages(query.data?.pages ?? [])

  if (isExistingWorkflow) {
    return <StateCard icon={<FileCode2 className="h-5 w-5" />} title="Use the existing workflow" detail="This study condition is completed in the participant’s normal IDE and AI workflow, outside BA Helper." />
  }

  if (query.isLoading) {
    return <StateCard icon={<Loader2 className="h-5 w-5 animate-spin" />} title="Loading code evidence" detail="Reading the bounded projection for this immutable snapshot." />
  }
  if ((query.isError && !data) || !data) {
    return <StateCard icon={<AlertTriangle className="h-5 w-5" />} title="Code evidence unavailable" detail={query.error instanceof Error ? query.error.message : "The snapshot or artifact could not be read."} />
  }

  const tracePresentation = studyCondition === "TEXTUAL_EVIDENCE"
    ? "TEXTUAL_EVIDENCE"
    : studyCondition === "VISUAL_TEST_TRACE" ? "VISUAL_TEST_TRACE" : "NORMAL"

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
            <ScenarioList
              scenarios={data.relatedScenarios}
              snapshotContext={data.snapshotContext}
              pagination={data.scenarioPagination}
              limitations={data.limitations}
              hasNextPage={Boolean(query.hasNextPage)}
              isFetchingNextPage={query.isFetchingNextPage}
              isFetchNextPageError={query.isFetchNextPageError}
              onLoadMore={() => { void query.fetchNextPage() }}
              tracePresentation={tracePresentation}
            />
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

function StateCard({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className="app-page-scroll"><div className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 py-20 text-center"><span className="text-warning">{icon}</span><h1 className="text-lg font-semibold">{title}</h1><p className="text-sm text-muted-foreground">{detail}</p></div></div>
}
