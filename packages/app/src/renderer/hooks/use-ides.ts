import { useQuery } from "@tanstack/react-query"
import { getJetBridge } from "@renderer/lib/bridge"
import type { InstalledIde } from "@renderer/lib/types"

export function useIdes() {
  return useQuery({
    queryKey: ["ides"],
    queryFn: async () => {
      const result = await getJetBridge().listIdes()
      if (!result.ok) {
        throw new Error(result.error)
      }

      return result.data as InstalledIde[]
    },
    staleTime: 60_000,
  })
}
