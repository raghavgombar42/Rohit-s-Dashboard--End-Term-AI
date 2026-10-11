import { operatorMode } from "./operator";

/** "Run now" — only actionable in operator mode; otherwise explains why it's disabled. */
export async function RunNowButton() {
  if (!(await operatorMode())) {
    return (
      <span title="Unlock operator mode (top right) to run the pipeline manually" className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm text-faint">
        ▶ Run now
      </span>
    );
  }
  return (
    <form action="/api/actions/run" method="post">
      <button className="inline-flex items-center gap-2 rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-white transition hover:bg-ink/85">
        ▶ Run now
      </button>
    </form>
  );
}
