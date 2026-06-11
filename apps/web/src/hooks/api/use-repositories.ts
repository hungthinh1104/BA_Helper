import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import { 
  RepositoryListResponse, 
  RepositoryDetailResponse, 
  RepositoryCreateRequest, 
  RepositoryCreateResponse,
  repositoryListResponseSchema,
  repositoryDetailResponseSchema,
  repositoryCreateResponseSchema
} from "@ba-helper/contracts"

import { canPollRepositoryDetail } from "@/lib/status-helpers"

export function useRepositories(projectId: string = "default-project") {
  return useQuery({
    queryKey: queryKeys.repositories.list(projectId),
    queryFn: async () => {
      return apiGet<RepositoryListResponse>(`/api/v1/projects/${projectId}/repositories`, repositoryListResponseSchema)
    },
    enabled: Boolean(projectId),
    refetchOnWindowFocus: true,
  })
}

export function useRepositoryDetail(projectId: string = "default-project", repositoryId: string) {
  return useQuery({
    queryKey: queryKeys.repositories.detail(repositoryId),
    queryFn: async () => {
      return apiGet<RepositoryDetailResponse>(`/api/v1/projects/${projectId}/repositories/${repositoryId}`, repositoryDetailResponseSchema)
    },
    enabled: Boolean(repositoryId),
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && canPollRepositoryDetail(data) ? 3000 : false;
    },
  })
}

export function useCreateRepository(projectId: string = "default-project") {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RepositoryCreateRequest) => {
      return apiPost<RepositoryCreateResponse>(`/api/v1/projects/${projectId}/repositories`, input, repositoryCreateResponseSchema)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.repositories.list(projectId),
      })
    },
  })
}
