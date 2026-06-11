import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiPost } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import { ScanJobCreateRequest, ScanJobResponse, scanJobResponseSchema } from "@ba-helper/contracts"
import { useOptionalProjectId } from "@/lib/project-context"

interface CreateScanJobInput extends ScanJobCreateRequest {
  repositoryId?: string
}

export function useCreateScanJob(projectId: string | undefined, repositoryId?: string) {
  const activeProjectId = useOptionalProjectId()
  const effectiveProjectId = projectId ?? activeProjectId
  const projectQueryKey = effectiveProjectId ?? "__workspace-pending__"
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateScanJobInput) => {
      const targetRepositoryId = input.repositoryId ?? repositoryId
      if (!targetRepositoryId) {
        throw new Error("Repository id is required to create a scan job.")
      }
      return apiPost<ScanJobResponse>(
        `/api/v1/repositories/${targetRepositoryId}/scan-jobs`,
        {
          requestKey: input.requestKey,
          ref: input.ref,
        },
        scanJobResponseSchema
      )
    },
    onSuccess: () => {
      if (repositoryId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.repositories.detail(repositoryId),
        })
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.repositories.list(projectQueryKey),
      })
    },
  })
}
