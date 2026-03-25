import Link from "next/link";
import { Shell } from "@/components/ipad/Shell";
import { dict, getLangFromSearchParams } from "@/lib/i18n";
import { listSkills, type SkillInfo } from "@/lib/skillsData";

type ApiOk = { ok: true; skills: SkillInfo[] };
type ApiErr = { ok: false; error: string };

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function getSkills(): Promise<ApiOk | ApiErr> {
  try {
    const skills = await listSkills();
    return { ok: true, skills };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export default async function Page({ searchParams }: Props) {
  const sp = new URLSearchParams();
  const rawParams = (await searchParams) || {};
  for (const [k, v] of Object.entries(rawParams)) if (typeof v === "string") sp.set(k, v);
  const lang = getLangFromSearchParams(sp);
  const t = dict(lang);
  const s = await getSkills();

  return (
    <Shell
      lang={lang}
      title={t.skills}
      subtitle={t.skillsDesc}
      backHref={`/?lang=${lang}`}
      backLabel={t.desktop}
    >
      <section className="rounded-[28px] oc-glass p-6">
        <div className="text-sm font-semibold tracking-tight text-slate-900/85">{t.localSkills}</div>
        <div className="mt-1 text-xs text-slate-600/80">{t.skillsPathHint}</div>

        {!s.ok ? (
          <p className="mt-3 text-sm text-rose-600">{s.error}</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {s.skills.map((sk) => (
              <Link
                key={sk.name}
                href={`/skills/${encodeURIComponent(sk.name)}?lang=${lang}`}
                className="flex items-center justify-between gap-3 rounded-[22px] bg-white/60 px-4 py-3 oc-soft-ring hover:bg-white/70"
              >
                <div className="truncate">
                  <div className="text-sm font-medium text-slate-900">{sk.name}</div>
                  <div className="mt-1 text-xs text-slate-600">
                    {sk.hasSkillMd ? t.skillMd : t.noSkillMd}
                  </div>
                </div>
                <div className="text-xs text-slate-500">{t.open}</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </Shell>
  );
}
