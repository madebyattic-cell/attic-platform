import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";

export const dynamic = "force-dynamic";

type Row = {
  connector: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  rows_written: number;
  error_message: string | null;
};

async function getLatestRuns() {
  const result = await db.execute<Row>(sql`
    select distinct on (connector)
      connector,
      status,
      started_at::text as started_at,
      finished_at::text as finished_at,
      rows_written,
      error_message
    from sync_runs
    order by connector, started_at desc
  `);
  return result.rows;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function hoursSince(value: string | null): number | null {
  if (!value) return null;
  return (Date.now() - new Date(value).getTime()) / (1000 * 60 * 60);
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    ok: { bg: "var(--bg-success)", text: "var(--text-success)", label: "OK" },
    running: { bg: "var(--surface-1)", text: "var(--text-muted)", label: "Running" },
    failed: { bg: "#FDECEA", text: "#C62828", label: "Failed" },
  };
  const s = map[status] ?? map.running;
  return (
    <span style={{ background: s.bg, color: s.text, fontSize: 11, padding: "3px 10px", borderRadius: 6 }}>
      {s.label}
    </span>
  );
}

const EXPECTED_FREQUENCY_HOURS: Record<string, number> = {
  wix_orders: 30,
  gumroad_sales: 30,
  gumroad_listings: 48,
  ga4: 30,
  gsc: 48,
};

export default async function SyncHealthPage() {
  const rows = await getLatestRuns();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-0)" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: "24px 32px" }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 22, color: "var(--text-primary)", margin: 0 }}>
            Sync Health
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            Most recent run of every data connector
          </p>
        </div>

        <div style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)", borderRadius: 10 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 0.8fr 1.2fr 1.2fr 0.8fr 2fr",
              padding: "10px 16px",
              fontSize: 11,
              color: "var(--text-muted)",
              borderBottom: "0.5px solid var(--border)",
            }}
          >
            <div>Connector</div>
            <div>Status</div>
            <div>Started</div>
            <div>Finished</div>
            <div>Rows</div>
            <div>Note</div>
          </div>
          {rows.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: "var(--text-secondary)" }}>No sync runs recorded yet.</div>
          ) : (
            rows.map((row, i) => {
              const hrs = hoursSince(row.started_at);
              const expected = EXPECTED_FREQUENCY_HOURS[row.connector];
              const isStale = expected != null && hrs != null && hrs > expected * 2;
              return (
                <div
                  key={row.connector}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 0.8fr 1.2fr 1.2fr 0.8fr 2fr",
                    alignItems: "center",
                    padding: "10px 16px",
                    borderBottom: i < rows.length - 1 ? "0.5px solid var(--border)" : "none",
                    fontSize: 13,
                    background: isStale ? "var(--bg-warning)" : "transparent",
                  }}
                >
                  <div style={{ color: "var(--text-primary)" }}>{row.connector}</div>
                  <div><StatusPill status={row.status} /></div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>{formatDateTime(row.started_at)}</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>{formatDateTime(row.finished_at)}</div>
                  <div style={{ color: "var(--text-secondary)" }}>{row.rows_written}</div>
                  <div style={{ fontSize: 12, color: row.error_message ? "#C62828" : isStale ? "var(--text-warning)" : "var(--text-muted)" }}>
                    {row.error_message ?? (isStale ? `Hasn't run in ${Math.round(hrs!)}h — expected every ~${expected}h` : "")}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
