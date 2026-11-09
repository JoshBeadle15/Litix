import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Calendar, Download, Filter, Sparkles } from "lucide-react";
import {
  buildChannelBreakdown,
  buildSeries,
  CAMPAIGNS,
  fmtMoney,
  fmtNum,
  GRANS,
  RANGES,
  SOURCES,
  type Granularity,
} from "@/lib/mock-data";
import {
  ChartTooltip,
  Kpi,
  Legend,
  Panel,
  PanelEyebrow,
  PanelTitle,
  Pill,
  SegmentedControl,
  StatusDot,
  Td,
  Th,
  Topbar,
} from "@/components/dashboard-ui";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — MSU Bookstore Analytics" },
      {
        name: "description",
        content:
          "Montana State University Bookstore — Unified KPI scoreboard for marketing and sales across all your sources.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [rangeId, setRangeId] = useState<(typeof RANGES)[number]["id"]>("30d");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [activeSources, setActiveSources] = useState<Set<string>>(
    new Set(SOURCES.map((s) => s.id)),
  );

  const range = RANGES.find((r) => r.id === rangeId)!;
  const series = useMemo(() => buildSeries(range.days, granularity), [range.days, granularity]);
  const channels = useMemo(() => buildChannelBreakdown(series), [series]);

  const totals = useMemo(() => {
    const revenue = series.reduce((a, p) => a + p.revenue, 0);
    const spend = series.reduce((a, p) => a + p.spend, 0);
    const sessions = series.reduce((a, p) => a + p.sessions, 0);
    const conv = series.reduce((a, p) => a + p.conversions, 0);
    return {
      revenue,
      spend,
      sessions,
      conv,
      roas: spend ? revenue / spend : 0,
      cac: conv ? spend / conv : 0,
      cvr: sessions ? (conv / sessions) * 100 : 0,
    };
  }, [series]);

  return (
    <div className="relative">
      <div
        className="absolute inset-x-0 top-0 h-[420px] pointer-events-none"
        style={{ background: "var(--gradient-glow)" }}
      />
      <Topbar />

      <div className="relative px-8 pb-16 max-w-[1480px]">
        {/* Title + controls */}
        <header className="pt-8 pb-6 flex flex-wrap items-end gap-6 justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Marketing · Sales · Last {range.label}
            </div>
            <h1 className="mt-3 font-display text-5xl leading-[1.05] tracking-tight">
              Everything <em className="italic text-primary">profitable</em>,
              <br />
              in one scoreboard.
            </h1>
            <p className="mt-3 text-sm text-muted-foreground max-w-lg">
              Six sources unified — website analytics, Resero POS, Meta &amp; Google ad spend, and
              organic social. Drill into any line to evaluate the ads and channels actually moving
              revenue.
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            <SegmentedControl
              value={rangeId}
              onChange={(v) => setRangeId(v as typeof rangeId)}
              options={RANGES.map((r) => ({ id: r.id, label: r.label }))}
            />
            <div className="flex items-center gap-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Granularity
              </div>
              <SegmentedControl
                value={granularity}
                onChange={(v) => setGranularity(v as Granularity)}
                options={GRANS}
                small
              />
            </div>
          </div>
        </header>

        {/* KPI scoreboard */}
        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-px bg-border rounded-md overflow-hidden border border-border shadow-[var(--shadow-panel)]">
          <Kpi label="Net Revenue" value={fmtMoney(totals.revenue, true)} delta={12.4} highlight />
          <Kpi label="Ad Spend" value={fmtMoney(totals.spend, true)} delta={-3.1} invertDelta />
          <Kpi label="Blended ROAS" value={totals.roas.toFixed(2) + "×"} delta={8.7} />
          <Kpi label="Conversions" value={fmtNum(totals.conv, true)} delta={5.2} />
          <Kpi label="CAC" value={fmtMoney(totals.cac)} delta={-6.4} invertDelta />
          <Kpi label="Sessions" value={fmtNum(totals.sessions, true)} delta={9.3} />
        </section>

        {/* Main grid */}
        <section className="mt-6 grid grid-cols-12 gap-6">
          {/* Revenue chart */}
          <Panel className="col-span-12 xl:col-span-8 p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <PanelEyebrow>Revenue vs Spend</PanelEyebrow>
                <PanelTitle>How profit is trending</PanelTitle>
              </div>
              <Legend
                items={[
                  { color: "var(--chart-1)", label: "Revenue" },
                  { color: "var(--chart-2)", label: "Ad spend" },
                ]}
              />
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="spd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) =>
                      new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" })
                    }
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
                    tickFormatter={(v) =>
                      "$" + Intl.NumberFormat("en", { notation: "compact" }).format(v as number)
                    }
                    tickLine={false}
                    axisLine={false}
                    width={48}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border-strong)" }} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--chart-1)"
                    strokeWidth={1.75}
                    fill="url(#rev)"
                  />
                  <Area
                    type="monotone"
                    dataKey="spend"
                    stroke="var(--chart-2)"
                    strokeWidth={1.5}
                    fill="url(#spd)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          {/* Source filter / share */}
          <Panel className="col-span-12 xl:col-span-4 p-6">
            <PanelEyebrow>Sources</PanelEyebrow>
            <PanelTitle>Revenue share by source</PanelTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Toggle any source to recompute the scoreboard.
            </p>
            <ul className="mt-5 space-y-2.5">
              {channels.map((row) => {
                const meta = SOURCES.find((s) => s.id === row.source)!;
                const on = activeSources.has(meta.id);
                return (
                  <li key={meta.id}>
                    <button
                      onClick={() => {
                        const next = new Set(activeSources);
                        next.has(meta.id) ? next.delete(meta.id) : next.add(meta.id);
                        setActiveSources(next);
                      }}
                      className="w-full text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ background: meta.color, opacity: on ? 1 : 0.25 }}
                        />
                        <span
                          className={
                            "text-[13px] " +
                            (on ? "text-foreground" : "text-muted-foreground line-through")
                          }
                        >
                          {meta.label}
                        </span>
                        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                          {(row.share * 100).toFixed(1)}%
                        </span>
                        <span className="font-mono text-[11px] tabular-nums w-20 text-right">
                          {fmtMoney(row.revenue, true)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 rounded-full bg-surface-2 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: (on ? row.share : 0) * 100 + "%" }}
                          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                          className="h-full"
                          style={{ background: meta.color }}
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {/* Channel table */}
          <Panel className="col-span-12 xl:col-span-8 p-0">
            <div className="p-6 pb-4 flex items-end justify-between">
              <div>
                <PanelEyebrow>Channel breakdown</PanelEyebrow>
                <PanelTitle>Where the dollars come from</PanelTitle>
              </div>
              <button className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
                <Download className="size-3" /> Export CSV
              </button>
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-y border-border">
                  <Th>Channel</Th>
                  <Th right>Revenue</Th>
                  <Th right>Orders</Th>
                  <Th right>AOV</Th>
                  <Th right>Spend</Th>
                  <Th right>ROAS</Th>
                  <Th right>Δ vs prev</Th>
                </tr>
              </thead>
              <tbody>
                {channels.map((row) => {
                  const meta = SOURCES.find((s) => s.id === row.source)!;
                  const positive = row.delta >= 0;
                  return (
                    <tr
                      key={row.source}
                      className="border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors"
                    >
                      <Td>
                        <div className="flex items-center gap-3 py-1">
                          <span
                            className="size-2 rounded-full"
                            style={{ background: meta.color }}
                          />
                          <span>{meta.label}</span>
                          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground border border-border px-1.5 py-0.5 rounded-sm">
                            {meta.kind}
                          </span>
                        </div>
                      </Td>
                      <Td right mono>
                        {fmtMoney(row.revenue, true)}
                      </Td>
                      <Td right mono>
                        {fmtNum(row.orders)}
                      </Td>
                      <Td right mono>
                        {fmtMoney(row.aov)}
                      </Td>
                      <Td right mono>
                        {row.spend ? fmtMoney(row.spend, true) : "—"}
                      </Td>
                      <Td right mono>
                        {row.roas ? row.roas.toFixed(2) + "×" : "—"}
                      </Td>
                      <Td right>
                        <span
                          className={
                            "inline-flex items-center gap-0.5 font-mono tabular-nums " +
                            (positive ? "text-positive" : "text-negative")
                          }
                        >
                          {positive ? (
                            <ArrowUpRight className="size-3" />
                          ) : (
                            <ArrowDownRight className="size-3" />
                          )}
                          {Math.abs(row.delta).toFixed(1)}%
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>

          {/* Top campaigns */}
          <Panel className="col-span-12 xl:col-span-4 p-6">
            <PanelEyebrow>Most profitable ads</PanelEyebrow>
            <PanelTitle>Top campaigns by ROAS</PanelTitle>
            <div className="mt-5 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={[...CAMPAIGNS]
                    .sort((a, b) => b.revenue / b.spend - a.revenue / a.spend)
                    .slice(0, 6)}
                  margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
                >
                  <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => v + "×"}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
                    tickLine={false}
                    axisLine={false}
                    width={120}
                  />
                  <Tooltip
                    content={<ChartTooltip suffix="× ROAS" />}
                    cursor={{ fill: "var(--surface-2)" }}
                  />
                  <Bar
                    dataKey={(c) => +(c.revenue / c.spend).toFixed(2)}
                    radius={[0, 2, 2, 0]}
                    barSize={14}
                  >
                    {CAMPAIGNS.slice(0, 6).map((_, i) => (
                      <Cell key={i} fill={i === 0 ? "var(--chart-1)" : "var(--chart-3)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 text-[11px] text-muted-foreground">
              <Sparkles className="size-3 text-primary" />
              <span>
                <span className="text-foreground">Brand Search — Core</span> is your most efficient
                spend at <span className="font-mono text-positive">7.98×</span>.
              </span>
            </div>
          </Panel>

          {/* Campaigns table */}
          <Panel className="col-span-12 p-0">
            <div className="p-6 pb-4 flex items-end justify-between flex-wrap gap-4">
              <div>
                <PanelEyebrow>Campaigns</PanelEyebrow>
                <PanelTitle>All live & recent ad activity</PanelTitle>
              </div>
              <div className="flex items-center gap-2">
                <Pill icon={Filter}>Platform: All</Pill>
                <Pill icon={Calendar}>Last {range.label}</Pill>
              </div>
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-y border-border">
                  <Th>Campaign</Th>
                  <Th>Platform</Th>
                  <Th right>Impr.</Th>
                  <Th right>Clicks</Th>
                  <Th right>Conv.</Th>
                  <Th right>Spend</Th>
                  <Th right>Revenue</Th>
                  <Th right>ROAS</Th>
                  <Th right>Status</Th>
                </tr>
              </thead>
              <tbody>
                {CAMPAIGNS.map((c) => {
                  const roas = c.revenue / c.spend;
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-border last:border-0 hover:bg-surface-2/60"
                    >
                      <Td>{c.name}</Td>
                      <Td>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {c.platform}
                        </span>
                      </Td>
                      <Td right mono>
                        {fmtNum(c.impressions, true)}
                      </Td>
                      <Td right mono>
                        {fmtNum(c.clicks, true)}
                      </Td>
                      <Td right mono>
                        {fmtNum(c.conversions)}
                      </Td>
                      <Td right mono>
                        {fmtMoney(c.spend, true)}
                      </Td>
                      <Td right mono>
                        {fmtMoney(c.revenue, true)}
                      </Td>
                      <Td right>
                        <span
                          className={
                            "font-mono tabular-nums " +
                            (roas >= 3
                              ? "text-positive"
                              : roas >= 1.5
                                ? "text-foreground"
                                : "text-negative")
                          }
                        >
                          {roas.toFixed(2)}×
                        </span>
                      </Td>
                      <Td right>
                        <StatusDot status={c.status} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        </section>
      </div>
    </div>
  );
}
