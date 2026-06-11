import { useQuery } from "@tanstack/react-query"
import { SystemHealthResponse, systemHealthResponseSchema } from "@ba-helper/contracts"
import { apiGet } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"

export function useSystemHealth() {
  return useQuery({
    queryKey: queryKeys.system.health,
    queryFn: async () =>
      apiGet<SystemHealthResponse>(
        "/api/v1/system/health",
        systemHealthResponseSchema,
      ),
    refetchInterval: 15000,
    retry: 1,
  })
}
