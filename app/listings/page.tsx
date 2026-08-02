import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type Row = {
  product_id: string;
  display_title: string;
  series_name: string | null;
  cover_url: string | null;
  channels: string; // comma-joined
  orders: number;
  revenue: string;
  status: string;
  kind: string;
};

type SortKey = "name" | "series" | "orders" | "revenue";
const SORT_COLUMNS: Record<SortKey, string> = {
  name: "display_title",
  series: "series_name",
  orders: "orders",
  revenue: "revenue",
};

// "Visuals" = editorial image collections, distinct from mockups. No dedicated
// category field exists yet, so this is a text heuristic on the naming
// convention already in use for these specific series (American Elegy,
// EQUINOX, and the "stock images" bundle variants).
const VISUALS_FILTER = sql`and (p.object_noun ilike '%stock image%' or p.internal_name ilike '%stock image%' or p.internal_name ilike '%editorial%')`;

async function getListings(params: {
  q: string;
  channel: string;
  kind: string;
  status: string;
  category: string;
  sort: SortKey;
  dir: "asc" | "desc";
  page: number;
}) {
  const { q, channel, kind, status, category, sort, dir, page } = params;
  const offset = (page - 1) * PAGE_SIZE;
  const sortColumn = sql.raw(SORT_COLUMNS[sort]);
  const sortDir = dir === "asc" ? sql`asc` : sql`desc`;

  const channelFilter =
    channel === "wix"
      ? sql`and exists (select 1 from listings l2 join channels c2 on l2.channel_id=c2.id where l2.product_id=p.id and c2.key='wix')`
      : channel === "gumroad"
        ? sql`and exists (select 1 from listings l2 join channels c2 on l2.channel_id=c2.id where l2.product_id=p.id and c2.key='gumroad')`
        : channel === "both"
          ? sql`and (select count(distinct c2.key) from listings l2 join channels c2 on l2.channel_id=c2.id where l2.product_id=p.id) >= 2`
          : sql``;

  const kindFilter = kind === "single" || kind === "bundle" ? sql`and p.kind = ${kind}` : sql``;
  const statusFilter = ["live", "draft", "retired", "archived"].includes(status) ? sql`and p.status = ${status}` : sql``;
  const categoryFilter = category === "visuals" ? VISUALS_FILTER : sql``;
  const searchFilter = q ? sql`and (p.internal_name ilike ${"%" + q + "%"} or s.name ilike ${"%" + q + "%"})` : sql``;

  const countResult = await db.execute<{ total: number }>(sql`
    select count(*)::int as total
    from products p
    left join series s on p.series_id = s.id
    where exists (select 1 from listings l where l.product_id = p.id)
    ${searchFilter}
    ${channelFilter}
    ${kindFilter}
    ${statusFilter}
    ${categoryFilter}
  `);
  const total = countResult.rows[0]?.total ?? 0;

  const result = await db.execute<Row>(sql`
    with agg as (
      select
        p.id as product_id,
        p.internal_name as display_title,
        p.status as status,
        p.kind as kind,
        s.name as series_name,
        (select coalesce(array_to_string(array_agg(distinct c2.name order by c2.name), ', '), '')
         from listings l2 join channels c2 on l2.channel_id = c2.id where l2.product_id = p.id) as channels,
        (select count(*)::int from order_items oi where oi.product_id = p.id) as orders,
        (select coalesce(sum(oi.gross), 0)::text from order_items oi where oi.product_id = p.id) as revenue,
        (select a.url from assets a where a.product_id = p.id and a.kind = 'cover' limit 1) as cover_url
      from products p
      left join series s on p.series_id = s.id
      where exists (select 1 from listings l where l.product_id = p.id)
      ${searchFilter}
      ${channelFilter}
      ${kindFilter}
      ${statusFilter}
      ${categoryFilter}
    )
    select * from agg
    order by ${sortColumn} ${sortDir} nulls last
    limit ${PAGE_SIZE} offset ${offset}
  `);

  return { rows: result.rows, total };
}

function formatMoney(value: string | number) {
  const n = Number(value);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function buildQuery(overrides: Record<string, string | number>, current: Record<string, string>) {
  const merged = { ...current, ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, String(v)])) };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v);
  }
  return `/listings?${params.toString()}`;
}

