import React from "react"
import Link from "next/link"
import { AlertCircle } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { useMultiRepoImpactMatrix } from "@/hooks/api/use-analyses"
import { getMultiRepoChildBlockingReasonLabel } from "@/lib/multi-repo-report-labels"
import { getLocalizedLabel, reviewDecisionLabels } from "@/lib/i18n/status-labels"
import { useLocalizedHref } from "@/i18n/navigation"

interface ImpactMatrixTableProps {
  runId: string
  onViewDetails: (analysisId: string) => void
}

export function ImpactMatrixTable({ runId, onViewDetails }: ImpactMatrixTableProps) {
  const t = useTranslations("multiRepo")
  const locale = useLocale()
  const href = useLocalizedHref()
  const { data, isLoading, error } = useMultiRepoImpactMatrix(runId)

  if (isLoading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">{t("loadingMatrix")}</div>
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center py-8 text-muted-foreground">
        <AlertCircle className="w-5 h-5 text-destructive mb-2" />
        <p className="text-[13px] font-medium text-foreground">{t("failedToLoadMatrix")}</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border bg-surface">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("domain")}</TableHead>
            <TableHead>{t("repository")}</TableHead>
            <TableHead className="text-right">{t("api")}</TableHead>
            <TableHead className="text-right">{t("service")}</TableHead>
            <TableHead className="text-right">{t("data")}</TableHead>
            <TableHead className="text-right">{t("test")}</TableHead>
            <TableHead className="text-right">{t("risks")}</TableHead>
            <TableHead className="text-right">{t("qa")}</TableHead>
            <TableHead>{t("review")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((row: import("@ba-helper/contracts").MultiRepoImpactMatrixRow) => (
            <TableRow key={row.analysisId}>
              <TableCell className="font-medium">{row.domain}</TableCell>
              <TableCell>
                <Link href={href(`/analyses/${row.analysisId}`)} className="hover:underline text-primary">
                  {row.repositoryDisplayName}
                </Link>
              </TableCell>
              <TableCell className="text-right">{row.artifactCounts.API_ENDPOINT || "-"}</TableCell>
              <TableCell className="text-right">{row.artifactCounts.DOMAIN_SERVICE || "-"}</TableCell>
              <TableCell className="text-right">{row.artifactCounts.DATA_MODEL || "-"}</TableCell>
              <TableCell className="text-right">{row.artifactCounts.TEST_CASE || "-"}</TableCell>
              <TableCell className="text-right">
                {row.riskCount > 0 ? (
                  <span className="text-destructive font-medium">{row.riskCount}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">{row.qaScenarioCount || "-"}</TableCell>
              <TableCell>
                {row.latestReviewDecision === "ACCEPTED" ? (
                  <span className="text-success font-medium">{getLocalizedLabel(reviewDecisionLabels, row.latestReviewDecision, locale)}</span>
                ) : row.latestReviewDecision === "REJECTED" ? (
                  <span className="text-destructive font-medium">{getLocalizedLabel(reviewDecisionLabels, row.latestReviewDecision, locale)}</span>
                ) : row.latestReviewDecision === "NEEDS_MORE_CLARIFICATION" ? (
                  <span className="text-warning font-medium">{t("clarification")}</span>
                ) : (
                  <span className="text-muted-foreground">{t("pending")}</span>
                )}
              </TableCell>
              <TableCell>
                <span className={`text-[12px] ${row.blockingReason === "NONE" ? "text-success" : "text-warning"}`}>
                  {getMultiRepoChildBlockingReasonLabel(row.blockingReason || "NONE", locale)}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onViewDetails(row.analysisId)}
                >
                  {t("viewDetails")}
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {data.rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={11} className="text-center text-muted-foreground h-24">
                {t("noRepositoriesInRun")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
