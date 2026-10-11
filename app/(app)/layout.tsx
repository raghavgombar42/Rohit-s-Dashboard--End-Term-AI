import Link from "next/link";
import { Nav } from "@/components/nav";
import { OperatorControl } from "@/components/operator";

// All dashboard pages show live database state.
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen">
      <header className="brand-gradient sticky top-0 z-10 text-white shadow-[0_8px_30px_-12px_rgba(30,27,75,0.6)]">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex items-center gap-3 pt-3">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-400 via-violet-400 to-sky-400 font-display text-xl text-white shadow-lg shadow-fuchsia-500/30">
                T
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-semibold">Tandem Forge</span>
                <span className="block text-[11px] text-white/60">Funding Outreach Engine</span>
              </span>
            </Link>
            <span className="ml-auto hidden rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/85 ring-1 ring-white/15 sm:inline">
              🛡 Safe mode · emails go to a test inbox only
            </span>
            <OperatorControl />
          </div>
          <Nav />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-faint">
        Fictional accelerator built for the Mesa C4 AI final. All data shown is read live from Supabase. AI: Gemini Flash.
      </footer>
    </div>
  );
}
