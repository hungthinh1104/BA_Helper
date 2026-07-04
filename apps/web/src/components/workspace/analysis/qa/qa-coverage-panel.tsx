import React, { useState } from "react"
import { useTranslations } from "next-intl"
import { ShieldCheck, ShieldAlert, Shield, ChevronRight, FileCode2 } from "lucide-react"
import { QaCoverageItem } from "@ba-helper/contracts"
import { DenseCard, DenseCardDescription, DenseCardHeader, DenseCardTitle } from "../../shared/dense-card"

interface Props {
  coverageItems: QaCoverageItem[]
  onSelectArtifact: (artifactId: string) => void
}

export function QaCoveragePanel({ coverageItems, onSelectArtifact }: Props) {
  const t = useTranslations("workspace")
  const [filter, setFilter] = useState<"ALL" | "GAP_ONLY">("ALL")
  
  const displayItems = filter === "GAP_ONLY" 
    ? coverageItems.filter(item => item.status === "NO_TEST_FOUND" || item.status === "INDIRECT_ONLY")
    : coverageItems

  return (
    <div className="flex flex-col gap-6 max-w-4xl pb-12">
      <DenseCardHeader className="flex-row items-center justify-between p-0">
        <div className="space-y-0.5">
          <DenseCardTitle>{t("qaCoverageGapMap")}</DenseCardTitle>
          <DenseCardDescription>{t("qaCoverageDescription")}</DenseCardDescription>
        </div>
        <div className="flex bg-surface-muted border border-border rounded-md overflow-hidden text-[11px] font-medium">
          <button 
            className={`px-3 py-1.5 ${filter === "ALL" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setFilter("ALL")}
          >
            {t("all")}
          </button>
          <button 
            className={`px-3 py-1.5 border-l border-border ${filter === "GAP_ONLY" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setFilter("GAP_ONLY")}
          >
            {t("gapsOnly")}
          </button>
        </div>
      </DenseCardHeader>
      
      <div className="flex flex-col gap-3">
        {displayItems.length === 0 ? (
          <DenseCard variant="muted" className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <ShieldCheck className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm font-medium">{t("noArtifactsFound")}</p>
          </DenseCard>
        ) : (
          displayItems.map(item => (
            <QaCoverageRow key={item.artifactId} item={item} onClick={() => onSelectArtifact(item.artifactId)} />
          ))
        )}
      </div>
    </div>
  )
}

function QaCoverageRow({ item, onClick }: { item: QaCoverageItem, onClick: () => void }) {
  const t = useTranslations("workspace")
  let colorClass = "bg-muted text-muted-foreground border-border/50"
  let Icon = Shield
  let statusText = t("structural")

  if (item.status === "COVERED") {
    colorClass = "bg-success/10 text-success border-success/30"
    Icon = ShieldCheck
    statusText = t("covered")
  } else if (item.status === "INDIRECT_ONLY") {
    colorClass = "bg-warning/10 text-warning border-warning/30"
    Icon = Shield
    statusText = t("indirectOnly")
  } else if (item.status === "NO_TEST_FOUND") {
    colorClass = "bg-danger/10 text-danger border-danger/30"
    Icon = ShieldAlert
    statusText = t("noTestFound")
  }
  
  let riskClass = "text-muted-foreground"
  if (item.severity === "HIGH" && item.status === "NO_TEST_FOUND") riskClass = "text-danger"
  else if (item.severity === "MEDIUM" && item.status === "NO_TEST_FOUND") riskClass = "text-warning"
  
  return (
    <DenseCard
      role="button"
      tabIndex={0}
      className="group relative flex flex-col p-3 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer"
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onClick()
        }
      }}
    >
      <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>

      <div className="flex items-center gap-2 mb-2 pr-6">
        <span className={`flex items-center justify-center w-5 h-5 rounded shrink-0 bg-info/10 text-info`}>
          <FileCode2 className="w-3 h-3" />
        </span>
        <span className="font-mono text-[12px] font-semibold text-foreground truncate">{item.artifactLabel}</span>
        <span className="badge badge-neutral text-[9px] uppercase tracking-wider shrink-0">{item.artifactType}</span>
      </div>

      <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-2 mt-2">
        <div className="text-[10px] uppercase font-semibold text-muted-foreground">{t("status")}</div>
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${colorClass}`}>
            <Icon className="w-3 h-3" />
            {statusText}
          </span>
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${riskClass}`}>
            ({t("riskSuffix", { severity: item.severity })})
          </span>
        </div>
        
        {item.status === "COVERED" && item.testArtifacts.length > 0 && (
          <>
            <div className="text-[10px] uppercase font-semibold text-muted-foreground">{t("tests")}</div>
            <div className="text-[11px] font-mono text-foreground/80 truncate">
              {item.testArtifacts.map(n => n.label).join(", ")}
            </div>
          </>
        )}

        <div className="text-[10px] uppercase font-semibold text-muted-foreground mt-0.5">{t("action")}</div>
        <div className="text-[11px] text-foreground/80 leading-snug">
          {item.suggestedAction}
        </div>
      </div>
    </DenseCard>
  )
}
