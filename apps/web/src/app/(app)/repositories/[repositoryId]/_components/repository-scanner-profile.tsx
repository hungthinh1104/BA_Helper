import { Activity } from "lucide-react"
import { MaturityBadge } from "@/components/workspace/shared/status-badges"
import type { RepositoryProfileResponse } from "@ba-helper/contracts"

function getScannerMaturity(profile?: RepositoryProfileResponse) {
  if (!profile) return null
  if ((profile.language as string) === "TYPESCRIPT" && (profile.framework as string) === "NESTJS") return "STABLE"
  if ((profile.language as string) === "JAVA" && (profile.framework as string) === "SPRING_BOOT") return "PARTIAL"
  if (profile.framework !== "UNKNOWN") return "EXPERIMENTAL"
  return "UNKNOWN"
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-surface-soft/40 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-[12px] font-mono text-foreground">{value}</p>
    </div>
  )
}

interface RepositoryScannerProfileProps {
  profile: RepositoryProfileResponse
}

export function RepositoryScannerProfile({ profile }: RepositoryScannerProfileProps) {
  const scannerMaturity = getScannerMaturity(profile)

  return (
    <div className="flex flex-col gap-3 p-5 rounded-xl border border-border/40 bg-surface/50 backdrop-blur-xl shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            Detected Scanner Profile
          </h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Profile is persisted on the published snapshot and only describes scanner capability, not production-grade language coverage.
          </p>
        </div>
        {scannerMaturity && (
          <MaturityBadge maturity={scannerMaturity as "STABLE" | "PARTIAL" | "EXPERIMENTAL" | "UNKNOWN"} className="text-[11px] px-2 py-1" />
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ProfileStat label="Language" value={profile.language} />
        <ProfileStat label="Framework" value={profile.framework} />
        <ProfileStat label="Architecture" value={profile.architectureStyle} />
        <ProfileStat label="Domain" value={profile.domain} />
      </div>
      {(profile.sourceRoots.length > 0 || profile.testRoots.length > 0) && (
        <p className="text-[11px] text-muted-foreground">
          Source roots: {profile.sourceRoots.length > 0 ? profile.sourceRoots.join(", ") : "—"} · Test roots:{" "}
          {profile.testRoots.length > 0 ? profile.testRoots.join(", ") : "—"}
        </p>
      )}
    </div>
  )
}
