import { TableCell, TableRow } from "@/components/ui/table"
import { ArtifactKindBadge, CertaintyBadge, ReviewStatusBadge } from "@/components/workspace/shared/status-badges"
import { TRACE_TYPE_LABEL, type MatrixRow } from "./use-traceability-matrix"

interface MatrixTableRowProps {
  row: MatrixRow
  selectedRowId: string | null
  onRowClick: (row: MatrixRow) => void
}

export function MatrixTableRow({ row, selectedRowId, onRowClick }: MatrixTableRowProps) {
  return (
    <TableRow
      className={`cursor-pointer transition-colors hover:bg-muted/50 min-h-[40px] ${
        row.id === selectedRowId ? "bg-primary/10" : ""
      }`}
      onClick={() => onRowClick(row)}
    >
      <TableCell className="max-w-[280px] py-2 px-3">
        <div className="space-y-0.5">
          <p className="line-clamp-2 text-[13px] font-medium text-foreground leading-tight">{row.artifactName}</p>
          {row.sourceKind !== "traceability_link" ? (
            <p className="text-[11px] text-muted-foreground">{row.originalInsight?.category.replace(/_/g, " ")}</p>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="py-2 px-3">
        {row.artifactKind !== "INSIGHT" ? <ArtifactKindBadge kind={row.artifactKind} /> : <span className="text-[11px] text-muted-foreground">Insight</span>}
      </TableCell>
      <TableCell title={row.filePath} className="py-2 px-3">
        <span className="line-clamp-2 text-[11px] font-mono text-muted-foreground">{row.filePath}</span>
      </TableCell>
      <TableCell className="py-2 px-3">
        <span className="text-[13px] text-foreground">{TRACE_TYPE_LABEL[row.traceType]}</span>
      </TableCell>
      <TableCell className="py-2 px-3">
        <CertaintyBadge certainty={row.certainty} />
      </TableCell>
      <TableCell className="py-2 px-3">
        <button
          type="button"
          className="text-[12px] text-primary hover:underline"
          onClick={(event) => {
            event.stopPropagation()
            onRowClick(row)
          }}
        >
          {row.evidenceLabel}
        </button>
      </TableCell>
      <TableCell className="py-2 px-3">
        <ReviewStatusBadge status={row.reviewStatus} />
      </TableCell>
    </TableRow>
  )
}
