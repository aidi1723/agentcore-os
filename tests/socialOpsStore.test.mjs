import test from "node:test";
import assert from "node:assert/strict";

const { getLangFromSearchParams } = await import("../lib/i18n.ts");

test("getLangFromSearchParams defaults to en", () => {
  assert.equal(getLangFromSearchParams(new URLSearchParams()), "en");
  assert.equal(getLangFromSearchParams(null), "en");
});

test("getLangFromSearchParams maps zh variants to zh", () => {
  assert.equal(getLangFromSearchParams(new URLSearchParams("lang=zh")), "zh");
  assert.equal(getLangFromSearchParams(new URLSearchParams("lang=zh-cn")), "zh");
  assert.equal(getLangFromSearchParams(new URLSearchParams("lang=cn")), "zh");
});

test("getLangFromSearchParams keeps unsupported values on en", () => {
  assert.equal(getLangFromSearchParams(new URLSearchParams("lang=fr")), "en");
});
