import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiPost } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import { ScanJobCreateRequest, ScanJobResponse, scanJobResponseSchema } from "@ba-helper/contracts"

export function useCreateScanJob(projectId: string = "default-project", repositoryId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: ScanJobCreateRequest) => {
      return apiPost<ScanJobResponse>(
        `/api/v1/projects/${projectId}/repositories/${repositoryId}/scan-jobs`,
        input,
        scanJobResponseSchema
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.repositories.detail(repositoryId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.repositories.list(projectId),
      })
    },
  })
}
