"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/drafts", label: "Drafts" },
  { href: "/qualified", label: "Qualified" },
  { href: "/discoveries", label: "Discoveries" },
  { href: "/rounds", label: "Funding rounds" },
  { href: "/runs", label: "Pipeline runs" },
  { href: "/thesis", label: "Thesis" },
  { href: "/setup", label: "Setup" },
];

// Loud-style capsule navigation: pills inside one rounded track, active pill in white.
export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-full bg-white/[0.04] p-1 text-[13px] ring-1 ring-white/[0.06] [scrollbar-width:none]">
      {NAV.map((n) => {
        const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 transition-colors duration-200 ${
              active ? "bg-white font-medium text-[#0b0b1f] shadow-[0_4px_16px_-6px_rgba(255,255,255,0.5)]" : "text-muted hover:bg-white/[0.07] hover:text-ink"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
