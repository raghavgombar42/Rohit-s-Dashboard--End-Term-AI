import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>}
        <h1 className="mt-1 font-display text-4xl leading-tight tracking-tight">{title}</h1>
        {description && <p className="mt-2 text-[15px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, subtitle, children, right, flush }: { title?: string; subtitle?: ReactNode; children: ReactNode; right?: ReactNode; flush?: boolean }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(20,20,20,0.04)]">
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
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-5 py-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={typeof value === "number" ? "mt-1.5 font-display text-4xl leading-none tabular-nums" : "mt-2 text-2xl font-semibold leading-none tracking-tight"}>{value}</p>
      {hint && <p className="mt-2 text-xs text-faint">{hint}</p>}
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
      ? "bg-ink text-white hover:bg-ink/85"
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
