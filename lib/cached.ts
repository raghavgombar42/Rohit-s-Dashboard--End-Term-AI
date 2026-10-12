import { unstable_cache } from "next/cache";
import { DASHBOARD_TAG } from "./refresh";
import { resilient } from "./db";
import { gmailStatus } from "./gmail";
import * as q from "./queries";
import { listThesisVersions, loadActiveThesis } from "./thesis";

/**
 * Page data, cached. The data only changes when the hourly pipeline runs or Rohit sends/rejects a draft,
 * so pages are served from Next.js' data cache and refreshed in the background (stale-while-revalidate,
 * at most REVALIDATE seconds old). Pipeline runs and outreach actions clear the cache immediately via
 * `refreshDashboard()`. Edits made directly in Supabase (thesis) show up within REVALIDATE seconds.
 *
 * Cached values are JSON: timestamps come back as strings, which every formatter wraps in new Date().
 * Bump VERSION when a loader's return shape changes, so old cache entries are not reused after a deploy.
 */
const VERSION = "v3";
const REVALIDATE = 30;

function cached<A extends unknown[], T>(key: string, load: (...args: A) => Promise<T>) {
  return unstable_cache((...args: A) => resilient(() => load(...args)), [VERSION, key], {
    tags: [DASHBOARD_TAG],
    revalidate: REVALIDATE,
  });
}

export const overviewData = cached("overview", () =>
  Promise.all([
    q.listRuns(1),
    q.listArticles({ window: "all", view: "unique" }, 6),
    q.sourceHealth(),
    loadActiveThesis(),
    q.funnelCounts(),
    q.listOutreach(),
    q.dailyNews(14),
    q.roundOutcomes(),
    q.newsHeatmap(),
  ]),
);

export const draftsData = cached("drafts", () => q.listOutreach());
export const qualifiedData = cached("qualified", () => Promise.all([q.listAssessed(true), loadActiveThesis()]));
export const discoveriesData = cached("discoveries", (window: q.DiscoveryFilter["window"], view: q.DiscoveryFilter["view"]) =>
  q.listArticles({ window, view }),
);
export const roundsData = cached("rounds", () => q.listRounds());
export const filteredData = cached("filtered", () => Promise.all([q.listFilteredOut(), q.listAssessed(false), loadActiveThesis()]));
export const runsData = cached("runs", () => q.listRuns(50));
export const runDetailData = cached("run-detail", (id: number) => q.getRun(id));
export const thesisData = cached("thesis", () => Promise.all([loadActiveThesis(), listThesisVersions()]));
export const setupData = cached("setup", async () => {
  const [gmail, cron] = await Promise.all([
    gmailStatus(),
    q.lastHourlyRun(),
  ]);
  return { gmail, cron };
});

export { refreshDashboard } from "./refresh";
