import { cookies } from "next/headers";
import { OPERATOR_COOKIE, isOperator } from "@/lib/auth";
import { OperatorDenied } from "./operator-denied";
import { OperatorPopover } from "./operator-popover";

export async function operatorMode(): Promise<boolean> {
  return isOperator((await cookies()).get(OPERATOR_COOKIE)?.value);
}

/** Header control: shows operator status, with an inline passcode form to unlock. */
export async function OperatorControl() {
  if (await operatorMode()) {
    return (
      <form action="/api/operator" method="post" className="flex items-center gap-2">
        <input type="hidden" name="intent" value="lock" />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-2.5 py-1 text-xs font-medium text-emerald-200 ring-1 ring-emerald-300/30">
          <span className="h-1.5 w-1.5 rounded-full bg-current" /> Operator mode
        </span>
        <button className="text-xs text-white/70 underline-offset-2 hover:text-white hover:underline">Lock</button>
      </form>
    );
  }
  return (
    <OperatorPopover>
      <summary className="cursor-pointer list-none rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/85 ring-1 ring-white/20 hover:bg-white/20">
        View-only · Unlock
      </summary>
      <form action="/api/operator" method="post" className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-line bg-surface p-4 text-ink shadow-xl">
        <input type="hidden" name="intent" value="unlock" />
        <p className="text-xs leading-relaxed text-muted">
          Operator mode enables actions with side effects (running the pipeline, approving or rejecting drafts).
        </p>
        <input
          name="passcode"
          type="password"
          required
          placeholder="Operator passcode"
          className="mt-3 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <OperatorDenied />
        <button className="mt-2 w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90">Unlock</button>
      </form>
    </OperatorPopover>
  );
}
