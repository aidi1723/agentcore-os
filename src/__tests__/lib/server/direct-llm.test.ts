import { afterEach, describe, expect, it, vi } from "vitest";
import { requestServerLlmText } from "@/lib/server/direct-llm";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestServerLlmText", () => {
  it("does not fetch a private or loopback base URL", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestServerLlmText({
      llm: {
        apiKey: "test-key",
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "local",
      },
      userPrompt: "hello",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("外连范围");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches an allowed public base URL", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        choices: [{ message: { content: "ok" } }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestServerLlmText({
      llm: {
        apiKey: "test-key",
        baseUrl: "https://api.moonshot.cn/v1",
        model: "moonshot-v1-8k",
      },
      userPrompt: "hello",
    });

    expect(result).toMatchObject({ ok: true, text: "ok" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.moonshot.cn/v1/chat/completions",
      expect.anything(),
    );
  });
});
