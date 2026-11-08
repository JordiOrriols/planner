import { useQuery } from "@tanstack/react-query";
import { platformRepository } from "./platform";

export function usePlatformDirectory() {
  return useQuery({
    queryKey: ["platform-workspaces", "planner"],
    queryFn: platformRepository.workspaces,
    refetchInterval: 60_000,
  });
}
