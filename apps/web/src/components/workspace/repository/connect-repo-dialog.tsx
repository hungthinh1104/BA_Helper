"use client"

import { useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { repositoryCreateRequestSchema, scanJobCreateRequestSchema } from "@ba-helper/contracts"
import { useCreateRepository } from "@/hooks/api/use-repositories"
import { useCreateScanJob } from "@/hooks/api/use-scan-jobs"
import { X, AlertCircle, Loader2, GitBranch, LockKeyhole, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { ApiError } from "@/lib/api-error"
import { useTranslations } from "next-intl"
import { parseGithubRepositoryUrl } from "@/lib/github-repository-url"

interface ConnectRepoDialogProps {
  children: React.ReactNode
}

const TESTED_DEMO_REPO_URL = "https://github.com/ndmen/booking"
const TESTED_DEMO_REPO_REF = "main"

export function ConnectRepoDialog({ children }: ConnectRepoDialogProps) {
  const t = useTranslations("workspaceLists")
  const { mutateAsync: connectRepo, isPending: loading } = useCreateRepository()
  const { mutateAsync: createScanJob } = useCreateScanJob(undefined)
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [ref, setRef] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [connectedRepositoryId, setConnectedRepositoryId] = useState<string | null>(null)
  const [scanFailed, setScanFailed] = useState(false)
  const pendingScanRef = useRef<{
    repositoryId: string
    requestKey: string
    ref?: string
  } | null>(null)
  const router = useRouter()

  const parsedRepository = parseGithubRepositoryUrl(url)
  const urlError = url.length > 0 && !parsedRepository
  const canSubmit = Boolean(parsedRepository) && !loading && !isSubmitting

  const reset = () => {
    setUrl("")
    setRef("")
    setConnectedRepositoryId(null)
    setScanFailed(false)
    pendingScanRef.current = null
  }

  const applyTestedDemoRepo = () => {
    setUrl(TESTED_DEMO_REPO_URL)
    setRef(TESTED_DEMO_REPO_REF)
  }

  const handleScanQueueFailure = (err: unknown) => {
    const code = err instanceof ApiError ? err.code : "SCAN_QUEUE_FAILED"
    const message = err instanceof Error ? err.message : t("scanJobCouldNotQueue")

    setScanFailed(true)
    toast.warning(t("repositoryConnectedScanFailed"), {
      description: `${code}: ${message}`,
    })
  }

  const handleSubmit = async () => {
    const repository = parseGithubRepositoryUrl(url)
    if (!repository) return
    const isScanRetry = Boolean(connectedRepositoryId)

    const parseResult = repositoryCreateRequestSchema.safeParse({ url: repository.canonicalUrl })
    if (!parseResult.success) return

    setIsSubmitting(true)
    setScanFailed(false)
    try {
      let pendingScan = pendingScanRef.current
      if (!pendingScan) {
        const repo = await connectRepo({ url: repository.canonicalUrl })
        pendingScan = {
          repositoryId: repo.repositoryId,
          requestKey: crypto.randomUUID(),
          ref: ref.trim() ? ref.trim() : undefined,
        }
        pendingScanRef.current = pendingScan
        setConnectedRepositoryId(repo.repositoryId)
      }

      const scanInput = scanJobCreateRequestSchema.parse({
        requestKey: pendingScan.requestKey,
        ref: pendingScan.ref,
      })

      try {
        await createScanJob({ repositoryId: pendingScan.repositoryId, ...scanInput })
      } catch (err) {
        handleScanQueueFailure(err)
        return
      }

      pendingScanRef.current = null
      toast.success(t(isScanRetry ? "scanQueued" : "repositoryConnected"), {
        description: isScanRetry
          ? t("scanQueuedDescription")
          : t("scanJobQueuedFor", { repo: repository.fullName }),
      })
      setOpen(false)
      reset()
      router.push(`/repositories/${pendingScan.repositoryId}`)
    } catch (err: unknown) {
      toast.error(t("failedConnectRepository"), {
        description: err instanceof Error ? err.message : t("pleaseTryAgain"),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitLabel = connectedRepositoryId ? t("retryScan") : t("connectAndScan")
  const busyLabel = connectedRepositoryId ? t("queuing") : t("connecting")

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-muted-foreground" />
              <div>
                <DialogTitle className="text-[15px]">{t("connectRepository")}</DialogTitle>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {t("githubConnectSubtitle")}
                </p>
              </div>
            </div>
            <DialogClose className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors">
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 flex flex-col gap-5">
          {/* URL */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">{t("githubRepositoryUrl")}</label>
            <Input
              aria-invalid={urlError}
              className="bg-surface"
              placeholder="https://github.com/org/repo"
              value={url}
              disabled={Boolean(connectedRepositoryId)}
              onChange={e => setUrl(e.target.value)}
            />
            {urlError && (
              <div className="flex items-center gap-1.5 text-[11px] text-destructive">
                <AlertCircle className="w-3.5 h-3.5" />
                {t("invalidGithubUrl")}
              </div>
            )}
            {parsedRepository && (
              <div className="rounded-lg border border-border/60 bg-surface-muted/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[13px] font-semibold text-foreground">
                        {parsedRepository.fullName}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {parsedRepository.canonicalUrl}
                    </p>
                  </div>
                  <Badge variant="outline">{t("publicRepository")}</Badge>
                </div>
              </div>
            )}
          </div>

          {/* Branch/Ref */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t("branchRef")} <span className="normal-case font-normal">{t("optionalDefaultsMain")}</span>
            </label>
            <Input
              className="bg-surface"
              placeholder="main"
              value={ref}
              disabled={Boolean(connectedRepositoryId)}
              onChange={e => setRef(e.target.value)}
            />
          </div>

          {scanFailed && (
            <div role="status" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-[12px] text-foreground">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>{t("scanRetryDescription")}</span>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-surface-muted/50 p-3">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-[12px] font-semibold text-foreground">
                    {t("publicGithubOnlyTitle")}
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    {t("publicGithubOnly")}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-surface-muted/50 p-3">
              <div className="flex items-start gap-2">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-[12px] font-semibold text-foreground">
                    {t("privateRepoNotEnabledTitle")}
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    {t("privateRepoNotEnabled")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-background/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[12px] font-semibold text-foreground">
                  {t("testedDemoRepo")}
                </div>
                <div className="mt-1 rounded-md border border-border/50 bg-surface-muted/60 px-2 py-1.5 text-[11px] font-mono text-foreground/80">
                  {TESTED_DEMO_REPO_URL} · ref: {TESTED_DEMO_REPO_REF}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0 shadow-none"
                onClick={applyTestedDemoRepo}
              >
                {t("useTestedDemoRepo")}
              </Button>
            </div>
          </div>

          <div className="-mx-6 px-6 py-4 border-t border-border/60 bg-surface-muted/30 flex justify-end gap-2">
            <DialogClose render={<Button variant="outline" size="sm" className="h-8 shadow-none">{t("cancel")}</Button>} />
            <Button size="sm" className="h-8 shadow-none" disabled={!canSubmit} onClick={handleSubmit}>
              {(loading || isSubmitting) && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {loading || isSubmitting ? busyLabel : submitLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
