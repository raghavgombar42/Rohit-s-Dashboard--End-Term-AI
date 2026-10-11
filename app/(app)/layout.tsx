import Link from "next/link";
import { Nav } from "@/components/nav";
import { OperatorControl } from "@/components/operator";

// All dashboard pages show live database state.
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-background/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex items-center gap-3 pt-3">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink font-display text-lg text-white">T</span>
              <span className="leading-tight">
                <span className="block text-sm font-semibold">Tandem Forge</span>
                <span className="block text-[11px] text-muted">Funding Outreach Engine</span>
              </span>
            </Link>
            <span className="ml-auto hidden rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent sm:inline">
              Safe mode · emails go to a test inbox only
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
