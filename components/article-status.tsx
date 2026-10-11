import { Badge } from "./ui";
import { humanArticleReason } from "@/lib/labels";

/** Human-readable article state. Labels say what happened, not internal codes. */
export function ArticleStatus({ status, rejectReason }: { status: string; rejectReason: string | null }) {
  if (rejectReason?.startsWith("duplicate_of:")) return <Badge tone="neutral">Duplicate headline</Badge>;
  switch (status) {
    case "new": return <Badge tone="info" dot>Awaiting AI triage</Badge>;
    case "not_funding": return <Badge tone="neutral">Not a funding story</Badge>;
    case "candidate": return <Badge tone="accent" dot>Funding story · extracting</Badge>;
    case "linked": return <Badge tone="good" dot>Round passed the rules</Badge>;
    case "rejected":
      return (
        <span title={humanArticleReason(rejectReason)}>
          <Badge tone="warn">Filtered out by rules</Badge>
        </span>
      );
    case "error": return <Badge tone="bad">Error</Badge>;
    default: return <Badge>{status}</Badge>;
  }
}
