import type { CSSProperties } from "react";

/* Lightweight SVG/HTML charts with CSS motion (no chart library). Every value comes from Supabase. */

// ---------- Bar chart: articles per day, funding stories highlighted ----------
export function NewsBars({ data }: { data: { day: string; label: string; articles: number; funding: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.articles));
  const ticks = [max, Math.round(max / 2), 0];
  return (
    <div>
      <div className="flex gap-3">
        <div className="flex h-44 flex-col justify-between py-0.5 text-right text-[10px] text-faint tabular-nums">
          {ticks.map((t) => <span key={t}>{t}</span>)}
        </div>
        <div className="relative flex h-44 flex-1 items-end gap-1.5 border-b border-white/10">
          {[0.5, 1].map((f) => (
            <div key={f} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-white/[0.06]" style={{ bottom: `${f * 100}%` }} />
          ))}
          {data.map((d, i) => {
            const h = (d.articles / max) * 100;
            const fh = d.articles ? (d.funding / d.articles) * 100 : 0;
            const isToday = i === data.length - 1;
            return (
              <div key={d.day} className="group relative flex h-full flex-1 items-end">
                <div
                  className="grow-bar relative w-full overflow-hidden rounded-t-md bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.10)_0_3px,rgba(255,255,255,0.03)_3px_7px)]"
                  style={{ height: `${Math.max(h, d.articles ? 3 : 0)}%`, animationDelay: `${i * 45}ms` }}
                >
                  <div
                    className={`absolute inset-x-0 bottom-0 rounded-t-md ${isToday ? "bg-gradient-to-t from-violet-600 to-fuchsia-400" : "bg-gradient-to-t from-indigo-600 to-violet-400"}`}
                    style={{ height: `${fh}%` }}
                  />
                </div>
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-[#15173a]/95 px-2.5 py-1.5 text-[11px] shadow-xl group-hover:block">
                  <p className="font-medium text-ink">{d.label}</p>
                  <p className="text-muted">{d.articles} articles · <span className="text-violet-300">{d.funding} funding</span></p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="ml-7 mt-2 flex gap-1.5 text-[10px] text-faint">
        {data.map((d, i) => (
          <span key={d.day} className="flex-1 text-center">{i % 2 === data.length % 2 ? d.label.split(" ")[0] : ""}</span>
        ))}
      </div>
    </div>
  );
}

// ---------- Donut: what happened to every extracted round ----------
const DONUT_COLORS: Record<string, string> = {
  "Wrong stage": "#6366f1",
  "Outside India": "#38bdf8",
  "Too old": "#f59e0b",
  "Old news": "#fb7185",
  Unverified: "#94a3b8",
  "Not a thesis fit": "#a855f7",
  Qualified: "#b5f23d",
};

export function OutcomeDonut({ data }: { data: { reason: string; n: number }[] }) {
  const total = data.reduce((s, d) => s + d.n, 0) || 1;
  const r = 52;
  const c = 2 * Math.PI * r;
  const gap = 4;
  let offset = 0;
  const qualified = data.find((d) => d.reason === "Qualified")?.n ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="16" />
          {data.map((d, i) => {
            const len = Math.max((d.n / total) * c - gap, 1);
            const el = (
              <circle
                key={d.reason}
                cx="70" cy="70" r={r} fill="none" stroke={DONUT_COLORS[d.reason] ?? "#888"} strokeWidth="16" strokeLinecap="round"
                className="draw"
                style={{ "--dash": `${len}`, "--len": `${c}`, strokeDashoffset: -offset, animationDelay: `${i * 120}ms` } as CSSProperties}
              />
            );
            offset += (d.n / total) * c;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-3xl leading-none">{total}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-faint">rounds found</p>
          </div>
        </div>
      </div>
      <ul className="min-w-[10rem] flex-1 space-y-1.5 text-xs">
        {data.map((d) => (
          <li key={d.reason} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: DONUT_COLORS[d.reason] ?? "#888" }} />
            <span className={d.reason === "Qualified" ? "font-medium text-lime-300" : "text-muted"}>{d.reason}</span>
            <span className="ml-auto tabular-nums text-ink">{d.n}</span>
          </li>
        ))}
        <li className="pt-1 text-[11px] text-faint">{Math.round((qualified / total) * 100)}% of rounds survive to a draft</li>
      </ul>
    </div>
  );
}

// ---------- Heatmap: when funding news breaks (IST) ----------
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const BLOCKS = ["00–04", "04–08", "08–12", "12–16", "16–20", "20–24"];

export function NewsHeatmap({ data }: { data: { dow: number; block: number; n: number }[] }) {
  const grid = new Map(data.map((d) => [`${d.dow}-${d.block}`, d.n]));
  const max = Math.max(1, ...data.map((d) => d.n));
  const shade = (n: number) => {
    if (!n) return "rgba(255,255,255,0.04)";
    const t = n / max;
    return `rgba(${Math.round(99 + 70 * t)}, ${Math.round(102 - 40 * t)}, ${Math.round(241 + 10 * t)}, ${0.25 + 0.75 * t})`;
  };
  return (
    <div>
      <div className="grid grid-cols-[2.6rem_repeat(7,1fr)] gap-1.5 text-[10px] text-faint">
        <span />
        {DAYS.map((d) => <span key={d} className="text-center">{d}</span>)}
        {BLOCKS.map((b, bi) => (
          <div key={b} className="contents">
            <span className="self-center tabular-nums">{b}</span>
            {DAYS.map((_, di) => {
              const n = grid.get(`${di}-${bi}`) ?? 0;
              return (
                <div
                  key={di}
                  title={`${DAYS[di]} ${b} IST: ${n} funding stor${n === 1 ? "y" : "ies"}`}
                  className="pop aspect-[1.6] rounded-md ring-1 ring-inset ring-white/[0.04]"
                  style={{ background: shade(n), animationDelay: `${(di + bi) * 35}ms` }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-faint">
        Less {[0.15, 0.35, 0.6, 0.85, 1].map((t) => <span key={t} className="h-2.5 w-2.5 rounded-sm" style={{ background: shade(t * max) }} />)} More
      </div>
    </div>
  );
}
