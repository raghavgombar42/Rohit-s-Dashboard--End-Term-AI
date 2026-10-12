import { revalidateTag } from "next/cache";

export const DASHBOARD_TAG = "dashboard";

/** Clear all cached page data (after a pipeline run, an outreach action, or connecting Gmail). Safe anywhere. */
export function refreshDashboard() {
  try {
    revalidateTag(DASHBOARD_TAG, { expire: 0 });
  } catch {
    // Outside a Next.js request (CLI scripts, tests): there is no page cache to clear.
  }
}
