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

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
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

function mockPendingTerminalStreamResponse(payload: string, executionId = "exec-1") {
  let closeStream: (() => void) | null = null;
  const streamClosed = new Promise<void>((resolve) => {
    closeStream = resolve;
  });
  const reader = {
    read: vi.fn()
      .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(payload) })
      .mockImplementationOnce(async () => {
        await streamClosed;
        return { done: true, value: undefined };
      }),
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
    closeStream: () => closeStream?.(),
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

function makeAwaitingWritebackRun(writebackApproval?: Record<string, unknown>) {
  const writebackStep: Record<string, unknown> = {
    stepId: "writeback",
    state: "awaiting_approval",
    startedAt: 12,
    input: null,
    output: null,
    attempts: 1,
    toolCallResults: [],
    writebackReceipts: [],
  };
  if (writebackApproval) {
    writebackStep.approval = writebackApproval;
  }

  return makeRun({
    state: "awaiting_approval",
    currentStepId: "writeback",
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
      writebackStep,
    ],
  });
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

  it("reports an error when resume is called without an execution id", async () => {
    vi.stubGlobal("fetch", vi.fn());

    const { result } = renderHook(() => useMultiStepStream());

    await act(async () => {
      await result.current.resume();
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Cannot resume controlled run without an execution id");
  });

  it("does not resume after approval rejection", async () => {
    const payload = [
      "event: approval_needed\n",
      `data: ${JSON.stringify({
        executionId: "exec-1",
        stepId: "review",
        title: "Review",
        mode: "review",
      })}\n`,
      "\n",
      "event: execution_done\n",
      `data: ${JSON.stringify({ ok: false, error: "Awaiting approval for review" })}\n`,
      "\n",
    ].join("");

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockStreamResponse(payload))
      .mockResolvedValueOnce(mockJsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMultiStepStream());

    await act(async () => {
      await result.current.start("Run controlled workflow");
    });
    await act(async () => {
      await result.current.approve(false, "用户拒绝");
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("用户拒绝");
  });

  it("allows manual resume after a stream error when a run id is known", async () => {
    const payload = [
      "event: step_complete\n",
      `data: ${JSON.stringify({
        stepId: "review",
        status: "completed",
        durationMs: 1,
        tokensUsed: 0,
        toolCallResults: [],
      })}\n`,
      "\n",
    ].join("");

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockStreamResponse(payload))
      .mockResolvedValueOnce(mockJsonResponse({
        ok: true,
        data: {
          runId: "exec-1",
          state: "completed",
          resumedStepIds: ["writeback"],
          run: makeRun(),
        },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMultiStepStream());

    await act(async () => {
      await result.current.start("Run controlled workflow");
    });
    expect(result.current.status).toBe("error");
    expect(result.current.canResume).toBe(true);

    await act(async () => {
      await result.current.resume();
    });

    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("/api/runtime/executor/controlled-runs/exec-1/resume"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.current.status).toBe("done");
  });

  it("ignores duplicate approval calls while approval is in flight", async () => {
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
    const approvalResponse = deferred<ReturnType<typeof mockJsonResponse>>();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockStreamResponse(payload))
      .mockReturnValueOnce(approvalResponse.promise)
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

    let firstApproval!: Promise<void>;
    let secondApproval!: Promise<void>;
    act(() => {
      firstApproval = result.current.approve(true);
      secondApproval = result.current.approve(true);
    });

    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/agent/approve"))).toHaveLength(1);

    await act(async () => {
      approvalResponse.resolve(mockJsonResponse({ ok: true }));
      await firstApproval;
      await secondApproval;
    });

    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/agent/approve"))).toHaveLength(1);
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).includes("/api/runtime/executor/controlled-runs/exec-1/resume"),
      ),
    ).toHaveLength(1);
    expect(result.current.status).toBe("done");
    expect(result.current.approvalRequest).toBeNull();
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

  it("resumes after terminal awaiting approval even before the reader observes stream closure", async () => {
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
    const stream = mockPendingTerminalStreamResponse(payload);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(stream.response)
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

    await act(async () => {
      stream.closeStream();
      await startPromise;
    });
  });

  it("does not resume when approval response resolves after the active stream completes", async () => {
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
    const approvalResponse = deferred<ReturnType<typeof mockJsonResponse>>();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(stream.response)
      .mockReturnValueOnce(approvalResponse.promise)
      .mockResolvedValueOnce(mockJsonResponse({
        ok: true,
        data: {
          runId: "exec-1",
          state: "completed",
          resumedStepIds: ["review"],
          run: makeRun(),
        },
      }));
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

    let approvalPromise!: Promise<void>;
    act(() => {
      approvalPromise = result.current.approve(true);
    });

    await act(async () => {
      stream.releaseNextRead();
      await startPromise;
    });

    expect(result.current.status).toBe("done");

    await act(async () => {
      approvalResponse.resolve(mockJsonResponse({ ok: true }));
      await approvalPromise;
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/api/agent/stream"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/api/agent/approve"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock.mock.calls.some(([url]) =>
      String(url).includes("/api/runtime/executor/controlled-runs/exec-1/resume"),
    )).toBe(false);
    expect(result.current.status).toBe("done");
  });

  it("resumes when pending approval resolves after terminal awaiting approval", async () => {
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
      "event: execution_done\n",
      `data: ${JSON.stringify({ ok: false, error: "Awaiting approval for review" })}\n`,
      "\n",
    ].join("");
    const stream = mockGatedStreamResponse(firstPayload, secondPayload);
    const approvalResponse = deferred<ReturnType<typeof mockJsonResponse>>();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(stream.response)
      .mockReturnValueOnce(approvalResponse.promise)
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

    let startPromise!: Promise<void>;
    act(() => {
      startPromise = result.current.start("Run controlled workflow");
    });

    await waitFor(() => {
      expect(result.current.status).toBe("awaiting_approval");
      expect(result.current.approvalRequest?.stepId).toBe("review");
    });

    let approvalPromise!: Promise<void>;
    act(() => {
      approvalPromise = result.current.approve(true);
    });

    await act(async () => {
      stream.releaseNextRead();
      await startPromise;
    });

    await act(async () => {
      approvalResponse.resolve(mockJsonResponse({ ok: true }));
      await approvalPromise;
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
  });

  it("resumes a retained SSE approval after the stream ends before execution_done", async () => {
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
    ].join("");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockStreamResponse(payload))
      .mockResolvedValueOnce(mockJsonResponse({ ok: true }))
      .mockResolvedValueOnce(mockJsonResponse({
        ok: true,
        data: {
          runId: "exec-1",
          state: "completed",
          resumedStepIds: ["review"],
          run: makeRun(),
        },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMultiStepStream());

    await act(async () => {
      await result.current.start("Run controlled workflow");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Stream ended before execution_done");
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
    expect(result.current.approvalRequest).toBeNull();
    expect(result.current.status).toBe("done");
    expect(result.current.error).toBeNull();
  });

  it("resumes when approval resolves after the stream ends before execution_done", async () => {
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
    ].join("");
    const stream = mockPendingTerminalStreamResponse(payload);
    const approvalResponse = deferred<ReturnType<typeof mockJsonResponse>>();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(stream.response)
      .mockReturnValueOnce(approvalResponse.promise)
      .mockResolvedValueOnce(mockJsonResponse({
        ok: true,
        data: {
          runId: "exec-1",
          state: "completed",
          resumedStepIds: ["review"],
          run: makeRun(),
        },
      }));
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

    let approvalPromise!: Promise<void>;
    act(() => {
      approvalPromise = result.current.approve(true);
    });

    await act(async () => {
      stream.closeStream();
      await startPromise;
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Stream ended before execution_done");

    await act(async () => {
      approvalResponse.resolve(mockJsonResponse({ ok: true }));
      await approvalPromise;
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
    expect(result.current.approvalRequest).toBeNull();
    expect(result.current.status).toBe("done");
    expect(result.current.error).toBeNull();
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

  it("ignores duplicate manual resume calls while resume is in flight", async () => {
    const resumeResponse = deferred<ReturnType<typeof mockJsonResponse>>();
    const fetchMock = vi.fn()
      .mockReturnValueOnce(resumeResponse.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMultiStepStream());

    let firstResume!: Promise<void>;
    let secondResume!: Promise<void>;
    act(() => {
      firstResume = result.current.resume("exec-1");
      secondResume = result.current.resume("exec-1");
    });

    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).includes("/api/runtime/executor/controlled-runs/exec-1/resume"),
      ),
    ).toHaveLength(1);

    await act(async () => {
      resumeResponse.resolve(mockJsonResponse({
        ok: true,
        data: {
          runId: "exec-1",
          state: "completed",
          resumedStepIds: ["review", "writeback"],
          run: makeRun(),
        },
      }));
      await firstResume;
      await secondResume;
    });

    expect(result.current.status).toBe("done");
  });

  it("does not let a stale resume overwrite a newer run", async () => {
    const resumeResponse = deferred<ReturnType<typeof mockJsonResponse>>();
    const payload = [
      "event: execution_done\n",
      `data: ${JSON.stringify({ ok: true })}\n`,
      "\n",
    ].join("");
    const fetchMock = vi.fn()
      .mockReturnValueOnce(resumeResponse.promise)
      .mockResolvedValueOnce(mockStreamResponse(payload, "new-run"));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMultiStepStream());

    let oldResume!: Promise<void>;
    act(() => {
      oldResume = result.current.resume("old-run");
    });

    await act(async () => {
      await result.current.start("new run");
    });

    expect(result.current.executionId).toBe("new-run");

    await act(async () => {
      resumeResponse.resolve(mockJsonResponse({
        ok: true,
        data: {
          runId: "old-run",
          state: "completed",
          resumedStepIds: ["review", "writeback"],
          run: makeRun({ id: "old-run", requestId: "old-run" }),
        },
      }));
      await oldResume;
    });

    expect(result.current.status).toBe("done");
    expect(result.current.executionId).toBe("new-run");
  });

  it("does not let stale stream events overwrite a manual durable resume", async () => {
    const firstPayload = [
      "event: plan_ready\n",
      `data: ${JSON.stringify({ plan: makeRun().plan })}\n`,
      "\n",
    ].join("");
    const stalePayload = [
      "event: step_complete\n",
      `data: ${JSON.stringify({
        executionId: "stale-exec",
        stepId: "stale-review",
        status: "completed",
        output: { stale: true },
        durationMs: 1,
        tokensUsed: 0,
        toolCallResults: [],
      })}\n`,
      "\n",
      "event: execution_done\n",
      `data: ${JSON.stringify({ ok: true, executionId: "stale-exec" })}\n`,
      "\n",
    ].join("");
    const stream = mockGatedStreamResponse(firstPayload, stalePayload, "stale-exec");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(stream.response)
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

    let startPromise!: Promise<void>;
    act(() => {
      startPromise = result.current.start("stale run");
    });

    await waitFor(() => {
      expect(result.current.executionId).toBe("stale-exec");
    });

    await act(async () => {
      await result.current.resume("exec-1");
    });

    expect(result.current.executionId).toBe("exec-1");
    expect(result.current.stepResults.map((step) => step.stepId)).toEqual(["review", "writeback"]);

    await act(async () => {
      stream.releaseNextRead();
      await startPromise;
    });

    expect(result.current.status).toBe("done");
    expect(result.current.executionId).toBe("exec-1");
    expect(result.current.stepResults.map((step) => step.stepId)).toEqual(["review", "writeback"]);
  });

  it.each([
    ["pending approval", { state: "pending", requestedAt: 12 }],
    ["timed-out approval", { state: "timed_out", requestedAt: 12 }],
    ["missing approval", undefined],
  ])("projects durable awaiting approval state after a resume conflict with %s", async (_label, approval) => {
    const awaitingApprovalRun = makeAwaitingWritebackRun(approval);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockJsonResponse({
        ok: false,
        error: "Controlled run is awaiting approval",
        data: {
          runId: "exec-1",
          state: "awaiting_approval",
          currentStepId: "writeback",
        },
      }, 409))
      .mockResolvedValueOnce(mockJsonResponse({
        ok: true,
        data: {
          run: awaitingApprovalRun,
        },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMultiStepStream());

    await act(async () => {
      await result.current.resume("exec-1");
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/api/runtime/executor/controlled-runs/exec-1/resume"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/api/runtime/executor/controlled-runs/exec-1"),
    );
    expect(result.current.status).toBe("awaiting_approval");
    expect(result.current.currentStepId).toBe("writeback");
    expect(result.current.approvalRequest?.stepId).toBe("writeback");
    expect(result.current.approvalRequest?.title).toBe("Writeback");
  });

  it("resumes after approving a durable projected approval", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockJsonResponse({
        ok: false,
        error: "Controlled run is awaiting approval",
        data: {
          runId: "exec-1",
          state: "awaiting_approval",
          currentStepId: "writeback",
        },
      }, 409))
      .mockResolvedValueOnce(mockJsonResponse({
        ok: true,
        data: {
          run: makeAwaitingWritebackRun({ state: "pending", requestedAt: 12 }),
        },
      }))
      .mockResolvedValueOnce(mockJsonResponse({ ok: true }))
      .mockResolvedValueOnce(mockJsonResponse({
        ok: true,
        data: {
          runId: "exec-1",
          state: "completed",
          resumedStepIds: ["writeback"],
          run: makeRun(),
        },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMultiStepStream());

    await act(async () => {
      await result.current.resume("exec-1");
    });

    expect(result.current.status).toBe("awaiting_approval");
    expect(result.current.approvalRequest?.stepId).toBe("writeback");

    await act(async () => {
      await result.current.approve(true);
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/api/runtime/executor/controlled-runs/exec-1/resume"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/api/runtime/executor/controlled-runs/exec-1"),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("/api/agent/approve"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("/api/runtime/executor/controlled-runs/exec-1/resume"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.current.status).toBe("done");
    expect(result.current.stepResults.map((step) => step.stepId)).toEqual(["review", "writeback"]);
  });

  it("resumes after approving a successful durable resume projection", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockJsonResponse({
        ok: true,
        data: {
          runId: "exec-1",
          state: "awaiting_approval",
          resumedStepIds: ["review"],
          run: makeAwaitingWritebackRun({ state: "pending", requestedAt: 12 }),
        },
      }))
      .mockResolvedValueOnce(mockJsonResponse({ ok: true }))
      .mockResolvedValueOnce(mockJsonResponse({
        ok: true,
        data: {
          runId: "exec-1",
          state: "completed",
          resumedStepIds: ["writeback"],
          run: makeRun(),
        },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMultiStepStream());

    await act(async () => {
      await result.current.resume("exec-1");
    });

    expect(result.current.status).toBe("awaiting_approval");
    expect(result.current.approvalRequest?.stepId).toBe("writeback");

    await act(async () => {
      await result.current.approve(true);
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/api/runtime/executor/controlled-runs/exec-1/resume"),
      expect.objectContaining({ method: "POST" }),
    );
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
    expect(result.current.stepResults.map((step) => step.stepId)).toEqual(["review", "writeback"]);
  });

  it("does not let a stale active stream flag prevent a durable projected approval from resuming", async () => {
    const staleStreamResponse = deferred<ReturnType<typeof mockStreamResponse>>();
    const supersedingPayload = [
      "event: execution_done\n",
      `data: ${JSON.stringify({ ok: true })}\n`,
      "\n",
    ].join("");
    const fetchMock = vi.fn()
      .mockReturnValueOnce(staleStreamResponse.promise)
      .mockResolvedValueOnce(mockStreamResponse(supersedingPayload, "new-run"))
      .mockResolvedValueOnce(mockJsonResponse({
        ok: false,
        error: "Controlled run is awaiting approval",
        data: {
          runId: "exec-1",
          state: "awaiting_approval",
          currentStepId: "writeback",
        },
      }, 409))
      .mockResolvedValueOnce(mockJsonResponse({
        ok: true,
        data: {
          run: makeAwaitingWritebackRun({ state: "pending", requestedAt: 12 }),
        },
      }))
      .mockResolvedValueOnce(mockJsonResponse({ ok: true }))
      .mockResolvedValueOnce(mockJsonResponse({
        ok: true,
        data: {
          runId: "exec-1",
          state: "completed",
          resumedStepIds: ["writeback"],
          run: makeRun(),
        },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMultiStepStream());

    let staleStart!: Promise<void>;
    act(() => {
      staleStart = result.current.start("stale run");
    });

    await act(async () => {
      await result.current.start("new run");
    });

    await act(async () => {
      staleStreamResponse.resolve(mockStreamResponse(supersedingPayload, "stale-run"));
      await staleStart;
    });

    await act(async () => {
      await result.current.resume("exec-1");
    });

    expect(result.current.status).toBe("awaiting_approval");
    expect(result.current.approvalRequest?.stepId).toBe("writeback");

    await act(async () => {
      await result.current.approve(true);
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining("/api/agent/approve"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      expect.stringContaining("/api/runtime/executor/controlled-runs/exec-1/resume"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.current.status).toBe("done");
    expect(result.current.stepResults.map((step) => step.stepId)).toEqual(["review", "writeback"]);
  });

  it("hydrates durable completed state after a resume conflict", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockJsonResponse({
        ok: false,
        error: "Cannot resume completed controlled run",
        data: {
          runId: "exec-1",
          state: "completed",
          currentStepId: "writeback",
        },
      }, 409))
      .mockResolvedValueOnce(mockJsonResponse({
        ok: true,
        data: {
          run: makeRun(),
        },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMultiStepStream());

    await act(async () => {
      await result.current.resume("exec-1");
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/api/runtime/executor/controlled-runs/exec-1/resume"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/api/runtime/executor/controlled-runs/exec-1"),
    );
    expect(result.current.status).toBe("done");
    expect(result.current.stepResults.map((step) => step.stepId)).toEqual(["review", "writeback"]);
    expect(result.current.error).toBeNull();
  });

  it.each([
    ["approved", { state: "approved", requestedAt: 12, resolvedAt: 13 }],
    ["rejected", { state: "rejected", requestedAt: 12, resolvedAt: 13 }],
  ])("does not project durable approval request for %s approval", async (_label, approval) => {
    const awaitingApprovalRun = makeAwaitingWritebackRun(approval);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockJsonResponse({
        ok: false,
        error: "Controlled run is awaiting approval",
        data: {
          runId: "exec-1",
          state: "awaiting_approval",
          currentStepId: "writeback",
        },
      }, 409))
      .mockResolvedValueOnce(mockJsonResponse({
        ok: true,
        data: {
          run: awaitingApprovalRun,
        },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMultiStepStream());

    await act(async () => {
      await result.current.resume("exec-1");
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/api/runtime/executor/controlled-runs/exec-1/resume"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/api/runtime/executor/controlled-runs/exec-1"),
    );
    expect(result.current.status).toBe("awaiting_approval");
    expect(result.current.currentStepId).toBe("writeback");
    expect(result.current.approvalRequest).toBeNull();
    expect(result.current.error).toBe("Controlled run is awaiting approval");
  });
});
