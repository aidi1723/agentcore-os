import assert from "node:assert/strict";

const claw = await import("./claw-code.ts");

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

test("buildClawCodePrompt preserves context and user message", () => {
  const prompt = claw.buildClawCodePrompt({
    taskInput: { userMessage: "整理今天的销售线索" },
    session: { id: "sales:daily" },
    metadata: { requestId: "exec-1", source: "test" },
    context: {
      systemPrompt: "你是销售运营助理。",
      workspace: {
        activeIndustry: "building-materials",
        runtimeProfile: "desktop_light",
      },
    },
    skillPolicy: {
      enabled: true,
      mode: "auto",
      taskLabel: "sales-follow-up",
      memoryScope: "sales:building-materials",
    },
    executionPolicy: {
      timeoutSeconds: 30,
      maxAttempts: 1,
      retryBackoffMs: 0,
      allowFallbackToOpenClaw: false,
    },
  });

  assert.match(prompt, /你是销售运营助理/);
  assert.match(prompt, /整理今天的销售线索/);
  assert.match(prompt, /activeIndustry=building-materials/);
  assert.match(prompt, /sessionId=sales:daily/);
  assert.match(prompt, /taskLabel=sales-follow-up/);
});

test("buildClawCodeArgs creates non-interactive JSON execution args", () => {
  const args = claw.buildClawCodeArgs({
    prompt: "hello",
    cwd: "/tmp/project",
    permissionMode: "workspace-write",
  });

  assert.deepEqual(args, [
    "--print",
    "--output-format",
    "json",
    "--permission-mode",
    "workspace-write",
    "--cwd",
    "/tmp/project",
    "hello",
  ]);
});

test("buildClawCodeArgs defaults to read-only permissions", () => {
  const args = claw.buildClawCodeArgs({
    prompt: "hello",
  });

  assert.deepEqual(args, [
    "--print",
    "--output-format",
    "json",
    "--permission-mode",
    "read-only",
    "hello",
  ]);
});

test("parseClawCodeOutput accepts JSON text payloads", () => {
  const parsed = claw.parseClawCodeOutput(
    JSON.stringify({
      type: "result",
      result: "完成：已生成跟进草稿。",
      session_id: "claw-session-1",
    }),
  );

  assert.equal(parsed.ok, true);
  assert.equal(parsed.text, "完成：已生成跟进草稿。");
  assert.equal(parsed.raw.session_id, "claw-session-1");
});

test("parseClawCodeOutput falls back to trimmed stdout", () => {
  const parsed = claw.parseClawCodeOutput("  plain result  \n");

  assert.equal(parsed.ok, true);
  assert.equal(parsed.text, "plain result");
});

test("mapClawCodeFailure returns stable user-facing errors", () => {
  const error = claw.mapClawCodeFailure({
    code: 127,
    signal: null,
    stderr: "claw: command not found",
    timedOut: false,
  });

  assert.equal(error.code, "CLAW_CODE_UNAVAILABLE");
  assert.match(error.message, /AgentCoreOS Runtime/);
});

test("buildClawCodeTraceAttempt returns claw_code engine attempt", () => {
  const attempt = claw.buildClawCodeTraceAttempt({
    candidateKind: "primary",
    attemptNumber: 1,
    startedAt: 100,
    finishedAt: 175,
    success: true,
  });

  assert.equal(attempt.engine, "claw_code");
  assert.equal(attempt.durationMs, 75);
  assert.equal(attempt.provider, "agentcoreos-runtime");
});

test("selectExecutorBackend honors claw_code environment override", () => {
  assert.equal(
    claw.selectExecutorBackend({
      envValue: "claw_code",
      hasModelCandidates: true,
    }),
    "claw_code",
  );
});

test("selectExecutorBackend allows direct model fallback by override", () => {
  assert.equal(
    claw.selectExecutorBackend({
      envValue: "direct_model",
      hasModelCandidates: true,
    }),
    "direct_model",
  );
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
