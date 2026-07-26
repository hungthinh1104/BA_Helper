import { useQuery } from "@tanstack/react-query"
import {
  SystemOperationsResponse,
  SystemReadinessResponse,
  systemOperationsResponseSchema,
  systemReadinessResponseSchema,
} from "@ba-helper/contracts"
import { apiGet } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"

/** Public readiness — dependency up/down. Safe for any authenticated user. */
export function useSystemReadiness() {
  return useQuery({
    queryKey: queryKeys.system.readiness,
    queryFn: async () =>
      apiGet<SystemReadinessResponse>(
        "/api/v1/system/ready",
        systemReadinessResponseSchema,
      ),
    refetchInterval: 15000,
    retry: 1,
  })
}

/**
 * ADMIN-only operations view — queue counts + workspace config. Pass `enabled`
 * (typically `role === 'ADMIN'`) so non-admins never issue the request.
 */
export function useSystemOperations(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.system.operations,
    queryFn: async () =>
      apiGet<SystemOperationsResponse>(
        "/api/v1/system/operations",
        systemOperationsResponseSchema,
      ),
    enabled,
    refetchInterval: 15000,
    retry: 1,
  })
}
