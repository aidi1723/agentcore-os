import type { SpawnSyncReturns } from "node:child_process";

export function spawnResult({
  status = 0,
  stdout = "",
  stderr = "",
}: {
  status?: number | null;
  stdout?: string;
  stderr?: string;
} = {}): SpawnSyncReturns<string> {
  return {
    pid: 1,
    output: [null, stdout, stderr],
    stdout,
    stderr,
    status,
    signal: null,
  };
}
