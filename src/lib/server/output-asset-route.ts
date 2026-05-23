import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

function contentTypeFor(name: string) {
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

export async function serveOutputAsset(name: string) {
  if (!/^[\w.\-]+$/.test(name)) {
    return NextResponse.json({ ok: false, error: "非法文件名" }, { status: 400 });
  }

  const root = path.join("/tmp", "agentcore-os", "outputs");
  const fullPath = path.join(root, name);

  try {
    const info = await stat(fullPath);
    if (!info.isFile()) throw new Error("not a file");
  } catch {
    return NextResponse.json({ ok: false, error: "文件不存在" }, { status: 404 });
  }

  const buf = await readFile(fullPath);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": contentTypeFor(name),
      "Content-Length": String(buf.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
