import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Bookmark, Download, X } from "lucide-react";
import {
  ChartTooltip,
  Panel,
  PanelEyebrow,
  PanelTitle,
  SegmentedControl,
  Td,
  Th,
  Topbar,
} from "@/components/dashboard-ui";
import { GRANS, RANGES, type Granularity } from "@/lib/mock-data";
import { loadSalesStore, type SalesRow } from "@/lib/sales-import";
import {
  downloadReportCSV,
  loadSavedReports,
  MARKETING_DIMENSIONS,
  runMarketingReport,
  runSalesReport,
  saveSavedReports,
  SALES_DIMENSIONS,
  type MarketingDimension,
  type ReportResult,
  type ReportSource,
  type SalesDimension,
  type SavedReport,
} from "@/lib/reports";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — MSU Bookstore Analytics" },
      {
        name: "description",
        content:
          "Build granular reports across sales and marketing data — group, sort, save, and export.",
      },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const [sales, setSales] = useState<SalesRow[]>([]);
  const [source, setSource] = useState<ReportSource>("sales");
  const [dimension, setDimension] = useState<string>("manufacturer");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [rangeId, setRangeId] = useState<(typeof RANGES)[number]["id"]>("30d");
  const [sortKey, setSortKey] = useState("revenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [savingName, setSavingName] = useState<string | null>(null);

  useEffect(() => {
    setSales(loadSalesStore().rows);
    setSaved(loadSavedReports());
  }, []);

  const dimensions = source === "sales" ? SALES_DIMENSIONS : MARKETING_DIMENSIONS;
  const rangeDays = RANGES.find((r) => r.id === rangeId)!.days;

  const result: ReportResult = useMemo(() => {
    if (source === "sales") {
      return runSalesReport(sales, dimension as SalesDimension, granularity);
    }
    return runMarketingReport(dimension as MarketingDimension, rangeDays, granularity);
  }, [source, dimension, granularity, rangeDays, sales]);

  const setSourceAndReset = (next: ReportSource) => {
    setSource(next);
    setDimension(next === "sales" ? "date" : "channel");
    setSortKey("revenue");
    setSortDir("desc");
  };

  const setDimensionAndReset = (next: string) => {
    setDimension(next);
    if (next === "date") {
      setSortKey("group");
      setSortDir("asc");
    } else {
      setSortKey(result.primaryMetric);
      setSortDir("desc");
    }
  };

  const handleSort = (key: string) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortedRows = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...result.rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [result, sortKey, sortDir]);

  const chartMetric =
    typeof result.rows[0]?.[sortKey] === "number" ? sortKey : result.primaryMetric;
  const groupColumn = result.columns[0];
  const metricColumn = result.columns.find((c) => c.key === chartMetric);
  const isDateDimension = dimension === "date";

  const chartData = useMemo(() => {
    if (isDateDimension) {
      return [...result.rows].sort((a, b) => String(a.group).localeCompare(String(b.group)));
    }
    return [...result.rows]
      .sort((a, b) => Number(b[chartMetric]) - Number(a[chartMetric]))
      .slice(0, 10);
  }, [result.rows, chartMetric, isDateDimension]);

  const applySaved = (s: SavedReport) => {
    setSource(s.source);
    setDimension(s.dimension);
    setGranularity(s.granularity);
    const match = RANGES.find((r) => r.days === s.rangeDays);
    if (match) setRangeId(match.id);
  };

  const confirmSave = () => {
    if (!savingName?.trim()) return;
    const next: SavedReport[] = [
      ...saved,
      { id: "r" + Date.now(), name: savingName.trim(), source, dimension, granularity, rangeDays },
    ];
    setSaved(next);
    saveSavedReports(next);
    setSavingName(null);
  };

  const deleteSaved = (id: string) => {
    const next = saved.filter((s) => s.id !== id);
    setSaved(next);
    saveSavedReports(next);
  };

  return (
    <div className="relative">
      <div
        className="absolute inset-x-0 top-0 h-[420px] pointer-events-none"
        style={{ background: "var(--gradient-glow)" }}
      />
      <Topbar active="Reports" />

      <div className="relative px-8 pb-16 max-w-[1480px]">
        <header className="pt-8 pb-6">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Analytics · Reports
          </div>
          <h1 className="mt-3 font-display text-5xl leading-[1.05] tracking-tight">
            Ask your data <em className="italic text-primary">anything</em>.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-lg">
            Pick a source, choose how to slice it, and the table updates instantly. Save the views
            you'll want again.
          </p>
        </header>

        <Panel className="p-5">
          <div className="flex flex-wrap items-end gap-5">
            <ControlGroup label="Source">
              <SegmentedControl
                value={source}
                onChange={(v) => setSourceAndReset(v as ReportSource)}
                options={[
                  { id: "marketing", label: "Marketing" },
                  { id: "sales", label: "Sales" },
                ]}
                layoutGroup="report-source"
              />
            </ControlGroup>

            <ControlGroup label="Group by">
              <SegmentedControl
                value={dimension}
                onChange={setDimensionAndReset}
                options={dimensions.map((d) => ({ id: d.id, label: d.label }))}
                layoutGroup="report-dimension"
              />
            </ControlGroup>

            {isDateDimension && (
              <ControlGroup label="Granularity">
                <SegmentedControl
                  value={granularity}
                  onChange={setGranularity}
                  options={GRANS}
                  small
                  layoutGroup="report-gran"
                />
              </ControlGroup>
            )}

            {source === "marketing" && dimension !== "campaign" && (
              <ControlGroup label="Range">
                <SegmentedControl
                  value={rangeId}
                  onChange={(v) => setRangeId(v as typeof rangeId)}
                  options={RANGES.map((r) => ({ id: r.id, label: r.label }))}
                  small
                  layoutGroup="report-range"
                />
              </ControlGroup>
            )}

            <div className="ml-auto flex items-center gap-2">
              {savingName !== null ? (
                <>
                  <input
                    autoFocus
                    value={savingName}
                    onChange={(e) => setSavingName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && confirmSave()}
                    placeholder="Report name"
                    className="h-9 px-3 text-[13px] bg-surface border border-border rounded-sm focus:outline-none focus:border-border-strong w-40"
                  />
                  <button
                    onClick={confirmSave}
                    className="h-9 px-3 text-[12px] font-mono uppercase tracking-wider bg-primary text-primary-foreground rounded-sm hover:opacity-90"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setSavingName(null)}
                    className="h-9 px-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setSavingName("")}
                    className="inline-flex items-center gap-1.5 h-9 px-3 text-[11px] font-mono uppercase tracking-wider border border-border rounded-sm text-muted-foreground hover:text-foreground hover:border-border-strong"
                  >
                    <Bookmark className="size-3.5" /> Save
                  </button>
                  <button
                    onClick={() => downloadReportCSV(`${source}-${dimension}-report.csv`, result)}
                    className="inline-flex items-center gap-1.5 h-9 px-3 text-[11px] font-mono uppercase tracking-wider border border-border rounded-sm text-muted-foreground hover:text-foreground hover:border-border-strong"
                  >
                    <Download className="size-3.5" /> Export CSV
                  </button>
                </>
              )}
            </div>
          </div>

          {saved.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Saved
              </span>
              {saved.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1.5 border border-border rounded-sm pl-2.5 pr-1.5 h-7 text-[11px] text-muted-foreground"
                >
                  <button onClick={() => applySaved(s)} className="hover:text-foreground">
                    {s.name}
                  </button>
                  <button onClick={() => deleteSaved(s.id)} className="hover:text-negative">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {result.note && <p className="mt-3 text-[11px] text-muted-foreground">{result.note}</p>}
        </Panel>

        {source === "sales" && sales.length === 0 ? (
          <Panel className="mt-6 p-16 flex flex-col items-center text-center gap-4">
            <div>
              <div className="font-display text-xl">No sales data to report on</div>
              <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">
                Import a Resero export on the Sales page first, then come back here to slice it.
              </p>
            </div>
            <Link
              to="/sales"
              className="inline-flex items-center gap-2 h-9 px-4 text-[12px] font-mono uppercase tracking-wider bg-primary text-primary-foreground rounded-sm hover:opacity-90"
            >
              Go to Sales
            </Link>
          </Panel>
        ) : (
          <section className="mt-6 space-y-6">
            <Panel className="p-6">
              <PanelEyebrow>Chart</PanelEyebrow>
              <PanelTitle>
                {groupColumn.label} by{" "}
                {result.columns.find((c) => c.key === chartMetric)?.label ?? chartMetric}
              </PanelTitle>
              <div className="mt-5 h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  {isDateDimension ? (
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="reportFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        stroke="var(--border)"
                        strokeDasharray="2 4"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="group"
                        tickFormatter={(v) =>
                          groupColumn.format ? groupColumn.format(v) : String(v)
                        }
                        stroke="var(--muted-foreground)"
                        tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="var(--muted-foreground)"
                        tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
                        tickLine={false}
                        axisLine={false}
                        width={48}
                      />
                      <Tooltip
                        content={<ChartTooltip valueFormatter={metricColumn?.format} />}
                        cursor={{ stroke: "var(--border-strong)" }}
                      />
                      <Area
                        type="monotone"
                        dataKey={chartMetric}
                        stroke="var(--chart-1)"
                        strokeWidth={1.75}
                        fill="url(#reportFill)"
                      />
                    </AreaChart>
                  ) : (
                    <BarChart
                      layout="vertical"
                      data={chartData}
                      margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid
                        stroke="var(--border)"
                        strokeDasharray="2 4"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        stroke="var(--muted-foreground)"
                        tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        dataKey="group"
                        type="category"
                        stroke="var(--muted-foreground)"
                        tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
                        tickLine={false}
                        axisLine={false}
                        width={130}
                      />
                      <Tooltip
                        content={<ChartTooltip valueFormatter={metricColumn?.format} />}
                        cursor={{ fill: "var(--surface-2)" }}
                      />
                      <Bar dataKey={chartMetric} radius={[0, 2, 2, 0]} barSize={14}>
                        {chartData.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? "var(--chart-1)" : "var(--chart-3)"} />
                        ))}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel className="p-0">
              <div className="p-6 pb-4 flex items-end justify-between">
                <div>
                  <PanelEyebrow>Results</PanelEyebrow>
                  <PanelTitle>{sortedRows.length} rows</PanelTitle>
                </div>
              </div>
              <div className="max-h-[520px] overflow-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-y border-border">
                      {result.columns.map((c) => (
                        <Th
                          key={c.key}
                          right={c.numeric}
                          sortable
                          active={sortKey === c.key}
                          dir={sortDir}
                          onClick={() => handleSort(c.key)}
                        >
                          {c.label}
                        </Th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors"
                      >
                        {result.columns.map((c) => (
                          <Td key={c.key} right={c.numeric} mono={c.numeric}>
                            {c.format ? c.format(row[c.key]) : String(row[c.key])}
                          </Td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </section>
        )}
      </div>
    </div>
  );
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}
