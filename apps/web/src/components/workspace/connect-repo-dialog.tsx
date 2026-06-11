"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { repositoryCreateRequestSchema } from "@ba-helper/contracts"
import { useCreateRepository } from "@/hooks/api/use-repositories"
import { X, GitBranch, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface ConnectRepoDialogProps {
  children: React.ReactNode
}

const GITHUB_URL_RE = /^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/i

export function ConnectRepoDialog({ children }: ConnectRepoDialogProps) {
  const { mutateAsync: connectRepo, isPending: loading } = useCreateRepository("default-project")
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [ref, setRef] = useState("")

  const urlError = url.length > 0 && !GITHUB_URL_RE.test(url.trim())
  const canSubmit = url.trim().length > 0 && GITHUB_URL_RE.test(url.trim()) && !loading

  const reset = () => {
    setUrl("")
    setRef("")
  }

  const handleSubmit = async () => {
    if (!GITHUB_URL_RE.test(url.trim())) return
    const parseResult = repositoryCreateRequestSchema.safeParse({ url: url.trim() })
    if (!parseResult.success) return
    
    try {
      await connectRepo({
        url: url.trim().replace(/\/$/, ""),
      })
      toast.success("Repository connected", {
        description: `Scan job started for ${url.trim().split("/").slice(-2).join("/")}.`,
      })
      setOpen(false)
      reset()
    } catch (err: unknown) {
      toast.error("Failed to connect repository", {
        description: err instanceof Error ? err.message : "Please try again.",
      })
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

          <div className="p-3 bg-surface-muted/50 border border-border/60 rounded-lg text-[12px] text-muted-foreground leading-relaxed">
            Only public GitHub repositories are supported in MVP. A scan job will start automatically after connecting.
          </div>

          <div className="-mx-6 px-6 py-4 border-t border-border/60 bg-surface-muted/30 flex justify-end gap-2">
            <DialogClose render={<Button variant="outline" size="sm" className="h-8 shadow-none">Cancel</Button>} />
            <Button size="sm" className="h-8 shadow-none" disabled={!canSubmit} onClick={handleSubmit}>
              {loading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {loading ? "Connecting..." : "Connect & Scan"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
