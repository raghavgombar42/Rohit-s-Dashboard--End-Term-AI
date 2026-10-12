import { resilient } from "@/lib/db";
import Link from "next/link";
import { listAssessed } from "@/lib/queries";
import { loadActiveThesis } from "@/lib/thesis";
import { Empty, PageHeader } from "@/components/ui";
import { QualifiedCard } from "@/components/assessment";

export default async function QualifiedPage() {
  const [rows, thesis] = await resilient(() => Promise.all([listAssessed(true), loadActiveThesis()]));

  return (
    <div>
      <PageHeader
        eyebrow="Steps 5–6 · Research & thesis fit"
        title="Qualified startups"
        description={
          <>
            Freshly funded startups that fit the Tandem Forge thesis (v{thesis.version}, qualify at ≥ {thesis.threshold}). Each has a research
            brief whose every fact links to its source, and a criterion-by-criterion score. Gemini scores; code checks the evidence,
            applies the weights and makes the call. Startups that don&apos;t fit never appear here.
          </>
        }
      />
      {rows.length === 0 ? (
        <Empty title="No qualified startups yet">
          Nothing discovered so far fits the thesis. That is a valid outcome. See the <Link href="/rounds/filtered" className="underline">audit view</Link> for what was considered.
        </Empty>
      ) : (
        <div className="space-y-6">{rows.map((a) => <QualifiedCard key={a.id} a={a} threshold={thesis.threshold} />)}</div>
      )}
    </div>
  );
}
