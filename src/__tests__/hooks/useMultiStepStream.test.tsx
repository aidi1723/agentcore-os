import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useMultiStepStream } from "@/hooks/useMultiStepStream";

function mockStreamResponse(payload: string) {
  const reader = {
    read: vi.fn()
      .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(payload) })
      .mockResolvedValueOnce({ done: true, value: undefined }),
  };

  return {
    ok: true,
    headers: {
      get: (name: string) => (name === "X-Execution-Id" ? "exec-1" : null),
    },
    body: {
      getReader: () => reader,
    },
  };
}

describe("useMultiStepStream", () => {
  it("keeps failed execution_done as an error state", async () => {
    const payload = [
      "event: error\n",
      `data: ${JSON.stringify({ error: "approval rejected" })}\n`,
      "\n",
      "event: execution_done\n",
      `data: ${JSON.stringify({ ok: false, error: "approval rejected" })}\n`,
      "\n",
    ].join("");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockStreamResponse(payload)));

    const { result } = renderHook(() => useMultiStepStream());

    await act(async () => {
      await result.current.start("Run controlled workflow");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("approval rejected");
  });

  it("reports an error when the stream ends before execution_done", async () => {
    const payload = [
      "event: step_complete\n",
      `data: ${JSON.stringify({ stepId: "step_1", status: "completed", durationMs: 1, tokensUsed: 0, toolCallResults: [] })}\n`,
      "\n",
    ].join("");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockStreamResponse(payload)));

    const { result } = renderHook(() => useMultiStepStream());

    await act(async () => {
      await result.current.start("Run controlled workflow");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Stream ended before execution_done");
  });
});
