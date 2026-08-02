import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";
import { TabBar } from "@/components/tab-bar";
import { ANALYTICS_TABS } from "@/components/nav-tabs";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Row = {
  product_id: string;
  name: string;
  series_name: string | null;
  recent_impressions: number;
  recent_clicks: number;
  recent_position: string | null;
  prior_impressions: number | null;
  prior_position: string | null;
};

async function getTrendData() {
  const result = await db.execute<Row>(sql`
    with recent as (
      select l.product_id as product_id,
             coalesce(sum(m.clicks), 0)::int as clicks,
             coalesce(sum(m.impressions), 0)::int as impressions,
             case when sum(m.impressions) > 0 then avg(m.avg_position)::text else null end as avg_position
      from listings l
      join channels c on l.channel_id = c.id and c.key = 'wix'
      join metrics_daily m on m.listing_id = l.id and m.source = 'gsc'
        and m.day >= current_date - interval '30 days'
      group by l.product_id
    ),
    prior as (
      select l.product_id as product_id,
             coalesce(sum(m.impressions), 0)::int as impressions,
             case when sum(m.impressions) > 0 then avg(m.avg_position)::text else null end as avg_position
      from listings l
      join channels c on l.channel_id = c.id and c.key = 'wix'
      join metrics_daily m on m.listing_id = l.id and m.source = 'gsc'
        and m.day >= current_date - interval '60 days'
        and m.day < current_date - interval '30 days'
      group by l.product_id
    )
    select
      p.id as product_id,
      p.internal_name as name,
      s.name as series_name,
      recent.impressions as recent_impressions,
      recent.clicks as recent_clicks,
      recent.avg_position as recent_position,
      prior.impressions as prior_impressions,
      prior.avg_position as prior_position
    from products p
    left join series s on p.series_id = s.id
    join recent on recent.product_id = p.id
    left join prior on prior.product_id = p.id
    where recent.impressions >= 10
    order by recent.impressions desc
  `);
  return result.rows;
}

// Rough, widely-cited industry benchmarks — not exact, just enough to spot
// a page that's dramatically under-clicking for where it ranks.
function expectedCtr(position: number): number {
  if (position <= 3) return 15;
  if (position <= 6) return 5;
  if (position <= 10) return 2;
  if (position <= 20) return 1;
  return 0.5;
}

export default async function SeoDiagnosticsPage() {
  const rows = await getTrendData();

  const withAnalysis = rows.map((r) => {
    const recentPos = r.recent_position ? Number(r.recent_position) : null;
    const priorPos = r.prior_position ? Number(r.prior_position) : null;
    const ctr = r.recent_impressions > 0 ? (r.recent_clicks / r.recent_impressions) * 100 : 0;
    const expected = recentPos != null ? expectedCtr(recentPos) : null;
    const ctrProblem = expected != null && ctr < expected * 0.5 && r.recent_impressions >= 10;
    const positionDecline =
      priorPos != null && recentPos != null && recentPos - priorPos >= 3 && (r.prior_impressions ?? 0) >= 10;
    return { ...r, recentPos, priorPos, ctr, expected, ctrProblem, positionDecline };
  });

  const ctrProblems = withAnalysis.filter((r) => r.ctrProblem).sort((a, b) => b.recent_impressions - a.recent_impressions);
  const positionDeclines = withAnalysis
    .filter((r) => r.positionDecline)
    .sort((a, b) => (b.recentPos! - b.priorPos!) - (a.recentPos! - a.priorPos!));

  function DiagnosticTable({
    title,
    description,
    items,
  }: {
    title: string;
    description: string;
    items: typeof withAnalysis;
  }) {
    return (
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>{description}</div>
        {items.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Nothing flagged right now.</p>
        ) : (
          <div style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)", borderRadius: 10 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 0.8fr 0.7fr 0.8fr 0.8fr",
                padding: "10px 16px",
                fontSize: 11,
                color: "var(--text-muted)",
                borderBottom: "0.5px solid var(--border)",
              }}
            >
              <div>Product</div>
              <div>Series</div>
              <div>Impr. (30d)</div>
              <div>CTR</div>
              <div>Position now</div>
              <div>Position 30d ago</div>
            </div>
            {items.map((row, i) => (
              <Link
                key={row.product_id}
                href={`/products/${row.product_id}`}
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 0.8fr 0.7fr 0.8fr 0.8fr",
                    alignItems: "center",
                    padding: "10px 16px",
                    borderBottom: i < items.length - 1 ? "0.5px solid var(--border)" : "none",
                    fontSize: 13,
                  }}
                >
                  <div style={{ color: "var(--text-primary)" }}>{row.name}</div>
                  <div style={{ color: "var(--text-secondary)" }}>{row.series_name ?? "—"}</div>
                  <div style={{ color: "var(--text-secondary)" }}>{row.recent_impressions}</div>
                  <div style={{ color: "var(--text-secondary)" }}>{row.ctr.toFixed(1)}%</div>
                  <div style={{ color: "var(--text-primary)" }}>{row.recentPos?.toFixed(1) ?? "—"}</div>
                  <div style={{ color: "var(--text-secondary)" }}>{row.priorPos?.toFixed(1) ?? "—"}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-0)" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: "24px 32px" }}>
        <TabBar tabs={ANALYTICS_TABS} active="Seo Problems" />
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 22, color: "var(--text-primary)", margin: 0 }}>
            SEO Diagnostics
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            Two different problems that look similar but need different fixes
          </p>
        </div>

        <DiagnosticTable
          title={`Ranks fine, nobody clicks (${ctrProblems.length})`}
          description="Position is decent but click-through rate is well below what's typical for that spot — usually a title, thumbnail, or meta description problem, not a ranking problem."
          items={ctrProblems}
        />

        <DiagnosticTable
          title={`Ranking is sliding (${positionDeclines.length})`}
          description="Average position got meaningfully worse over the last 30 days compared to the 30 days before — a real relevance or competition problem, not a presentation one."
          items={positionDeclines}
        />
      </div>
    </div>
  );
}
