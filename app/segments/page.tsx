import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string | null;
  email: string | null;
  order_count: number;
  lifetime_net: string;
  last_order_at: string | null;
  r_score: number;
  f_score: number;
  m_score: number;
};

async function getRfmData() {
  const result = await db.execute<Row>(sql`
    with customer_stats as (
      select
        c.id,
        c.name,
        c.email,
        c.order_count,
        c.last_order_at,
        coalesce(sum(o.net), 0) as lifetime_net,
        extract(day from now() - c.last_order_at) as days_since_last_order
      from customers c
      left join orders o on o.customer_id = c.id
      where c.order_count > 0
      group by c.id
    )
    select
      id, name, email, order_count,
      lifetime_net::text as lifetime_net,
      last_order_at::text as last_order_at,
      -- Recency: fewer days = higher score, so we invert with ntile on negative days
      ntile(5) over (order by days_since_last_order desc) as r_score,
      ntile(5) over (order by order_count asc) as f_score,
      ntile(5) over (order by lifetime_net asc) as m_score
    from customer_stats
    order by lifetime_net desc
  `);
  return result.rows;
}

type Segment = {
  key: string;
  label: string;
  description: string;
  color: string;
  match: (r: number, f: number, m: number) => boolean;
};

const SEGMENTS: Segment[] = [
  {
    key: "champions",
    label: "Champions",
    description: "Recent, frequent, high spend — your best customers",
    color: "#2E7D32",
    match: (r, f, m) => r >= 4 && f >= 4 && m >= 4,
  },
  {
    key: "loyal",
    label: "Loyal",
    description: "Consistent buyers, may not have purchased very recently",
    color: "#558B2F",
    match: (r, f, m) => f >= 4 && m >= 3 && r < 4,
  },
  {
    key: "potential_loyalist",
    label: "Potential",
    description: "Recent buyer with moderate frequency — could become a Champion",
    color: "#00897B",
    match: (r, f, m) => r >= 4 && f >= 2 && f < 4,
  },
  {
    key: "new",
    label: "New",
    description: "Recent first-time or near-first-time buyer",
    color: "#0277BD",
    match: (r, f) => r >= 4 && f <= 1,
  },
  {
    key: "at_risk",
    label: "At Risk",
    description: "Used to buy often or spend well, but it's been a while",
    color: "#EF6C00",
    match: (r, f, m) => r <= 2 && (f >= 3 || m >= 3),
  },
  {
    key: "lost",
    label: "Lost",
    description: "Low on every dimension — hardest to win back",
    color: "#C62828",
    match: (r, f, m) => r <= 2 && f <= 2 && m <= 2,
  },
];

function classify(r: number, f: number, m: number): Segment {
  for (const seg of SEGMENTS) {
    if (seg.match(r, f, m)) return seg;
  }
  return { key: "other", label: "Other", description: "", color: "#757575", match: () => true };
}

function formatMoney(value: string | number) {
  const n = Number(value);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function SegmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string }>;
}) {
  const sp = await searchParams;
  const activeSegment = sp.segment ?? "all";

  const rows = await getRfmData();
  const allClassified = rows.map((r) => ({ ...r, segment: classify(r.r_score, r.f_score, r.m_score) }));

  const bySegment = new Map<string, { segment: Segment; count: number; revenue: number }>();
  for (const c of allClassified) {
    const existing = bySegment.get(c.segment.key) ?? { segment: c.segment, count: 0, revenue: 0 };
    existing.count += 1;
    existing.revenue += Number(c.lifetime_net);
    bySegment.set(c.segment.key, existing);
  }
  const segmentSummary = Array.from(bySegment.values()).sort((a, b) => b.revenue - a.revenue);

  const classified =
    activeSegment === "all" ? allClassified : allClassified.filter((c) => c.segment.key === activeSegment);
  const activeSegmentLabel =
    activeSegment === "all" ? "Customer Segments" : segmentSummary.find((s) => s.segment.key === activeSegment)?.segment.label ?? "Segment";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-0)" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: "24px 32px" }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 22, color: "var(--text-primary)", margin: 0 }}>
            {activeSegmentLabel}
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            RFM scoring — recency, frequency, monetary value — {classified.length} customers
            {activeSegment !== "all" && (
              <>
                {" · "}
                <Link href="/segments" style={{ color: "var(--text-muted)" }}>
                  clear filter
                </Link>
              </>
            )}
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
          {segmentSummary.map((s) => (
            <Link
              key={s.segment.key}
              href={`/segments?segment=${s.segment.key}`}
              style={{ textDecoration: "none", display: "block" }}
            >
            <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: "14px 16px", borderLeft: `3px solid ${s.segment.color}`, outline: activeSegment === s.segment.key ? `1.5px solid ${s.segment.color}` : "none" }}>
              <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{s.segment.label}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{s.segment.description}</div>
              <div style={{ fontSize: 18, color: "var(--text-primary)" }}>{s.count} customers</div>
              <div style={{ fontSize: 12, color: "var(--text-accent)" }}>{formatMoney(s.revenue)} lifetime</div>
            </div>
            </Link>
          ))}
        </div>

        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>All customers, ranked by lifetime value</div>
        <div style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)", borderRadius: 10 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 1fr 0.7fr 1fr",
              padding: "10px 16px",
              fontSize: 11,
              color: "var(--text-muted)",
              borderBottom: "0.5px solid var(--border)",
            }}
          >
            <div>Customer</div>
            <div>Segment</div>
            <div>Orders</div>
            <div>Lifetime value</div>
          </div>
          {classified.map((c, i) => (
            <Link
              key={c.id}
              href={`/customers/${c.id}`}
              style={{ textDecoration: "none", color: "inherit", display: "block" }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.6fr 1fr 0.7fr 1fr",
                  alignItems: "center",
                  padding: "10px 16px",
                  borderBottom: i < classified.length - 1 ? "0.5px solid var(--border)" : "none",
                  fontSize: 13,
                }}
              >
                <div style={{ color: "var(--text-primary)" }}>{c.name || c.email || "Unknown"}</div>
                <div>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 5,
                      background: `${c.segment.color}22`,
                      color: c.segment.color,
                    }}
                  >
                    {c.segment.label}
                  </span>
                </div>
                <div style={{ color: "var(--text-secondary)" }}>{c.order_count}</div>
                <div style={{ color: "var(--text-primary)" }}>{formatMoney(c.lifetime_net)}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
