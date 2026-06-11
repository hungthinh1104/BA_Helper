import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import { 
  RequirementListResponse, 
  RequirementCreateRequest, 
  RequirementCreateResponse, 
  RequirementDetailResponse,
  requirementListResponseSchema,
  requirementDetailResponseSchema,
  requirementCreateResponseSchema
} from "@ba-helper/contracts"
import { useOptionalProjectId } from "@/lib/project-context"

export function useRequirements(projectId?: string) {
  const activeProjectId = useOptionalProjectId()
  const effectiveProjectId = projectId ?? activeProjectId
  const projectQueryKey = effectiveProjectId ?? "__workspace-pending__"
  return useQuery({
    queryKey: queryKeys.requirements.list(projectQueryKey),
    queryFn: async () => {
      return apiGet<RequirementListResponse>(`/api/v1/projects/${effectiveProjectId}/requirements`, requirementListResponseSchema)
    },
    enabled: Boolean(effectiveProjectId),
  })
}

export function useCreateRequirement(projectId?: string) {
  const activeProjectId = useOptionalProjectId()
  const effectiveProjectId = projectId ?? activeProjectId
  const projectQueryKey = effectiveProjectId ?? "__workspace-pending__"
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RequirementCreateRequest) => {
      if (!effectiveProjectId) {
        throw new Error("Workspace project is not ready.")
      }
      return apiPost<RequirementCreateResponse>(`/api/v1/projects/${effectiveProjectId}/requirements`, input, requirementCreateResponseSchema as any)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.requirements.list(projectQueryKey),
      })
    },
  })
}

export function useRequirementDetail(projectId: string | undefined, requirementId: string) {
  const activeProjectId = useOptionalProjectId()
  const effectiveProjectId = projectId ?? activeProjectId
  return useQuery({
    queryKey: queryKeys.requirements.detail(requirementId),
    queryFn: async () => {
      return apiGet<RequirementDetailResponse>(`/api/v1/projects/${effectiveProjectId}/requirements/${requirementId}`, requirementDetailResponseSchema)
    },
    enabled: Boolean(requirementId && effectiveProjectId),
  })
}
