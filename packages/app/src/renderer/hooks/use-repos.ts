import { useQuery } from "@tanstack/react-query"
import { getJetBridge } from "@renderer/lib/bridge"
import type { ReposPayload } from "@renderer/lib/types"

export function useRepos() {
  return useQuery({
    queryKey: ["repos"],
    queryFn: async () => {
      const result = await getJetBridge().listRepos()
      if (!result.ok) {
        throw new Error(result.error)
      }
      return result.data as ReposPayload
    },
    refetchInterval: 15000,
  })
}
