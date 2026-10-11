"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/discoveries", label: "Discoveries" },
  { href: "/runs", label: "Pipeline runs" },
  { href: "/thesis", label: "Thesis" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto text-sm">
      {NAV.map((n) => {
        const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`whitespace-nowrap border-b-2 px-3 py-3 transition ${
              active ? "border-accent font-medium text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
