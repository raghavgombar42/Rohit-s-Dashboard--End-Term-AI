// Plain-English labels for internal codes, used across the UI.

export const STAGE_LABEL: Record<string, string> = {
  pre_seed: "Pre-seed", seed: "Seed", angel: "Angel", pre_series_a: "Pre-Series A", series_a: "Series A",
  series_b_or_later: "Series B+", bridge: "Bridge", debt: "Debt", grant: "Grant", undisclosed: "Undisclosed", other: "Other",
};

export function humanReason(code: string): string {
  const [key, arg] = code.split(":");
  switch (key) {
    case "stage_not_in_thesis": return `${STAGE_LABEL[arg] ?? arg} round — outside thesis stages`;
    case "geography_not_in_thesis": return `Based in ${arg} — outside thesis geography`;
    case "geography_unknown": return "Country not determinable from the source";
    case "old_round_mentioned_as_background": return "Old round mentioned as background, not new news";
    case "announcement_date_in_future": return "Announcement date is in the future (suspicious)";
    case "stale": return `Announced ${arg?.replace("d_old", "")} days ago — outside the outreach window`;
    case "unverified_startup": return "Startup name not found verbatim in the text";
    case "no_new_round_in_text": return "No new funding round in the article text";
    default: return code;
  }
}

/** Article reject_reason is a " | "-joined list of per-round outcomes. */
export function humanArticleReason(reason: string | null): string {
  if (!reason) return "Rejected";
  return reason
    .split(" | ")
    .map((part) => part.split(",").map(humanReason).join("; "))
    .join(" · ");
}

export const LANE_LABEL = { fresh: "Fresh · ≤ 24h", late_catch: "Late catch" } as const;

export const BASIS_LABEL: Record<string, string> = {
  stated: "stated in article",
  inferred_from_amount: "inferred from round size",
  inferred_from_city: "inferred from city",
  inferred_from_context: "inferred from context",
  inferred_from_currency: "inferred from INR amount",
  stated_in_article: "date stated in article",
  article_published: "date = article publish time",
};
