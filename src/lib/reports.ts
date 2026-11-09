import {
  buildChannelBreakdown,
  buildSeries,
  CAMPAIGNS,
  fmtMoney,
  fmtNum,
  SOURCES,
  type Granularity,
} from "@/lib/mock-data";
import type { SalesRow } from "@/lib/sales-import";

export type ReportSource = "sales" | "marketing";

export const SALES_DIMENSIONS = [
  { id: "date", label: "Date" },
  { id: "category", label: "Category" },
  { id: "item", label: "Item" },
  { id: "paymentType", label: "Payment type" },
] as const;
export type SalesDimension = (typeof SALES_DIMENSIONS)[number]["id"];

export const MARKETING_DIMENSIONS = [
  { id: "date", label: "Date" },
  { id: "channel", label: "Channel" },
  { id: "campaign", label: "Campaign" },
] as const;
export type MarketingDimension = (typeof MARKETING_DIMENSIONS)[number]["id"];

export interface ReportColumn {
  key: string;
  label: string;
  numeric?: boolean;
  format?: (v: string | number) => string;
}

export type ReportRow = Record<string, string | number>;

export interface ReportResult {
  columns: ReportColumn[];
  rows: ReportRow[];
  primaryMetric: string;
  note?: string;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function money(v: string | number) {
  return fmtMoney(Number(v), true);
}
function num(v: string | number) {
  return fmtNum(Number(v));
}
function pct(v: string | number) {
  return Number(v).toFixed(1) + "%";
}
function multiplier(v: string | number) {
  return Number(v).toFixed(2) + "×";
}

function bucketKey(iso: string, granularity: Granularity): string {
  if (granularity === "day") return iso;
  if (granularity === "month") return iso.slice(0, 7);
  const d = new Date(iso + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

function groupSales(
  sales: SalesRow[],
  keyFn: (s: SalesRow) => string,
  groupLabel: string,
  groupFormat?: (v: string | number) => string,
): ReportResult {
  const groups = new Map<
    string,
    { revenue: number; orderIds: Set<string>; rowCount: number; qty: number }
  >();
  sales.forEach((s) => {
    const k = keyFn(s);
    const g = groups.get(k) ?? { revenue: 0, orderIds: new Set<string>(), rowCount: 0, qty: 0 };
    g.revenue += s.total;
    g.rowCount += 1;
    if (s.orderId) g.orderIds.add(s.orderId);
    if (s.quantity != null) g.qty += s.quantity;
    groups.set(k, g);
  });

  const hasQty = sales.some((s) => s.quantity != null);

  const rows: ReportRow[] = Array.from(groups.entries()).map(([group, g]) => {
    const orders = g.orderIds.size || g.rowCount;
    const row: ReportRow = {
      group,
      revenue: round2(g.revenue),
      orders,
      aov: orders ? round2(g.revenue / orders) : 0,
    };
    if (hasQty) row.items = g.qty;
    return row;
  });

  const columns: ReportColumn[] = [
    { key: "group", label: groupLabel, format: groupFormat },
    { key: "revenue", label: "Revenue", numeric: true, format: money },
    { key: "orders", label: "Orders", numeric: true, format: num },
    { key: "aov", label: "AOV", numeric: true, format: money },
    ...(hasQty ? [{ key: "items", label: "Items", numeric: true, format: num }] : []),
  ];

  return { columns, rows, primaryMetric: "revenue" };
}

export function runSalesReport(
  sales: SalesRow[],
  dimension: SalesDimension,
  granularity: Granularity,
): ReportResult {
  if (dimension === "date") {
    const fmt = (v: string | number) => {
      const s = String(v);
      if (granularity === "month") {
        return new Date(s + "-01").toLocaleDateString("en", { month: "short", year: "numeric" });
      }
      return new Date(s).toLocaleDateString("en", { month: "short", day: "numeric" });
    };
    return groupSales(sales, (s) => bucketKey(s.date, granularity), "Date", fmt);
  }
  if (dimension === "category") {
    return groupSales(sales, (s) => s.category || "Uncategorized", "Category");
  }
  if (dimension === "paymentType") {
    return groupSales(sales, (s) => s.paymentType || "Unknown", "Payment type");
  }
  return groupSales(sales, (s) => s.item || "Unknown item", "Item");
}

export function runMarketingReport(
  dimension: MarketingDimension,
  days: number,
  granularity: Granularity,
): ReportResult {
  if (dimension === "campaign") {
    const rows: ReportRow[] = CAMPAIGNS.map((c) => ({
      group: c.name,
      platform: c.platform,
      status: c.status,
      spend: c.spend,
      revenue: c.revenue,
      roas: c.spend ? round2(c.revenue / c.spend) : 0,
      conversions: c.conversions,
      ctr: c.impressions ? round2((c.clicks / c.impressions) * 100) : 0,
    }));
    const columns: ReportColumn[] = [
      { key: "group", label: "Campaign" },
      { key: "platform", label: "Platform" },
      { key: "status", label: "Status" },
      { key: "spend", label: "Spend", numeric: true, format: money },
      { key: "revenue", label: "Revenue", numeric: true, format: money },
      { key: "roas", label: "ROAS", numeric: true, format: multiplier },
      { key: "conversions", label: "Conversions", numeric: true, format: num },
      { key: "ctr", label: "CTR", numeric: true, format: pct },
    ];
    return {
      columns,
      rows,
      primaryMetric: "revenue",
      note: "Campaign totals are lifetime — not filtered by date range.",
    };
  }

  const series = buildSeries(days, granularity);

  if (dimension === "channel") {
    const channels = buildChannelBreakdown(series);
    const rows: ReportRow[] = channels.map((c) => ({
      group: SOURCES.find((s) => s.id === c.source)!.label,
      revenue: c.revenue,
      spend: c.spend,
      roas: round2(c.roas),
      sessions: c.sessions,
      orders: c.orders,
      cvr: round2(c.cvr),
      share: round2(c.share * 100),
    }));
    const columns: ReportColumn[] = [
      { key: "group", label: "Channel" },
      { key: "revenue", label: "Revenue", numeric: true, format: money },
      { key: "spend", label: "Spend", numeric: true, format: money },
      { key: "roas", label: "ROAS", numeric: true, format: multiplier },
      { key: "sessions", label: "Sessions", numeric: true, format: num },
      { key: "orders", label: "Orders", numeric: true, format: num },
      { key: "cvr", label: "CVR", numeric: true, format: pct },
      { key: "share", label: "Share", numeric: true, format: pct },
    ];
    return { columns, rows, primaryMetric: "revenue" };
  }

  const fmt = (v: string | number) => {
    const s = String(v);
    if (granularity === "month") {
      return new Date(s + "-01").toLocaleDateString("en", { month: "short", year: "numeric" });
    }
    return new Date(s).toLocaleDateString("en", { month: "short", day: "numeric" });
  };
  const rows: ReportRow[] = series.map((p) => ({
    group: p.date,
    revenue: p.revenue,
    spend: p.spend,
    roas: p.spend ? round2(p.revenue / p.spend) : 0,
    sessions: p.sessions,
    conversions: p.conversions,
  }));
  const columns: ReportColumn[] = [
    { key: "group", label: "Date", format: fmt },
    { key: "revenue", label: "Revenue", numeric: true, format: money },
    { key: "spend", label: "Spend", numeric: true, format: money },
    { key: "roas", label: "ROAS", numeric: true, format: multiplier },
    { key: "sessions", label: "Sessions", numeric: true, format: num },
    { key: "conversions", label: "Conversions", numeric: true, format: num },
  ];
  return { columns, rows, primaryMetric: "revenue" };
}

export function downloadReportCSV(filename: string, result: ReportResult) {
  const header = result.columns.map((c) => c.label).join(",");
  const esc = (s: string) => (/[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
  const lines = result.rows.map((row) =>
    result.columns
      .map((c) => {
        const raw = row[c.key];
        const display = c.format ? c.format(raw) : String(raw ?? "");
        return esc(display);
      })
      .join(","),
  );
  const csv = [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface SavedReport {
  id: string;
  name: string;
  source: ReportSource;
  dimension: string;
  granularity: Granularity;
  rangeDays: number;
}

const SAVED_KEY = "litlx:reports:v1";

export function loadSavedReports(): SavedReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSavedReports(list: SavedReport[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable — saved reports just won't persist across reloads
  }
}
