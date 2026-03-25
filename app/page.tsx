import { LangSwitch } from "@/components/LangSwitch";
import { OpenClawStatusPill } from "@/components/OpenClawStatusPill";
import { AppIcon } from "@/components/ipad/AppIcon";
import { Dock } from "@/components/ipad/Dock";
import { OPENCLAW_TASKBOARD_UI_URL } from "@/lib/config";
import { dict, getLangFromSearchParams } from "@/lib/i18n";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: Props) {
  const sp = new URLSearchParams();
  const raw = (await searchParams) || {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") sp.set(k, v);
  }

  const lang = getLangFromSearchParams(sp);
  const t = dict(lang);
  const withLang = (href: string) => `${href}?lang=${lang}`;

  // Desktop order: Taskboard + Social Ops + Automations first.
  const apps = [
    { href: withLang("/taskboard"), label: t.taskboard, glyph: "TB" },
    { href: withLang("/social-ops"), label: t.socialOps, glyph: "SO" },
    { href: withLang("/automations"), label: t.automations, glyph: "AU" },
    { href: withLang("/gateway"), label: t.gateway, glyph: "GW" },
    { href: withLang("/nodes"), label: t.nodes, glyph: "ND" },
    { href: withLang("/skills"), label: t.skills, glyph: "SK" },
    { href: withLang("/logs"), label: t.logs, glyph: "LG" },
  ];

  // Dock order (kept compact): Taskboard, Social Ops, Automations first.
  const dock = [
    { href: withLang("/taskboard"), label: t.taskboard, glyph: "TB" },
    { href: withLang("/social-ops"), label: t.socialOps, glyph: "SO" },
    { href: withLang("/automations"), label: t.automations, glyph: "AU" },
    { href: withLang("/gateway"), label: t.gateway, glyph: "GW" },
    { href: withLang("/nodes"), label: t.nodes, glyph: "ND" },
    { href: withLang("/skills"), label: t.skills, glyph: "SK" },
  ];

  return (
    <div className="oc-bg min-h-dvh">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-6 pt-8">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-slate-600/70">
            {t.appName}
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900/90">
            {t.desktop}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <LangSwitch />
          <OpenClawStatusPill lang={lang} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-40">
        <section className="mt-8 rounded-[32px] oc-glass p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-sm font-semibold tracking-tight text-slate-900/85">
                {t.apps}
              </div>
              <div className="mt-1 text-xs text-slate-600/80">
                {lang === "zh" ? "点击打开应用" : "Tap to open"}
              </div>
            </div>

            <a
              className="rounded-full bg-white/60 px-3 py-2 text-xs font-medium text-slate-900/80 oc-soft-ring hover:bg-white/70"
              href={OPENCLAW_TASKBOARD_UI_URL}
              target="_blank"
              rel="noreferrer"
            >
              {t.quickTaskboardBtn}
            </a>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-x-6 gap-y-8 sm:grid-cols-4 lg:grid-cols-4">
            {apps.map((a) => (
              <AppIcon key={a.href} href={a.href} label={a.label} glyph={a.glyph} />
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="oc-card p-5">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500/80">
              {t.quick}
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900/85">
              {t.quickTaskboardTitle}
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-600/85">
              {t.quickTaskboardDesc}
            </div>
          </div>
          <div className="oc-card p-5">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500/80">
              {t.notes}
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900/85">
              {t.notesTitle}
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-600/85">
              {t.notesDesc}
            </div>
          </div>
          <div className="oc-card p-5">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500/80">
              {t.safety}
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900/85">
              {t.safetyTitle}
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-600/85">
              {t.safetyDesc}
            </div>
          </div>
        </section>
      </main>

      <Dock items={dock} />
    </div>
  );
}
