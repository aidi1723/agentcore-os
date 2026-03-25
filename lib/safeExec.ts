import { execFile } from "child_process";

export async function execText(
  cmd: string,
  args: string[],
  timeoutMs = 15_000,
): Promise<string> {
  return await new Promise((resolve, reject) => {
    const p = execFile(
      cmd,
      args,
      { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          const msg = (stderr || stdout || "").toString();
          reject(
            new Error(
              `${cmd} ${args.join(" ")} failed: ${err.message}${msg ? `\n${msg}` : ""}`,
            ),
          );
          return;
        }
        resolve(stdout.toString());
      },
    );

    // Avoid keeping the event loop alive if a request is aborted.
    p.unref?.();
  });
}
