import { Shell } from "@/components/ipad/Shell";
import { dict, getLangFromSearchParams } from "@/lib/i18n";
import { readSkillMarkdown } from "@/lib/skillsData";

type Props = {
  params: Promise<{ skill: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ params, searchParams }: Props) {
  const { skill } = await params;
  const name = decodeURIComponent(skill);

  const sp = new URLSearchParams();
  const rawParams = (await searchParams) || {};
  for (const [k, v] of Object.entries(rawParams)) if (typeof v === "string") sp.set(k, v);
  const lang = getLangFromSearchParams(sp);
  const t = dict(lang);

  const skillDoc = await readSkillMarkdown(name);

  return (
    <Shell
      lang={lang}
      title={name}
      subtitle={t.skillsDesc}
      backHref={`/skills?lang=${lang}`}
      backLabel={t.skills}
    >
      {!skillDoc.exists ? (
        <section className="rounded-[28px] oc-glass p-6">
          <div className="text-sm font-semibold tracking-tight text-slate-900/85">{t.skillMdNotFound}</div>
          <div className="mt-2 text-xs text-slate-600/80">{skillDoc.filePath}</div>
        </section>
      ) : (
        <section className="rounded-[28px] oc-glass p-6">
          <div className="text-xs text-slate-600/80">{skillDoc.filePath}</div>
          <pre className="mt-4 overflow-auto rounded-[24px] bg-slate-950/90 p-4 text-xs leading-5 text-slate-100 oc-soft-ring">
            {skillDoc.markdown}
          </pre>
        </section>
      )}
    </Shell>
  );
}
