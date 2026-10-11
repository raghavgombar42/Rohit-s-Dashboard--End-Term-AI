import Link from "next/link";

// All dashboard pages show live database state.
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/thesis", label: "Thesis" },
];

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3">
          <Link href="/" className="leading-tight">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-accent">Tandem Forge</span>
            <span className="block text-sm font-semibold">Funding Outreach Engine</span>
          </Link>
          <nav className="flex gap-1 text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-md px-3 py-1.5 text-muted hover:bg-background hover:text-ink">
                {n.label}
              </Link>
            ))}
          </nav>
          <span className="ml-auto rounded-full border border-line px-2.5 py-1 text-xs text-muted">
            Safe mode: emails go to the test inbox only
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
