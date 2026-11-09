import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import {
  buildChannelBreakdown,
  buildSeries,
  fmtMoney,
  fmtNum,
  GRANS,
  RANGES,
  SOURCES,
  type ChannelRow,
  type Granularity,
  type Source,
} from "@/lib/mock-data";
import {
  ChartTooltip,
  Kpi,
  Panel,
  PanelEyebrow,
  PanelTitle,
  SegmentedControl,
  Td,
  Th,
  Topbar,
} from "@/components/dashboard-ui";

export const Route = createFileRoute("/channels")({
  head: () => ({
    meta: [
      { title: "Channels — MSU Bookstore Analytics" },
      {
        name: "description",
        content:
          "Compare revenue, spend, and efficiency across every source feeding the bookstore — website, POS, and every ad platform.",
      },
    ],
  }),
  component: ChannelsPage,
});

type SortKey = "revenue" | "share" | "sessions" | "orders" | "cvr" | "spend" | "roas" | "delta";

function ChannelsPage() {
  const [rangeId, setRangeId] = useState<(typeof RANGES)[number]["id"]>("30d");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [activeSources, setActiveSources] = useState<Set<Source>>(
    new Set(SOURCES.map((s) => s.id)),
  );
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const range = RANGES.find((r) => r.id === rangeId)!;
  const series = useMemo(() => buildSeries(range.days, granularity), [range.days, granularity]);
  const channels = useMemo(() => buildChannelBreakdown(series), [series]);

  const toggleSource = (id: Source) => {
    const next = new Set(activeSources);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setActiveSources(next);
  };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortedChannels = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...channels].sort((a, b) => (a[sortKey] - b[sortKey]) * dir);
  }, [channels, sortKey, sortDir]);

  const platformRevenue = channels
    .filter((c) => sourceMeta(c.source).kind === "platform")
    .reduce((a, c) => a + c.revenue, 0);
  const channelRevenue = channels
    .filter((c) => sourceMeta(c.source).kind === "channel")
    .reduce((a, c) => a + c.revenue, 0);
  const paidSpend = channels.reduce((a, c) => a + c.spend, 0);
  const totalSessions = channels.reduce((a, c) => a + c.sessions, 0);
  const totalOrders = channels.reduce((a, c) => a + c.orders, 0);
  const blendedRoas = paidSpend ? platformRevenue / paidSpend : 0;
  const avgCvr = totalSessions ? (totalOrders / totalSessions) * 100 : 0;
  const topChannel = channels[0];

  return (
    <div className="relative">
      <div
        className="absolute inset-x-0 top-0 h-[420px] pointer-events-none"
        style={{ background: "var(--gradient-glow)" }}
      />
      <Topbar active="Channels" />

      <div className="relative px-8 pb-16 max-w-[1480px]">
        <header className="pt-8 pb-6 flex flex-wrap items-end gap-6 justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Marketing · Sales · Last {range.label}
            </div>
            <h1 className="mt-3 font-display text-5xl leading-[1.05] tracking-tight">
              Every channel, <em className="italic text-primary">side by side</em>.
            </h1>
            <p className="mt-3 text-sm text-muted-foreground max-w-lg">
              Toggle any source below to isolate it in the trend line, or sort the table to see
              who's actually earning their spend.
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
          <Kpi
            label="Total Revenue"
            value={fmtMoney(platformRevenue + channelRevenue, true)}
            delta={10.8}
            highlight
          />
          <Kpi label="Ad Platform Revenue" value={fmtMoney(platformRevenue, true)} delta={15.2} />
          <Kpi label="Direct Revenue" value={fmtMoney(channelRevenue, true)} delta={4.9} />
          <Kpi label="Blended ROAS" value={blendedRoas.toFixed(2) + "×"} delta={6.3} />
          <Kpi label="Avg Conversion Rate" value={avgCvr.toFixed(1) + "%"} delta={2.1} />
          <Kpi
            label="Top Channel"
            value={sourceMeta(topChannel.source).label}
            delta={topChannel.delta}
          />
        </section>

        {/* Main grid */}
        <section className="mt-6 grid grid-cols-12 gap-6">
          {/* Stacked revenue-by-channel trend */}
          <Panel className="col-span-12 p-6">
            <div className="flex items-start justify-between mb-5 flex-wrap gap-4">
              <div>
                <PanelEyebrow>Revenue by channel</PanelEyebrow>
                <PanelTitle>Who's carrying the trend line</PanelTitle>
              </div>
              <div className="flex gap-3 flex-wrap">
                {SOURCES.map((s) => {
                  const on = activeSources.has(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleSource(s.id)}
                      className="flex items-center gap-2 group"
                    >
                      <span
                        className="size-2 rounded-full shrink-0 transition-opacity"
                        style={{ background: s.color, opacity: on ? 1 : 0.25 }}
                      />
                      <span
                        className={
                          "font-mono text-[10px] uppercase tracking-wider transition-colors " +
                          (on
                            ? "text-muted-foreground group-hover:text-foreground"
                            : "text-muted-foreground/40 line-through")
                        }
                      >
                        {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
                  {SOURCES.filter((s) => activeSources.has(s.id)).map((s) => (
                    <Area
                      key={s.id}
                      name={s.label}
                      dataKey={(p: (typeof series)[number]) => p.bySource[s.id]}
                      stackId="rev"
                      type="monotone"
                      stroke={s.color}
                      fill={s.color}
                      fillOpacity={0.5}
                      strokeWidth={1.25}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          {/* Channel cards */}
          <section className="col-span-12 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {channels.map((row) => (
              <ChannelCard
                key={row.source}
                row={row}
                series={series}
                on={activeSources.has(row.source)}
                onToggle={() => toggleSource(row.source)}
              />
            ))}
          </section>

          {/* Full comparison table */}
          <Panel className="col-span-12 p-0">
            <div className="p-6 pb-4">
              <PanelEyebrow>Comparison</PanelEyebrow>
              <PanelTitle>Every channel, every metric</PanelTitle>
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-y border-border">
                  <Th>Channel</Th>
                  <Th
                    right
                    sortable
                    active={sortKey === "revenue"}
                    dir={sortDir}
                    onClick={() => handleSort("revenue")}
                  >
                    Revenue
                  </Th>
                  <Th
                    right
                    sortable
                    active={sortKey === "share"}
                    dir={sortDir}
                    onClick={() => handleSort("share")}
                  >
                    Share
                  </Th>
                  <Th
                    right
                    sortable
                    active={sortKey === "sessions"}
                    dir={sortDir}
                    onClick={() => handleSort("sessions")}
                  >
                    Sessions
                  </Th>
                  <Th
                    right
                    sortable
                    active={sortKey === "orders"}
                    dir={sortDir}
                    onClick={() => handleSort("orders")}
                  >
                    Orders
                  </Th>
                  <Th
                    right
                    sortable
                    active={sortKey === "cvr"}
                    dir={sortDir}
                    onClick={() => handleSort("cvr")}
                  >
                    CVR
                  </Th>
                  <Th
                    right
                    sortable
                    active={sortKey === "spend"}
                    dir={sortDir}
                    onClick={() => handleSort("spend")}
                  >
                    Spend
                  </Th>
                  <Th
                    right
                    sortable
                    active={sortKey === "roas"}
                    dir={sortDir}
                    onClick={() => handleSort("roas")}
                  >
                    ROAS
                  </Th>
                  <Th
                    right
                    sortable
                    active={sortKey === "delta"}
                    dir={sortDir}
                    onClick={() => handleSort("delta")}
                  >
                    Δ vs prev
                  </Th>
                </tr>
              </thead>
              <tbody>
                {sortedChannels.map((row) => {
                  const meta = sourceMeta(row.source);
                  const on = activeSources.has(row.source);
                  const positive = row.delta >= 0;
                  return (
                    <tr
                      key={row.source}
                      className={
                        "border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors " +
                        (on ? "" : "opacity-35")
                      }
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
                        {(row.share * 100).toFixed(1)}%
                      </Td>
                      <Td right mono>
                        {fmtNum(row.sessions, true)}
                      </Td>
                      <Td right mono>
                        {fmtNum(row.orders)}
                      </Td>
                      <Td right mono>
                        {row.cvr.toFixed(1)}%
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
        </section>
      </div>
    </div>
  );
}

function sourceMeta(id: Source) {
  return SOURCES.find((s) => s.id === id)!;
}

function ChannelCard({
  row,
  series,
  on,
  onToggle,
}: {
  row: ChannelRow;
  series: ReturnType<typeof buildSeries>;
  on: boolean;
  onToggle: () => void;
}) {
  const meta = sourceMeta(row.source);
  const positive = row.delta >= 0;
  const trend = series.map((p) => ({ date: p.date, v: p.bySource[row.source] }));

  return (
    <Panel className={"p-5 transition-opacity " + (on ? "" : "opacity-40")}>
      <div className="flex items-center justify-between">
        <button onClick={onToggle} className="flex items-center gap-2.5 group">
          <span className="size-2 rounded-full" style={{ background: meta.color }} />
          <span className="text-[13px] group-hover:text-primary transition-colors">
            {meta.label}
          </span>
        </button>
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground border border-border px-1.5 py-0.5 rounded-sm">
          {meta.kind}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="font-display text-[28px] leading-none tracking-tight tabular-nums">
            {fmtMoney(row.revenue, true)}
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span
              className={
                "inline-flex items-center font-mono text-[11px] tabular-nums " +
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
            <span className="font-mono text-[10px] text-muted-foreground">
              share {(row.share * 100).toFixed(0)}%
            </span>
          </div>
        </div>
        <div className="h-12 w-28">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={"spark-" + row.source} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={meta.color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={meta.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={meta.color}
                strokeWidth={1.5}
                fill={"url(#spark-" + row.source + ")"}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-2 font-mono text-[11px]">
        <Stat label="Spend" value={row.spend ? fmtMoney(row.spend, true) : "—"} />
        <Stat label="ROAS" value={row.roas ? row.roas.toFixed(2) + "×" : "—"} />
        <Stat label="CVR" value={row.cvr.toFixed(1) + "%"} />
      </div>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground uppercase tracking-wider text-[9px]">{label}</div>
      <div className="mt-1 tabular-nums">{value}</div>
    </div>
  );
}
