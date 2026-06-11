"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { repositoryCreateRequestSchema, scanJobCreateRequestSchema, scanJobResponseSchema } from "@ba-helper/contracts"
import { useCreateRepository } from "@/hooks/api/use-repositories"
import { X, GitBranch, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { apiPost } from "@/lib/api-client"
import { ApiError } from "@/lib/api-error"

interface ConnectRepoDialogProps {
  children: React.ReactNode
}

const GITHUB_URL_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/i
const TESTED_DEMO_REPO_URL = "https://github.com/ndmen/booking"
const TESTED_DEMO_REPO_REF = "main"

export function ConnectRepoDialog({ children }: ConnectRepoDialogProps) {
  const { mutateAsync: connectRepo, isPending: loading } = useCreateRepository()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [ref, setRef] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const urlError = url.length > 0 && !GITHUB_URL_RE.test(url.trim())
  const canSubmit = url.trim().length > 0 && GITHUB_URL_RE.test(url.trim()) && !loading && !isSubmitting

  const reset = () => {
    setUrl("")
    setRef("")
  }

  const applyTestedDemoRepo = () => {
    setUrl(TESTED_DEMO_REPO_URL)
    setRef(TESTED_DEMO_REPO_REF)
  }

  const handleScanQueueFailure = (repositoryId: string, err: unknown) => {
    const code = err instanceof ApiError ? err.code : "SCAN_QUEUE_FAILED"
    const message = err instanceof Error ? err.message : "The scan job could not be queued."

    toast.warning("Repository connected, but scan could not start", {
      description: `${code}: ${message}`,
    })

    setOpen(false)
    reset()
    router.push(`/repositories/${repositoryId}`)
  }

  const handleSubmit = async () => {
    if (!GITHUB_URL_RE.test(url.trim())) return
    const parseResult = repositoryCreateRequestSchema.safeParse({ url: url.trim() })
    if (!parseResult.success) return

    setIsSubmitting(true)
    try {
      const repo = await connectRepo({
        url: url.trim().replace(/\/$/, ""),
      })

      const scanInput = scanJobCreateRequestSchema.parse({
        requestKey: crypto.randomUUID(),
        ref: ref.trim() ? ref.trim() : undefined,
      })

      try {
        await apiPost(
          `/api/v1/repositories/${repo.repositoryId}/scan-jobs`,
          scanInput,
          scanJobResponseSchema,
        )
      } catch (err) {
        handleScanQueueFailure(repo.repositoryId, err)
        return
      }

      toast.success("Repository connected", {
        description: `Scan job queued for ${url.trim().split("/").slice(-2).join("/")}.`,
      })
      setOpen(false)
      reset()
      router.push(`/repositories/${repo.repositoryId}`)
    } catch (err: unknown) {
      toast.error("Failed to connect repository", {
        description: err instanceof Error ? err.message : "Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-md p-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-muted-foreground" />
              <DialogTitle className="text-[15px]">Connect Repository</DialogTitle>
            </div>
            <DialogClose className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors">
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 flex flex-col gap-5">
          {/* URL */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">GitHub Repository URL</label>
            <input
              className={`w-full h-9 px-3 rounded-lg border text-[13px] text-foreground placeholder:text-muted-foreground/50 bg-surface focus:outline-none focus:ring-2 transition-all ${
                urlError ? "border-destructive/50 focus:ring-destructive/20" : "border-border focus:ring-primary/30 focus:border-primary/50"
              }`}
              placeholder="https://github.com/org/repo"
              value={url}
              onChange={e => setUrl(e.target.value)}
            />
            {urlError && (
              <div className="flex items-center gap-1.5 text-[11px] text-destructive">
                <AlertCircle className="w-3.5 h-3.5" />
                Must be a valid public GitHub URL (https://github.com/org/repo)
              </div>
            )}
          </div>

          {/* Branch/Ref */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">
              Branch / Ref <span className="normal-case font-normal">(optional, defaults to main)</span>
            </label>
            <input
              className="w-full h-9 px-3 rounded-lg border border-border bg-surface text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              placeholder="main"
              value={ref}
              onChange={e => setRef(e.target.value)}
            />
          </div>

          <div className="rounded-lg border border-border/60 bg-surface-muted/50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[12px] text-muted-foreground leading-relaxed">
                Only public GitHub repositories are supported in MVP. A scan job will start automatically after connecting.
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0 shadow-none"
                onClick={applyTestedDemoRepo}
              >
                Use Tested Demo Repo
              </Button>
            </div>
            <div className="mt-2 rounded-md border border-border/50 bg-background/60 px-2 py-1.5 text-[11px] font-mono text-foreground/80">
              {TESTED_DEMO_REPO_URL} · ref: {TESTED_DEMO_REPO_REF}
            </div>
          </div>

          <div className="-mx-6 px-6 py-4 border-t border-border/60 bg-surface-muted/30 flex justify-end gap-2">
            <DialogClose render={<Button variant="outline" size="sm" className="h-8 shadow-none">Cancel</Button>} />
            <Button size="sm" className="h-8 shadow-none" disabled={!canSubmit} onClick={handleSubmit}>
              {(loading || isSubmitting) && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {loading || isSubmitting ? "Connecting..." : "Connect & Scan"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
