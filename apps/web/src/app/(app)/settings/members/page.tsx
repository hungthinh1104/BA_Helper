"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { WorkspacePageHeader } from "@/components/workspace/shared/page-header"
import {
  useProjectMembers,
  useRemoveProjectMember,
  useUpdateProjectMember,
  useUpsertProjectMember,
} from "@/hooks/api/use-projects"
import { useCurrentWorkspace } from "@/lib/project-context"
import {
  canCreateRequirement,
  canFinalizeAnalysis,
  canManageMembers,
  canManageRepository,
  canReview,
  canRunAnalysis,
  canRunScan,
} from "@/lib/permissions"
import type { ProjectRole } from "@ba-helper/contracts"

const ROLE_OPTIONS: ProjectRole[] = [
  "OWNER",
  "MAINTAINER",
  "ANALYST",
  "REVIEWER",
  "VIEWER",
]

const ROLE_CAPABILITIES = [
  { key: "members", labelKey: "capabilityMembers", check: canManageMembers },
  { key: "repositories", labelKey: "capabilityRepositories", check: canManageRepository },
  { key: "scans", labelKey: "capabilityScans", check: canRunScan },
  { key: "requirements", labelKey: "capabilityRequirements", check: canCreateRequirement },
  { key: "analyses", labelKey: "capabilityAnalyses", check: canRunAnalysis },
  { key: "review", labelKey: "capabilityReview", check: canReview },
  { key: "finalize", labelKey: "capabilityFinalize", check: canFinalizeAnalysis },
] as const

export default function ProjectMembersPage() {
  const t = useTranslations("settings")
  const workspace = useCurrentWorkspace()
  const members = useProjectMembers(workspace.projectId)
  const addMember = useUpsertProjectMember(workspace.projectId)
  const updateMember = useUpdateProjectMember(workspace.projectId)
  const removeMember = useRemoveProjectMember(workspace.projectId)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<ProjectRole>("VIEWER")

  const canManage = canManageMembers(workspace.membershipRole)
  const memberItems = members.data?.items ?? []
  const roleCounts = ROLE_OPTIONS.map((option) => ({
    role: option,
    count: memberItems.filter((member) => member.role === option).length,
  }))

  async function handleAddMember() {
    try {
      await addMember.mutateAsync({
        email: email.trim(),
        role,
      })
      setEmail("")
      setRole("VIEWER")
      toast.success(t("memberUpdated"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failedUpdateMembership"))
    }
  }

  async function handleRoleChange(userId: string, nextRole: ProjectRole) {
    try {
      await updateMember.mutateAsync({
        userId,
        input: { role: nextRole },
      })
      toast.success(t("membershipRoleUpdated"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failedUpdateMembershipRole"))
    }
  }

  async function handleRemove(userId: string) {
    try {
      await removeMember.mutateAsync(userId)
      toast.success(t("memberRemoved"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failedRemoveMember"))
    }
  }

  return (
    <div className="app-page-scroll">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-4">
        <WorkspacePageHeader
          title={t("projectMembers")}
          description={t("projectMembersDescription")}
        />

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>{workspace.name}</CardTitle>
              <CardDescription>
                {t("currentMembershipRole", {
                  role: workspace.membershipRole ?? t("noMembershipResolved"),
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/60 bg-surface-muted/40 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("activeMembers")}
                </div>
                <div className="mt-2 text-2xl font-semibold text-foreground">
                  {members.isLoading ? "..." : memberItems.length}
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-surface-muted/40 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("managementAccess")}
                </div>
                <div className="mt-2">
                  <Badge variant={canManage ? "default" : "outline"}>
                    {canManage ? t("ownerAccess") : t("readOnlyAccess")}
                  </Badge>
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-surface-muted/40 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("permissionSource")}
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                  {t("permissionSourceDescription")}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("roleDistribution")}</CardTitle>
              <CardDescription>{t("roleDistributionDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {roleCounts.map((item) => (
                <div
                  key={item.role}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                >
                  <div>
                    <div className="text-[13px] font-semibold text-foreground">
                      {t(`roles.${item.role}.title`)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {item.role}
                    </div>
                  </div>
                  <Badge variant="outline">{item.count}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("addProjectMember")}</CardTitle>
            <CardDescription>{t("addProjectMemberDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
            <Input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="existing-user@ba-helper.local"
              disabled={!canManage || addMember.isPending}
            />
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as ProjectRole)}
              disabled={!canManage || addMember.isPending}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(`roles.${option}.title`)}
                </option>
              ))}
            </select>
            <Button
              onClick={() => void handleAddMember()}
              disabled={!canManage || addMember.isPending || !email.trim()}
            >
              {t("addMember")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("roleCapabilityMatrix")}</CardTitle>
            <CardDescription>{t("roleCapabilityMatrixDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("capability")}</TableHead>
                  {ROLE_OPTIONS.map((option) => (
                    <TableHead key={option} className="text-center">
                      {t(`roles.${option}.title`)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ROLE_CAPABILITIES.map((capability) => (
                  <TableRow key={capability.key}>
                    <TableCell className="font-medium">
                      {t(capability.labelKey)}
                    </TableCell>
                    {ROLE_OPTIONS.map((option) => (
                      <TableCell key={option} className="text-center">
                        {capability.check(option) ? (
                          <span className="text-[12px] font-semibold text-primary">
                            {t("allowed")}
                          </span>
                        ) : (
                          <span className="text-[12px] text-muted-foreground">
                            {t("notAllowed")}
                          </span>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("memberList")}</CardTitle>
            <CardDescription>
              {t("memberListDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead>{t("created")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <span className="text-[13px]">{t("loadingMembers")}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : members.isError ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2 text-danger">
                        <span className="text-[13px]">{t("failedLoadMembers")}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : members.data?.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {t("noMembersFound")}
                    </TableCell>
                  </TableRow>
                ) : (
                  members.data?.items.map((member) => (
                    <TableRow key={member.userId}>
                      <TableCell>{member.name ?? t("unknownUser")}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        <select
                          value={member.role}
                          onChange={(event) =>
                            void handleRoleChange(
                              member.userId,
                              event.target.value as ProjectRole,
                            )
                          }
                          disabled={!canManage || updateMember.isPending}
                          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
                        >
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {t(`roles.${option}.title`)}
                            </option>
                          ))}
                        </select>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {member.role}
                        </div>
                      </TableCell>
                      <TableCell>{new Date(member.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger
                            disabled={!canManage || removeMember.isPending}
                            render={<Button variant="outline" size="sm">{t("remove")}</Button>}
                          />
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("removeMemberQuestion")}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("removeMemberDescription", { email: member.email })}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => void handleRemove(member.userId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                {t("remove")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
