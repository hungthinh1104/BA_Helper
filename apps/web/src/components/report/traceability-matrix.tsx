import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TraceabilityLinkListResponse } from "@ba-helper/contracts"
import { Badge } from "@/components/ui/badge"

interface TraceabilityMatrixProps {
  links: TraceabilityLinkListResponse["items"]
}

export function TraceabilityMatrix({ links }: TraceabilityMatrixProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader className="bg-surface-soft">
          <TableRow>
            <TableHead className="w-[300px]">Artifact Path</TableHead>
            <TableHead>Impact Type</TableHead>
            <TableHead>Basis</TableHead>
            <TableHead className="text-right">Review Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {links.map((link) => {
            const path = link.evidence[0]?.filePath ?? "Unknown Artifact"
            
            return (
              <TableRow key={link.id}>
                <TableCell className="font-mono text-xs">{path}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {link.linkType}
                  </Badge>
                </TableCell>
                <TableCell>
                  {link.linkBasis === "EVIDENCED" ? (
                    <Badge className="badge-confirmed scale-90">Evidenced</Badge>
                  ) : (
                    <Badge className="badge-inferred scale-90">Inferred</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {link.reviewStatus === "CONFIRMED" && <span className="text-success text-xs font-semibold">Confirmed ✓</span>}
                  {link.reviewStatus === "REJECTED" && <span className="text-danger text-xs font-semibold">Rejected ✗</span>}
                  {link.reviewStatus === "NEEDS_REVIEW" && <span className="text-warning text-xs font-semibold">Needs Review ●</span>}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
