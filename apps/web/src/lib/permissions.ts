import type { ProjectRole } from "@ba-helper/contracts"

export function canManageRepository(role: ProjectRole | null): boolean {
  return role === "OWNER" || role === "MAINTAINER"
}

export function canRunScan(role: ProjectRole | null): boolean {
  return role === "OWNER" || role === "MAINTAINER"
}

export function canCreateRequirement(role: ProjectRole | null): boolean {
  return role === "OWNER" || role === "ANALYST"
}

export function canRunAnalysis(role: ProjectRole | null): boolean {
  return role === "OWNER" || role === "ANALYST"
}

export function canFinalizeAnalysis(role: ProjectRole | null): boolean {
  return role === "OWNER" || role === "ANALYST"
}

export function canReview(role: ProjectRole | null): boolean {
  return role === "OWNER" || role === "REVIEWER"
}

export function canWriteClarification(role: ProjectRole | null): boolean {
  return role === "OWNER" || role === "REVIEWER" || role === "ANALYST"
}

export function canManageMembers(role: ProjectRole | null): boolean {
  return role === "OWNER"
}

// View-specific permissions
export function canViewReports(role: ProjectRole | null): boolean {
  // Everyone can view reports
  return !!role
}

export function canExportReport(role: ProjectRole | null): boolean {
  // Everyone in the project can export the report
  return !!role
}

export function canViewReviewQueue(role: ProjectRole | null): boolean {
  // Maintainer doesn't care about requirements/analyses
  return role === "OWNER" || role === "ANALYST" || role === "REVIEWER" || role === "VIEWER"
}

export function canViewClarification(role: ProjectRole | null): boolean {
  return role === "OWNER" || role === "ANALYST" || role === "REVIEWER" || role === "VIEWER"
}

export function canViewMultiRepo(role: ProjectRole | null): boolean {
  return role === "OWNER" || role === "MAINTAINER"
}

export function canViewDiagnostics(role: ProjectRole | null): boolean {
  return role === "OWNER" || role === "MAINTAINER"
}
