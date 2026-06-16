import {
  canManageRepository,
  canRunScan,
  canCreateRequirement,
  canRunAnalysis,
  canFinalizeAnalysis,
  canReview,
  canWriteClarification,
  canManageMembers,
  canViewReports,
  canExportReport,
  canViewDiagnostics
} from "./permissions"
import type { ProjectRole } from "@ba-helper/contracts"

describe("Frontend Permission Helpers", () => {
  const allRoles: ProjectRole[] = ["OWNER", "MAINTAINER", "ANALYST", "REVIEWER", "VIEWER"]

  function check(
    helper: (role: ProjectRole) => boolean,
    allowed: ProjectRole[]
  ) {
    for (const role of allRoles) {
      if (allowed.includes(role)) {
        expect(helper(role)).toBe(true)
      } else {
        expect(helper(role)).toBe(false)
      }
    }
  }

  it("canManageRepository is allowed for OWNER, MAINTAINER", () => {
    check(canManageRepository, ["OWNER", "MAINTAINER"])
  })

  it("canRunScan is allowed for OWNER, MAINTAINER", () => {
    check(canRunScan, ["OWNER", "MAINTAINER"])
  })

  it("canCreateRequirement is allowed for OWNER, ANALYST", () => {
    check(canCreateRequirement, ["OWNER", "ANALYST"])
  })

  it("canRunAnalysis is allowed for OWNER, ANALYST", () => {
    check(canRunAnalysis, ["OWNER", "ANALYST"])
  })

  it("canFinalizeAnalysis is allowed for OWNER, ANALYST", () => {
    check(canFinalizeAnalysis, ["OWNER", "ANALYST"])
  })

  it("canReview is allowed for OWNER, REVIEWER", () => {
    check(canReview, ["OWNER", "REVIEWER"])
  })

  it("canWriteClarification is allowed for OWNER, REVIEWER, ANALYST", () => {
    check(canWriteClarification, ["OWNER", "REVIEWER", "ANALYST"])
  })

  it("canManageMembers is allowed for OWNER", () => {
    check(canManageMembers, ["OWNER"])
  })

  it("canViewReports is allowed for all roles", () => {
    check(canViewReports, ["OWNER", "MAINTAINER", "ANALYST", "REVIEWER", "VIEWER"])
  })

  it("canExportReport is allowed for all roles", () => {
    check(canExportReport, ["OWNER", "MAINTAINER", "ANALYST", "REVIEWER", "VIEWER"])
  })

  it("canViewDiagnostics is allowed for OWNER, MAINTAINER", () => {
    check(canViewDiagnostics, ["OWNER", "MAINTAINER"])
  })
})
