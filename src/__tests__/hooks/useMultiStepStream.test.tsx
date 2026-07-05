import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMultiStepStream } from "@/hooks/useMultiStepStream";

function mockStreamResponse(payload: string, executionId = "exec-1") {
  const reader = {
    read: vi.fn()
      .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(payload) })
      .mockResolvedValueOnce({ done: true, value: undefined }),
  };

  return {
    ok: true,
    status: 200,
    headers: {
      get: (name: string) => (name === "X-Execution-Id" ? executionId : null),
    },
    body: {
      getReader: () => reader,
    },
  };
}

function mockJsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

function mockGatedStreamResponse(
  firstPayload: string,
  secondPayload: string,
  executionId = "exec-1",
) {
  let releaseNextRead: (() => void) | null = null;
  const nextRead = new Promise<void>((resolve) => {
    releaseNextRead = resolve;
  });
  const reader = {
    read: vi.fn()
      .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(firstPayload) })
      .mockImplementationOnce(async () => {
        await nextRead;
        return { done: false, value: new TextEncoder().encode(secondPayload) };
      })
      .mockResolvedValueOnce({ done: true, value: undefined }),
  };

  return {
    response: {
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => (name === "X-Execution-Id" ? executionId : null),
      },
      body: {
        getReader: () => reader,
      },
    },
    releaseNextRead: () => releaseNextRead?.(),
  };
}

function makeRun(overrides: Record<string, unknown> = {}) {
  return {
    id: "exec-1",
    requestId: "exec-1",
    sessionId: "webos-spotlight",
    playbookId: "sales-pipeline-v1",
    playbookVersion: "1.0.0",
    planId: "plan-1",
    state: "completed",
    currentStepId: "review",
    createdAt: 1,
    updatedAt: 2,
    plan: {
      id: "plan-1",
      goal: "controlled client recovery",
      totalSteps: 2,
      requiresApproval: true,
      steps: [
        {
          id: "review",
          title: "Review",
          description: "Review the generated draft",
          mode: "review",
          dependsOn: [],
          toolCalls: [],
        },
        {
          id: "writeback",
          title: "Writeback",
          description: "Persist approved output",
          mode: "manual",
          dependsOn: ["review"],
          toolCalls: [],
        },
      ],
    },
    steps: [
      {
        stepId: "review",
        state: "completed",
        startedAt: 1,
        finishedAt: 11,
        input: null,
        output: { approved: true },
        attempts: 1,
        toolCallResults: [],
        writebackReceipts: [],
      },
      {
        stepId: "writeback",
        state: "completed",
        startedAt: 12,
        finishedAt: 20,
        input: null,
        output: { written: true },
        attempts: 1,
        toolCallResults: [],
        writebackReceipts: [],
      },
    ],
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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

  it("continues a durable run after approval by calling the resume route", async () => {
    const payload = [
      "event: plan_ready\n",
      `data: ${JSON.stringify({ plan: makeRun().plan })}\n`,
      "\n",
      "event: approval_needed\n",
      `data: ${JSON.stringify({
        executionId: "exec-1",
        stepId: "review",
        title: "Review",
        description: "Approve generated draft",
        mode: "review",
      })}\n`,
      "\n",
      "event: execution_done\n",
      `data: ${JSON.stringify({ ok: false, error: "Awaiting approval for review" })}\n`,
      "\n",
    ].join("");

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockStreamResponse(payload))
      .mockResolvedValueOnce(mockJsonResponse({ ok: true }))
      .mockResolvedValueOnce(mockJsonResponse({
        ok: true,
        data: {
          runId: "exec-1",
          state: "completed",
          resumedStepIds: ["review", "writeback"],
          run: makeRun(),
        },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMultiStepStream());

    await act(async () => {
      await result.current.start("Run controlled workflow");
    });

    expect(result.current.status).toBe("awaiting_approval");
    expect(result.current.approvalRequest?.stepId).toBe("review");

    await act(async () => {
      await result.current.approve(true);
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/api/agent/approve"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("/api/runtime/executor/controlled-runs/exec-1/resume"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.current.status).toBe("done");
    expect(result.current.approvalRequest).toBeNull();
    expect(result.current.stepResults.map((step) => step.stepId)).toEqual(["review", "writeback"]);
  });

  it("does not call resume after approval while the original stream is active", async () => {
    const firstPayload = [
      "event: plan_ready\n",
      `data: ${JSON.stringify({ plan: makeRun().plan })}\n`,
      "\n",
      "event: approval_needed\n",
      `data: ${JSON.stringify({
        executionId: "exec-1",
        stepId: "review",
        title: "Review",
        description: "Approve generated draft",
        mode: "review",
      })}\n`,
      "\n",
    ].join("");
    const secondPayload = [
      "event: step_complete\n",
      `data: ${JSON.stringify({
        stepId: "review",
        status: "completed",
        output: { approved: true },
        durationMs: 1,
        tokensUsed: 0,
        toolCallResults: [],
      })}\n`,
      "\n",
      "event: execution_done\n",
      `data: ${JSON.stringify({ ok: true })}\n`,
      "\n",
    ].join("");
    const stream = mockGatedStreamResponse(firstPayload, secondPayload);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(stream.response)
      .mockResolvedValueOnce(mockJsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMultiStepStream());

    let startPromise!: Promise<void>;
    act(() => {
      startPromise = result.current.start("Run controlled workflow");
    });

    await waitFor(() => {
      expect(result.current.status).toBe("awaiting_approval");
      expect(result.current.approvalRequest?.stepId).toBe("review");
    });

    await act(async () => {
      await result.current.approve(true);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/runtime/executor/controlled-runs/exec-1/resume"),
      expect.anything(),
    );

    await act(async () => {
      stream.releaseNextRead();
      await startPromise;
    });

    expect(result.current.status).toBe("done");
  });

  it("reports the resume HTTP status when an error response is not JSON", async () => {
    const payload = [
      "event: execution_done\n",
      `data: ${JSON.stringify({ ok: true })}\n`,
      "\n",
    ].join("");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockStreamResponse(payload))
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected end of JSON input")),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMultiStepStream());

    await act(async () => {
      await result.current.start("Run controlled workflow");
    });

    await act(async () => {
      await result.current.resume("exec-1");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Resume failed: HTTP 500");
  });
});