const PAGE_TITLES: Record<string, string> = {
  "kind=bundle": "Bundles",
  "category=visuals": "Visuals",
  "status=retired": "Discontinued",
  "status=archived": "Archived",
};

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    channel?: string;
    kind?: string;
    status?: string;
    category?: string;
    sort?: string;
    dir?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const channel = sp.channel ?? "all";
  const kind = sp.kind ?? "all";
  const status = sp.status ?? "all";
  const category = sp.category ?? "all";
  const sort = (["name", "series", "orders", "revenue"].includes(sp.sort ?? "") ? sp.sort : "name") as SortKey;
  const dir = sp.dir === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const { rows, total } = await getListings({ q, channel, kind, status, category, sort, dir, page });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentParams = { q, channel, kind, status, category, sort, dir, page: String(page) };

  const pageTitle =
    PAGE_TITLES[`kind=${kind}`] ?? PAGE_TITLES[`category=${category}`] ?? PAGE_TITLES[`status=${status}`] ?? "Listings";

  function SortHeader({ label, sortKey, style }: { label: string; sortKey: SortKey; style?: React.CSSProperties }) {
    const isActive = sort === sortKey;
    const nextDir = isActive && dir === "desc" ? "asc" : "desc";
    return (
      <Link
        href={buildQuery({ sort: sortKey, dir: nextDir, page: 1 }, currentParams)}
        style={{ textDecoration: "none", color: isActive ? "var(--text-primary)" : "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, ...style }}
      >
        {label}
        {isActive && <span style={{ fontSize: 10 }}>{dir === "desc" ? "▼" : "▲"}</span>}
      </Link>
    );
  }

  const GRID = "2fr 0.9fr 1.2fr 0.6fr 0.6fr 0.8fr";
  const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    live: { bg: "var(--bg-success)", text: "var(--text-success)" },
    draft: { bg: "var(--surface-1)", text: "var(--text-muted)" },
    retired: { bg: "var(--bg-warning)", text: "var(--text-warning)" },
    archived: { bg: "#EEE", text: "#777" },
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-0)" }}>
      <Sidebar />
      <div style={{ flex: 1 }}>
        <div style={{ padding: "16px 24px", borderBottom: "0.5px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 15, color: "var(--text-primary)" }}>
              {pageTitle} <span style={{ color: "var(--text-muted)", fontSize: 12 }}>({total})</span>
            </span>
            <a href="/products/new">
              <button type="button">Add product</button>
            </a>
          </div>
          <form action="/listings" method="get" style={{ display: "flex", gap: 10 }}>
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="dir" value={dir} />
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="category" value={category} />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search product or series..."
              style={{ width: 240, padding: "6px 10px", fontSize: 13, border: "0.5px solid var(--border)", borderRadius: 6 }}
            />
            <select
              name="channel"
              defaultValue={channel}
              style={{ padding: "6px 10px", fontSize: 13, border: "0.5px solid var(--border)", borderRadius: 6 }}
            >
              <option value="all">All channels</option>
              <option value="wix">Wix only</option>
              <option value="gumroad">Gumroad only</option>
              <option value="both">Wix &amp; Gumroad</option>
            </select>
            <select
              name="status"
              defaultValue={status}
              style={{ padding: "6px 10px", fontSize: 13, border: "0.5px solid var(--border)", borderRadius: 6 }}
            >
              <option value="all">Any status</option>
              <option value="live">Live</option>
              <option value="draft">Draft</option>
              <option value="retired">Discontinued</option>
              <option value="archived">Archived</option>
            </select>
            <button type="submit">Filter</button>
            {(q || channel !== "all" || status !== "all" || kind !== "all" || category !== "all") && (
              <Link href="/listings" style={{ fontSize: 13, color: "var(--text-muted)", alignSelf: "center" }}>
                Clear
              </Link>
            )}
          </form>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>No products match this search/filter.</p>
          </div>
        ) : (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: GRID,
                padding: "10px 24px",
                fontSize: 11,
                color: "var(--text-muted)",
                borderBottom: "0.5px solid var(--border)",
              }}
            >
              <SortHeader label="Product" sortKey="name" />
              <SortHeader label="Series" sortKey="series" />
              <div>Channels</div>
              <div>Status</div>
              <SortHeader label="Orders" sortKey="orders" />
              <SortHeader label="Revenue" sortKey="revenue" />
            </div>
            {rows.map((row) => (
              <Link
                key={row.product_id}
                href={`/products/${row.product_id}`}
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: GRID,
                    alignItems: "center",
                    padding: "11px 24px",
                    borderBottom: "0.5px solid var(--border)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {row.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.cover_url} alt="" style={{ width: 32, height: 48, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 32, height: 48, borderRadius: 6, background: "linear-gradient(135deg, #C1653B, #A8522E)", flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{row.display_title}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{row.series_name ?? "—"}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{row.channels || "—"}</div>
                  <div>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        borderRadius: 5,
                        background: (STATUS_COLORS[row.status] ?? STATUS_COLORS.draft).bg,
                        color: (STATUS_COLORS[row.status] ?? STATUS_COLORS.draft).text,
                      }}
                    >
                      {row.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{row.orders || "—"}</div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{formatMoney(row.revenue)}</div>
                </div>
              </Link>
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Page {page} of {totalPages}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                {page > 1 && (
                  <Link href={buildQuery({ page: page - 1 }, currentParams)} style={{ fontSize: 13, color: "var(--text-primary)" }}>
                    ← Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={buildQuery({ page: page + 1 }, currentParams)} style={{ fontSize: 13, color: "var(--text-primary)" }}>
                    Next →
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
