import Link from "next/link";

export function RoundTabs({ active }: { active: "passed" | "filtered" }) {
  const tab = (key: typeof active, href: string, label: string) => (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-xs font-medium ${active === key ? "bg-ink text-white" : "border border-line bg-surface text-muted hover:text-ink"}`}
    >
      {label}
    </Link>
  );
  return (
    <div className="mb-6 flex gap-2">
      {tab("passed", "/rounds", "Passed the rules")}
      {tab("filtered", "/rounds/filtered", "Filtered out (audit)")}
    </div>
  );
}
