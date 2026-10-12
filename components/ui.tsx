import type { ReactNode } from "react";
import { CountUp } from "./count-up";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="rise mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">{eyebrow}</p>}
        <h1 className="mt-2 text-4xl font-medium leading-tight tracking-tight">{title}</h1>
        {description && <p className="mt-2 text-[15px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, subtitle, children, right, flush }: { title?: string; subtitle?: ReactNode; children: ReactNode; right?: ReactNode; flush?: boolean }) {
  return (
    <section className="glass rise overflow-hidden rounded-2xl">
      {title && (
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
          <div>
            <h2 className="text-[15px] font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      <div className={flush ? "" : "px-5 pb-5"}>{children}</div>
    </section>
  );
}

const TONES = {
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
  accent: "bg-accent-soft text-accent",
  neutral: "bg-sunken text-muted",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "neutral", children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const STAT_TONES = {
  violet: { bar: "from-violet-500 to-fuchsia-500", chip: "bg-violet-500/15 text-violet-300" },
  sky: { bar: "from-sky-500 to-cyan-400", chip: "bg-sky-500/15 text-sky-300" },
  emerald: { bar: "from-lime-400 to-emerald-400", chip: "bg-lime-400/15 text-lime-300" },
  amber: { bar: "from-amber-500 to-orange-400", chip: "bg-amber-400/15 text-amber-300" },
  pink: { bar: "from-pink-500 to-rose-400", chip: "bg-pink-500/15 text-pink-300" },
} as const;
export type StatTone = keyof typeof STAT_TONES;

export function Stat({ label, value, hint, tone = "violet", icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: StatTone; icon?: ReactNode }) {
  const t = STAT_TONES[tone];
  return (
    <div className="glass relative overflow-hidden rounded-2xl px-5 py-4">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${t.bar}`} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        {icon && <span className={`grid h-7 w-7 place-items-center rounded-lg text-sm ${t.chip}`}>{icon}</span>}
      </div>
      <p className={typeof value === "number" ? "mt-1.5 font-display text-4xl leading-none tabular-nums" : "mt-2 text-2xl font-semibold leading-none tracking-tight"}>{typeof value === "number" ? <CountUp value={value} /> : value}</p>
      {hint && <div className="mt-2 text-xs text-faint">{hint}</div>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-background/60 px-4 py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted">{children}</div>}
    </div>
  );
}

export function Button({ children, variant = "primary", type = "submit" }: { children: ReactNode; variant?: "primary" | "ghost"; type?: "submit" | "button" }) {
  const cls =
    variant === "primary"
      ? "bg-accent text-white hover:opacity-90"
      : "border border-line bg-surface text-ink hover:bg-sunken";
  return (
    <button type={type} className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${cls}`}>
      {children}
    </button>
  );
}

const IST: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata" };

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { ...IST, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) + " IST";
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { ...IST, weekday: "long", day: "numeric", month: "long" });
}

export function timeAgo(d: Date | string | null | undefined, now = Date.now()): string {
  if (!d) return "unknown time";
  const mins = Math.round((now - new Date(d).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function duration(start: Date | string, end: Date | string | null): string {
  if (!end) return "running";
  const s = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export const RUN_TONE: Record<string, Tone> = { succeeded: "good", partial: "warn", failed: "bad", running: "info" };
