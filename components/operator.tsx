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
        <span className="inline-flex items-center gap-1.5 rounded-full bg-good-soft px-2.5 py-1 text-xs font-medium text-good">
          <span className="h-1.5 w-1.5 rounded-full bg-current" /> Operator mode
        </span>
        <button className="text-xs text-muted underline-offset-2 hover:underline">Lock</button>
      </form>
    );
  }
  return (
    <OperatorPopover>
      <summary className="cursor-pointer list-none rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:text-ink">
        View-only · Unlock
      </summary>
      <form action="/api/operator" method="post" className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-line bg-surface p-4 shadow-lg">
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
        <button className="mt-2 w-full rounded-lg bg-ink px-3 py-2 text-sm font-medium text-white hover:bg-ink/85">Unlock</button>
      </form>
    </OperatorPopover>
  );
}
