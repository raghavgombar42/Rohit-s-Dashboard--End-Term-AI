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

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto py-2.5 text-sm">
      {NAV.map((n) => {
        const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 transition ${
              active ? "bg-white font-medium text-brand-1 shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
