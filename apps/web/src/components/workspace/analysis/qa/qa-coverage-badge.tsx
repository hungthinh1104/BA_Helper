import React from "react"
import { useTranslations } from "next-intl"
import { ShieldAlert, ShieldCheck, Shield } from "lucide-react"
import { QaCoverageItem } from "@ba-helper/contracts"

interface Props {
  coverage: QaCoverageItem
}

export function QaCoverageBadge({ coverage }: Props) {
  const t = useTranslations("workspace")
  let colorClass = "bg-muted text-muted-foreground border-border/50"
  let Icon = Shield
  let label = t("structuralArtifact")

  if (coverage.status === "COVERED") {
    colorClass = "bg-success/10 text-success border-success/30"
    Icon = ShieldCheck
    label = t("coveredByTests")
  } else if (coverage.status === "INDIRECT_ONLY") {
    colorClass = "bg-warning/10 text-warning border-warning/30"
    Icon = Shield
    label = t("indirectCoverageOnly")
  } else if (coverage.status === "NO_TEST_FOUND") {
    colorClass = "bg-danger/10 text-danger border-danger/30"
    Icon = ShieldAlert
    label = t("coverageGap")
  }

  return (
    <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-border/50">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex-1">
          {t("qaCoverage")}
        </span>
        <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${colorClass}`}>
          <Icon className="w-3 h-3" />
          {label}
        </span>
      </div>

      <div className="text-[11.5px] text-foreground/80 leading-snug bg-surface-muted px-2.5 py-2 rounded-md border border-border/50">
        <span className="font-semibold block mb-0.5 text-foreground">{t("suggestedAction")}:</span>
        <span className="text-muted-foreground">{coverage.suggestedAction}</span>
      </div>

      {coverage.status === "COVERED" && coverage.testArtifacts.length > 0 && (
        <div className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground/70 mr-1.5">{t("coveredBy")}</span>
          {coverage.testArtifacts.slice(0, 2).map((testNode: { id: string; label: string }, i: number) => (
            <span key={testNode.id}>
              {i > 0 && ", "}
              <span className="font-mono text-foreground/90">{testNode.label}</span>
            </span>
          ))}
          {coverage.testArtifacts.length > 2 && ` ${t("more", { count: coverage.testArtifacts.length - 2 })}`}
        </div>
      )}
      
      {coverage.status === "NO_TEST_FOUND" && (
        <div className="text-[11px] text-danger/80 italic mt-0.5">
          {t("noTestArtifact")}
        </div>
      )}
    </div>
  )
}
