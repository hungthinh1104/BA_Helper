import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import {
  DomainPackRegistryResponse,
  domainPackRegistryResponseSchema,
} from "@ba-helper/contracts"

export function useDomainPacks() {
  return useQuery({
    queryKey: queryKeys.domainPacks.list,
    queryFn: () =>
      apiGet<DomainPackRegistryResponse>(
        "/api/v1/domain-packs",
        domainPackRegistryResponseSchema,
      ),
    staleTime: 5 * 60 * 1000,
  })
}
