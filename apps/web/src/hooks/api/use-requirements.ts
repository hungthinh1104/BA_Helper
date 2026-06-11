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

export function useRequirements(projectId: string = "default-project") {
  return useQuery({
    queryKey: queryKeys.requirements.list(projectId),
    queryFn: async () => {
      return apiGet<RequirementListResponse>(`/api/v1/projects/${projectId}/requirements`, requirementListResponseSchema)
    },
    enabled: Boolean(projectId),
  })
}

export function useCreateRequirement(projectId: string = "default-project") {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RequirementCreateRequest) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return apiPost<RequirementCreateResponse>(`/api/v1/projects/${projectId}/requirements`, input, requirementCreateResponseSchema as any)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.requirements.list(projectId),
      })
    },
  })
}

export function useRequirementDetail(projectId: string = "default-project", requirementId: string) {
  return useQuery({
    queryKey: queryKeys.requirements.detail(requirementId),
    queryFn: async () => {
      return apiGet<RequirementDetailResponse>(`/api/v1/projects/${projectId}/requirements/${requirementId}`, requirementDetailResponseSchema)
    },
    enabled: Boolean(requirementId),
  })
}
