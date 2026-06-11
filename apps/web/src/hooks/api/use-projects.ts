import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  currentWorkspaceResponseSchema,
  projectMemberListResponseSchema,
  projectMemberUpsertRequestSchema,
  projectMemberUpdateRequestSchema,
  projectListResponseSchema,
  selectProjectRequestSchema,
  type CurrentWorkspaceResponse,
  type ProjectMemberListResponse,
  type ProjectMemberUpsertRequest,
  type ProjectMemberUpdateRequest,
  type ProjectListResponse,
  type SelectProjectRequest,
} from "@ba-helper/contracts"
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.workspace.projects,
    queryFn: async () =>
      apiGet<ProjectListResponse>("/api/v1/projects", projectListResponseSchema),
  })
}

export function useSwitchProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SelectProjectRequest) =>
      apiPost<CurrentWorkspaceResponse>(
        "/api/v1/workspace/select-project",
        input,
        currentWorkspaceResponseSchema,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspace.current })
      queryClient.invalidateQueries({ queryKey: queryKeys.workspace.projects })
      queryClient.invalidateQueries({ queryKey: queryKeys.repositories.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.requirements.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.analyses.all })
    },
  })
}

export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workspace.members(projectId ?? "__workspace-pending__"),
    queryFn: async () =>
      apiGet<ProjectMemberListResponse>(
        `/api/v1/projects/${projectId}/members`,
        projectMemberListResponseSchema,
      ),
    enabled: Boolean(projectId),
  })
}

export function useUpsertProjectMember(projectId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: ProjectMemberUpsertRequest) =>
      apiPost<ProjectMemberListResponse>(
        `/api/v1/projects/${projectId}/members`,
        input,
        projectMemberListResponseSchema,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspace.members(projectId ?? "__workspace-pending__"),
      })
    },
  })
}

export function useUpdateProjectMember(projectId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      input,
    }: {
      userId: string
      input: ProjectMemberUpdateRequest
    }) =>
      apiPatch<ProjectMemberListResponse>(
        `/api/v1/projects/${projectId}/members/${userId}`,
        input,
        projectMemberListResponseSchema,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspace.members(projectId ?? "__workspace-pending__"),
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.workspace.current })
      queryClient.invalidateQueries({ queryKey: queryKeys.workspace.projects })
    },
  })
}

export function useRemoveProjectMember(projectId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) =>
      apiDelete(`/api/v1/projects/${projectId}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspace.members(projectId ?? "__workspace-pending__"),
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.workspace.current })
      queryClient.invalidateQueries({ queryKey: queryKeys.workspace.projects })
    },
  })
}

export function validateProjectMemberInput(input: ProjectMemberUpsertRequest) {
  return projectMemberUpsertRequestSchema.parse(input)
}

export function validateProjectSelection(input: SelectProjectRequest) {
  return selectProjectRequestSchema.parse(input)
}

export function validateProjectMemberRole(input: ProjectMemberUpdateRequest) {
  return projectMemberUpdateRequestSchema.parse(input)
}
