import { useQuery } from "@tanstack/react-query"
import { getJetBridge } from "@renderer/lib/bridge"
import type { InstalledTerminal } from "@renderer/lib/types"

export function useTerminals() {
  return useQuery({
    queryKey: ["terminals"],
    queryFn: async () => {
      const result = await getJetBridge().listTerminals()
      if (!result.ok) {
        throw new Error(result.error)
      }

      return result.data as InstalledTerminal[]
    },
    staleTime: 60_000,
  })
}
