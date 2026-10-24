"use client"

import Link from "next/link"
import { useState } from "react"
import { FileCode2, Loader2, SearchX } from "lucide-react"
import { useLocalizedHref } from "@/i18n/navigation"
import { useSnapshotArtifacts } from "@/hooks/api/use-code-comprehension"

const PRODUCTION_TYPES = new Set(["CONTROLLER", "API_ROUTE", "SERVICE", "SERVICE_METHOD", "ENTITY"])

export function CodeEvidenceNavigator({ repositoryId, snapshotId }: { repositoryId: string; snapshotId?: string }) {
  const href = useLocalizedHref()
  const [open, setOpen] = useState(false)
  const { data, isLoading, isError } = useSnapshotArtifacts(snapshotId, open)
  const artifacts = (data?.items ?? []).filter((item) => PRODUCTION_TYPES.has(item.artifactType)).slice(0, 50)

  return (
    <section className="rounded-xl border border-border/40 bg-surface/50 p-5 shadow-sm" aria-label="Code evidence">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button type="button" aria-expanded={open} aria-controls="code-evidence-content" onClick={() => setOpen(value => !value)} className="text-left text-[15px] font-semibold text-foreground hover:text-primary">Code evidence</button>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Browse persisted source, static call paths, and related Jest declarations from the selected snapshot.
          </p>
        </div>
        <FileCode2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>

      {!snapshotId && (
        <p className="mt-4 text-[12px] text-muted-foreground">A usable snapshot is required before code evidence can be opened.</p>
      )}
      {snapshotId && !open && (
        <p className="mt-4 text-[12px] text-muted-foreground">Open this panel to load the bounded artifact index.</p>
      )}
      {open && <div id="code-evidence-content">
      {snapshotId && isLoading && (
        <div className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading production artifacts…</div>
      )}
      {snapshotId && isError && (
        <p className="mt-4 text-[12px] text-danger">The artifact index could not be loaded. Snapshot permissions or availability may have changed.</p>
      )}
      {snapshotId && !isLoading && !isError && artifacts.length === 0 && (
        <div className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground"><SearchX className="h-3.5 w-3.5" /> No supported production artifacts were indexed.</div>
      )}
      {artifacts.length > 0 && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {artifacts.map((artifact) => (
            <li key={artifact.id}>
              <Link
                href={href(`/repositories/${repositoryId}/snapshots/${snapshotId}/artifacts/${artifact.id}`)}
                className="block rounded-lg border border-border/50 bg-background/40 px-3 py-2 transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <span className="block truncate text-[13px] font-medium text-foreground">{artifact.name}</span>
                <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
                  {artifact.filePath}:{artifact.startLine ?? "?"} · {artifact.artifactType}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      </div>}
    </section>
  )
}
