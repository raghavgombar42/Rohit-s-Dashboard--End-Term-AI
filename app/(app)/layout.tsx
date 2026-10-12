import Link from "next/link";
import { Nav } from "@/components/nav";
import { OperatorControl } from "@/components/operator";

// All dashboard pages show live database state.
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative min-h-screen">
      <div className="aurora" aria-hidden />
      <header className="sticky top-0 z-20 border-b border-white/5 bg-background/85 backdrop-blur-md">
        <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 px-4 py-3 lg:grid-cols-[auto_1fr_auto]">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[conic-gradient(from_200deg,#a78bfa,#f0abfc,#7dd3fc,#a78bfa)] p-[2px]">
              <span className="grid h-full w-full place-items-center rounded-full bg-background font-display text-lg text-ink">T</span>
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold">Tandem Forge</span>
              <span className="block text-[11px] text-muted">Funding Outreach Engine</span>
            </span>
          </Link>
          <div className="col-span-2 row-start-2 min-w-0 lg:col-span-1 lg:row-start-1 lg:col-start-2 lg:justify-self-center">
            <Nav />
          </div>
          <div className="col-start-2 row-start-1 flex items-center justify-end gap-2 lg:col-start-3">
            <span className="hidden items-center gap-1.5 rounded-full bg-lime-400/10 px-3 py-1.5 text-xs font-medium text-lime-300 ring-1 ring-lime-300/20 xl:inline-flex">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-lime-300 text-lime-300" /> Safe mode · test inbox only
            </span>
            <OperatorControl />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-10">{children}</main>
      <footer className="mx-auto max-w-7xl px-4 pb-10 text-xs text-faint">
        Fictional accelerator built for the Mesa C4 AI final. All data shown is read live from Supabase. AI: Gemini Flash. ·{" "}
        <a href="/components-map.html" className="text-accent hover:underline">Components map ↗</a>
      </footer>
    </div>
  );
}
