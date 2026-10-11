"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";

// <details> keeps the popover JS-free; this wrapper only re-opens it after a wrong passcode.
export function OperatorPopover({ children }: { children: ReactNode }) {
  const denied = useSearchParams().get("operator") === "denied";
  return <details className="group relative" open={denied || undefined}>{children}</details>;
}
