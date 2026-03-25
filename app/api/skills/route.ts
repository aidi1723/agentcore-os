import { NextResponse } from "next/server";
import { listSkills } from "@/lib/skillsData";

export const runtime = "nodejs";

export async function GET() {
  try {
    const skills = await listSkills();
    return NextResponse.json({ ok: true, skills });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
