"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Lang } from "@/lib/i18n";
import { LANG_LABEL } from "@/lib/i18n";

function withLang(href: string, lang: Lang): string {
  const u = new URL(href, "http://local");
  u.searchParams.set("lang", lang);
  return u.pathname + u.search;
}

export function LangSwitch() {
  const pathname = usePathname() || "/";
  const sp = useSearchParams();
  const lang = ((sp.get("lang") || "en").toLowerCase().startsWith("zh")
    ? "zh"
    : "en") as Lang;

  const other: Lang = lang === "zh" ? "en" : "zh";
  const currentHref = pathname + (sp.toString() ? `?${sp.toString()}` : "");

  return (
    <div className="flex items-center gap-1 rounded-full bg-white/10 p-1 ring-1 ring-white/15">
      {(["zh", "en"] as Lang[]).map((l) => {
        const active = l === lang;
        return (
          <Link
            key={l}
            href={withLang(currentHref, l)}
            className={
              "rounded-full px-3 py-1 text-xs font-medium transition " +
              (active
                ? "bg-white/20 text-white"
                : "text-white/70 hover:bg-white/15")
            }
          >
            {LANG_LABEL[l]}
          </Link>
        );
      })}
      <span className="px-1 text-[10px] text-white/35">|</span>
      <Link
        href={withLang(currentHref, other)}
        className="rounded-full px-2 py-1 text-[10px] text-white/45 hover:bg-white/15"
        title="Toggle"
      >
        ⇄
      </Link>
    </div>
  );
}