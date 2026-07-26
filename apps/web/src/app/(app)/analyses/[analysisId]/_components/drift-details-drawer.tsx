"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useSnapshotDrift } from "@/hooks/api/use-repositories"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FilePlus, FileMinus, FileEdit, HelpCircle, Loader2 } from "lucide-react"

interface DriftDetailsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string | undefined
  repositoryId: string | undefined
  baseSnapshotId: string | undefined
  targetCommitSha?: string
}

export function DriftDetailsDrawer({
  open,
  onOpenChange,
  projectId,
  repositoryId,
  baseSnapshotId,
  targetCommitSha,
}: DriftDetailsDrawerProps) {
  const t = useTranslations("workspace")
  // We only enable the query when the drawer is open to fetch lazily
  const { data: drift, isLoading, isError } = useSnapshotDrift(
    projectId,
    repositoryId,
    baseSnapshotId,
    targetCommitSha,
    { enabled: open }
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-hidden flex flex-col">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle>{t("snapshotDriftDetails")}</SheetTitle>
          <SheetDescription>
            {t("snapshotDriftDetailsDescription")}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 py-4">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <p>{t("loadingDriftDetails")}</p>
            </div>
          )}

          {isError && (
            <div className="text-destructive text-sm py-4">
              {t("failedLoadDriftDetails")}
            </div>
          )}

          {drift && (
            <div className="space-y-6">
              {drift.samples.addedArtifacts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2 text-success">
                    <FilePlus className="w-4 h-4" /> {t("addedArtifactsWithCount", { count: drift.samples.addedArtifacts.length })}
                  </h4>
                  <ul className="text-sm space-y-1 pl-6">
                    {drift.samples.addedArtifacts.map((art) => (
                      <li key={art.artifactKey} className="text-muted-foreground">{art.artifactKey}</li>
                    ))}
                  </ul>
                </div>
              )}

              {drift.samples.removedArtifacts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2 text-danger">
                    <FileMinus className="w-4 h-4" /> {t("removedArtifactsWithCount", { count: drift.samples.removedArtifacts.length })}
                  </h4>
                  <ul className="text-sm space-y-1 pl-6">
                    {drift.samples.removedArtifacts.map((art) => (
                      <li key={art.artifactKey} className="text-muted-foreground line-through">{art.artifactKey}</li>
                    ))}
                  </ul>
                </div>
              )}

              {drift.samples.changedArtifacts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2 text-info">
                    <FileEdit className="w-4 h-4" /> {t("changedArtifactsWithCount", { count: drift.samples.changedArtifacts.length })}
                  </h4>
                  <ul className="text-sm space-y-1 pl-6">
                    {drift.samples.changedArtifacts.map((art) => (
                      <li key={art.artifactKey} className="text-muted-foreground">{art.artifactKey}</li>
                    ))}
                  </ul>
                </div>
              )}

              {drift.samples.unknownChangedArtifacts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2 text-warning">
                    <HelpCircle className="w-4 h-4" /> {t("unknownChangedArtifactsWithCount", { count: drift.samples.unknownChangedArtifacts.length })}
                  </h4>
                  <ul className="text-sm space-y-1 pl-6">
                    {drift.samples.unknownChangedArtifacts.map((art) => (
                      <li key={art.artifactKey} className="text-muted-foreground">{art.artifactKey}</li>
                    ))}
                  </ul>
                </div>
              )}

              {drift.samples.addedArtifacts.length === 0 &&
                drift.samples.removedArtifacts.length === 0 &&
                drift.samples.changedArtifacts.length === 0 &&
                drift.samples.unknownChangedArtifacts.length === 0 && (
                <p className="text-sm text-muted-foreground italic">{t("noArtifactChangesDetected")}</p>
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
