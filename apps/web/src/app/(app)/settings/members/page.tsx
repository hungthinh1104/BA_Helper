"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import { WorkspacePageHeader } from "@/components/workspace/page-header"
import {
  useProjectMembers,
  useRemoveProjectMember,
  useUpdateProjectMember,
  useUpsertProjectMember,
} from "@/hooks/api/use-projects"
import { useCurrentWorkspace } from "@/lib/project-context"
import type { ProjectRole } from "@ba-helper/contracts"

const ROLE_OPTIONS: ProjectRole[] = [
  "OWNER",
  "MAINTAINER",
  "ANALYST",
  "REVIEWER",
  "VIEWER",
]

export default function ProjectMembersPage() {
  const workspace = useCurrentWorkspace()
  const members = useProjectMembers(workspace.projectId)
  const addMember = useUpsertProjectMember(workspace.projectId)
  const updateMember = useUpdateProjectMember(workspace.projectId)
  const removeMember = useRemoveProjectMember(workspace.projectId)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<ProjectRole>("VIEWER")

  const canManage = workspace.membershipRole === "OWNER"

  async function handleAddMember() {
    try {
      await addMember.mutateAsync({
        email: email.trim(),
        role,
      })
      setEmail("")
      setRole("VIEWER")
      toast.success("Member updated.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update membership.")
    }
  }

  async function handleRoleChange(userId: string, nextRole: ProjectRole) {
    try {
      await updateMember.mutateAsync({
        userId,
        input: { role: nextRole },
      })
      toast.success("Membership role updated.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update membership role.")
    }
  }

  async function handleRemove(userId: string) {
    try {
      await removeMember.mutateAsync(userId)
      toast.success("Member removed.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove member.")
    }
  }

  return (
    <div className="app-page-scroll">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-4">
        <WorkspacePageHeader
          title="Project Members"
          description="Manage membership for the currently selected project. Backend project permissions remain authoritative."
        />

        <Card>
          <CardHeader>
            <CardTitle>{workspace.name}</CardTitle>
            <CardDescription>
              Current membership role: {workspace.membershipRole ?? "No membership resolved"}
            </CardDescription>
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
                  {option}
                </option>
              ))}
            </select>
            <Button
              onClick={() => void handleAddMember()}
              disabled={!canManage || addMember.isPending || !email.trim()}
            >
              Add member
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Member List</CardTitle>
            <CardDescription>
              Non-OWNER users can read membership but cannot mutate it from this screen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.data?.items.map((member) => (
                  <TableRow key={member.userId}>
                    <TableCell>{member.name ?? "Unknown user"}</TableCell>
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
                            {option}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>{new Date(member.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleRemove(member.userId)}
                        disabled={!canManage || removeMember.isPending}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {members.data?.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No members found for this project.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
