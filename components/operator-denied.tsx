"use client";

import { useSearchParams } from "next/navigation";

export function OperatorDenied() {
  const denied = useSearchParams().get("operator") === "denied";
  return denied ? <p className="mt-2 text-xs text-bad">Wrong passcode. Try again.</p> : null;
}

/** Re-open the unlock popover after a failed attempt. */
