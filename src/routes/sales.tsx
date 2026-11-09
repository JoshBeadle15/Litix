import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CheckCircle2, FileSpreadsheet, Trash2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChartTooltip,
  Kpi,
  Panel,
  PanelEyebrow,
  PanelTitle,
  Td,
  Th,
  Topbar,
} from "@/components/dashboard-ui";
import { fmtMoney, fmtNum } from "@/lib/mock-data";
import {
  FIELD_DEFS,
  guessMapping,
  loadSalesStore,
  normalizeRows,
  parseSalesFile,
  saveSalesStore,
  type ColumnMapping,
  type FieldKey,
  type ImportMeta,
  type ParsedFile,
  type SalesRow,
} from "@/lib/sales-import";

export const Route = createFileRoute("/sales")({
  head: () => ({
    meta: [
      { title: "Sales — MSU Bookstore Analytics" },
      {
        name: "description",
        content: "Import sales exported from Resero POS and see revenue, orders, and category mix.",
      },
    ],
  }),
  component: SalesPage,
});

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SalesPage() {
  const [sales, setSales] = useState<SalesRow[]>([]);
  const [lastImport, setLastImport] = useState<ImportMeta | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    const store = loadSalesStore();
    setSales(store.rows);
    setLastImport(store.lastImport);
  }, []);

  const handleImported = (rows: SalesRow[], meta: ImportMeta, mode: "append" | "replace") => {
    setSales((prev) => {
      const merged = mode === "replace" ? rows : [...prev, ...rows];
      saveSalesStore({ rows: merged, lastImport: meta });
      return merged;
    });
    setLastImport(meta);
    setImportOpen(false);
  };

  const clearData = () => {
    setSales([]);
    setLastImport(null);
    saveSalesStore({ rows: [], lastImport: null });
  };

  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((a, s) => a + s.total, 0);
    const orderIds = new Set(sales.filter((s) => s.orderId).map((s) => s.orderId));
    const orderCount = orderIds.size || sales.length;
    const hasQuantity = sales.some((s) => s.quantity != null);
    const itemsSold = hasQuantity ? sales.reduce((a, s) => a + (s.quantity ?? 0), 0) : null;
    const dates = sales.map((s) => s.date).sort();
    const hasCategory = sales.some((s) => s.category);
    const hasPaymentType = sales.some((s) => s.paymentType);
    const hasOrderId = sales.some((s) => s.orderId);
    const hasItem = sales.some((s) => s.item);

    const byDate = new Map<string, number>();
    sales.forEach((s) => byDate.set(s.date, (byDate.get(s.date) ?? 0) + s.total));
    const daily = Array.from(byDate.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const groupKey = hasCategory ? "category" : hasPaymentType ? "paymentType" : null;
    const byGroup = new Map<string, number>();
    if (groupKey) {
      sales.forEach((s) => {
        const key = (groupKey === "category" ? s.category : s.paymentType) || "Uncategorized";
        byGroup.set(key, (byGroup.get(key) ?? 0) + s.total);
      });
    }
    const groupBreakdown = Array.from(byGroup.entries())
      .map(([label, total]) => ({ label, total, share: totalRevenue ? total / totalRevenue : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const recent = [...sales].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 100);

    return {
      totalRevenue,
      orderCount,
      aov: orderCount ? totalRevenue / orderCount : 0,
      itemsSold,
      dateRange: dates.length ? `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}` : "—",
      daily,
      groupKey,
      groupBreakdown,
      hasOrderId,
      hasItem,
      hasCategory,
      hasPaymentType,
      recent,
    };
  }, [sales]);

  return (
    <div className="relative">
      <div
        className="absolute inset-x-0 top-0 h-[420px] pointer-events-none"
        style={{ background: "var(--gradient-glow)" }}
      />
      <Topbar active="Sales" />

      <div className="relative px-8 pb-16 max-w-[1480px]">
        <header className="pt-8 pb-6 flex flex-wrap items-end gap-6 justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Sales · Resero POS
            </div>
            <h1 className="mt-3 font-display text-5xl leading-[1.05] tracking-tight">
              Your sales, <em className="italic text-primary">however you export them</em>.
            </h1>
            <p className="mt-3 text-sm text-muted-foreground max-w-lg">
              No live POS connection yet — pull a CSV or Excel export from Resero and import it
              here. Map the columns once; we remember the shape for next time.
            </p>
            {lastImport && (
              <div className="mt-3 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <CheckCircle2 className="size-3 text-positive" />
                Last import: {lastImport.filename} · {fmtNum(lastImport.rowCount)} rows ·{" "}
                {new Date(lastImport.importedAt).toLocaleString("en", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {sales.length > 0 && (
              <button
                onClick={clearData}
                className="inline-flex items-center gap-1.5 h-9 px-3 text-[11px] font-mono uppercase tracking-wider border border-border rounded-sm text-muted-foreground hover:text-foreground hover:border-border-strong"
              >
                <Trash2 className="size-3.5" /> Clear data
              </button>
            )}
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 h-9 px-4 text-[12px] font-mono uppercase tracking-wider bg-primary text-primary-foreground rounded-sm hover:opacity-90"
            >
              <Upload className="size-3.5" /> Import file
            </button>
          </div>
        </header>

        {sales.length === 0 ? (
          <Panel className="p-16 flex flex-col items-center text-center gap-4">
            <FileSpreadsheet className="size-8 text-muted-foreground" strokeWidth={1.25} />
            <div>
              <div className="font-display text-xl">No sales imported yet</div>
              <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">
                Export your sales from Resero as a CSV or Excel file, then import it here — you'll
                map the columns on the way in.
              </p>
            </div>
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 h-9 px-4 text-[12px] font-mono uppercase tracking-wider bg-primary text-primary-foreground rounded-sm hover:opacity-90"
            >
              <Upload className="size-3.5" /> Import file
            </button>
          </Panel>
        ) : (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-md overflow-hidden border border-border shadow-[var(--shadow-panel)]">
              <Kpi label="Total Revenue" value={fmtMoney(stats.totalRevenue, true)} highlight />
              <Kpi label="Orders" value={fmtNum(stats.orderCount)} />
              <Kpi label="AOV" value={fmtMoney(stats.aov)} />
              {stats.itemsSold !== null ? (
                <Kpi label="Items Sold" value={fmtNum(stats.itemsSold)} />
              ) : (
                <div className="bg-card p-5">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Date Range
                  </div>
                  <div className="mt-3 font-display text-[22px] leading-none tracking-tight">
                    {stats.dateRange}
                  </div>
                </div>
              )}
            </section>

            <section className="mt-6 grid grid-cols-12 gap-6">
              <Panel
                className={
                  "p-6 " +
                  (stats.groupBreakdown.length ? "col-span-12 xl:col-span-8" : "col-span-12")
                }
              >
                <PanelEyebrow>Daily revenue</PanelEyebrow>
                <PanelTitle>From imported sales</PanelTitle>
                <div className="mt-5 h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="salesRev" x1="0" y1="0" x2="0" y2="1">
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
                      <Tooltip
                        content={<ChartTooltip />}
                        cursor={{ stroke: "var(--border-strong)" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        name="Revenue"
                        stroke="var(--chart-1)"
                        strokeWidth={1.75}
                        fill="url(#salesRev)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              {stats.groupBreakdown.length > 0 && (
                <Panel className="col-span-12 xl:col-span-4 p-6">
                  <PanelEyebrow>
                    {stats.groupKey === "category" ? "Categories" : "Payment types"}
                  </PanelEyebrow>
                  <PanelTitle>Revenue mix</PanelTitle>
                  <ul className="mt-5 space-y-2.5">
                    {stats.groupBreakdown.map((g) => (
                      <li key={g.label}>
                        <div className="flex items-center gap-3">
                          <span className="text-[13px] truncate">{g.label}</span>
                          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                            {(g.share * 100).toFixed(1)}%
                          </span>
                          <span className="font-mono text-[11px] tabular-nums w-20 text-right">
                            {fmtMoney(g.total, true)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 rounded-full bg-surface-2 overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: g.share * 100 + "%" }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}

              <Panel className="col-span-12 p-0">
                <div className="p-6 pb-4">
                  <PanelEyebrow>Recent sales</PanelEyebrow>
                  <PanelTitle>Last {stats.recent.length} rows imported</PanelTitle>
                </div>
                <div className="max-h-[480px] overflow-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-y border-border">
                        <Th>Date</Th>
                        {stats.hasOrderId && <Th>Order ID</Th>}
                        {stats.hasItem && <Th>Item</Th>}
                        {stats.hasCategory && <Th>Category</Th>}
                        {stats.hasPaymentType && <Th>Payment</Th>}
                        <Th right>Total</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recent.map((s) => (
                        <tr
                          key={s.id}
                          className="border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors"
                        >
                          <Td mono>{fmtDate(s.date)}</Td>
                          {stats.hasOrderId && <Td>{s.orderId ?? "—"}</Td>}
                          {stats.hasItem && <Td>{s.item ?? "—"}</Td>}
                          {stats.hasCategory && <Td>{s.category ?? "—"}</Td>}
                          {stats.hasPaymentType && <Td>{s.paymentType ?? "—"}</Td>}
                          <Td right mono>
                            {fmtMoney(s.total)}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </section>
          </>
        )}
      </div>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={handleImported} />
    </div>
  );
}

function ImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: (rows: SalesRow[], meta: ImportMeta, mode: "append" | "replace") => void;
}) {
  const [step, setStep] = useState<"upload" | "map">("upload");
  const [filename, setFilename] = useState("");
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setFilename("");
    setParsed(null);
    setMapping({});
    setMode("append");
    setError(null);
  };

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const result = await parseSalesFile(file);
      if (!result.rows.length) {
        setError("That file doesn't have any rows we can read.");
        return;
      }
      setFilename(file.name);
      setParsed(result);
      setMapping(guessMapping(result.headers));
      setStep("map");
    } catch {
      setError("Couldn't read that file. Make sure it's a CSV or Excel export.");
    }
  };

  const confirm = () => {
    if (!parsed || !mapping.date || !mapping.total) return;
    const rows = normalizeRows(parsed.rows, mapping);
    onImported(
      rows,
      { filename, importedAt: new Date().toISOString(), rowCount: rows.length },
      mode,
    );
    reset();
  };

  const previewRows = parsed ? parsed.rows.slice(0, 5) : [];
  const canConfirm = Boolean(mapping.date && mapping.total);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="bg-card border-border sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-tight font-normal">
            {step === "upload" ? "Import sales" : "Map your columns"}
          </DialogTitle>
          <DialogDescription>
            {step === "upload"
              ? "Choose the CSV or Excel file exported from Resero POS."
              : "Tell us which column is which — we'll remember this file's shape next time."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center gap-3 border border-dashed border-border rounded-md py-10 text-muted-foreground hover:border-border-strong hover:text-foreground transition-colors"
            >
              <Upload className="size-6" strokeWidth={1.25} />
              <span className="text-[13px]">Click to choose a file</span>
              <span className="font-mono text-[10px] uppercase tracking-wider">
                .csv · .xlsx · .xls
              </span>
            </button>
            {error && <p className="text-xs text-negative">{error}</p>}
          </div>
        )}

        {step === "map" && parsed && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {FIELD_DEFS.map((field) => (
                <FieldMapRow
                  key={field.key}
                  field={field}
                  headers={parsed.headers}
                  value={mapping[field.key] ?? ""}
                  onChange={(v) => setMapping((prev) => ({ ...prev, [field.key]: v || undefined }))}
                />
              ))}
            </div>

            <div>
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Preview
              </div>
              <div className="border border-border rounded-sm overflow-auto max-h-40">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left font-mono text-[9px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      {FIELD_DEFS.filter((f) => mapping[f.key]).map((f) => (
                        <th key={f.key} className="py-2 px-3 font-normal">
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        {FIELD_DEFS.filter((f) => mapping[f.key]).map((f) => (
                          <td key={f.key} className="py-2 px-3 truncate max-w-[160px]">
                            {String(row[mapping[f.key] as string] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {parsed.rows.length} rows found in {filename}.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="inline-flex border border-border rounded-sm bg-surface p-0.5">
                {(["append", "replace"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={
                      "px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.16em] rounded-[3px] transition-colors " +
                      (mode === m
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground")
                    }
                  >
                    {m === "append" ? "Add to existing" : "Replace all"}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={reset}
                  className="h-9 px-3 text-[12px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  Back
                </button>
                <button
                  onClick={confirm}
                  disabled={!canConfirm}
                  className="h-9 px-4 text-[12px] font-mono uppercase tracking-wider bg-primary text-primary-foreground rounded-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Import {parsed.rows.length} rows
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FieldMapRow({
  field,
  headers,
  value,
  onChange,
}: {
  field: { key: FieldKey; label: string; required: boolean };
  headers: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {field.label}
        {field.required && <span className="text-primary"> *</span>}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-surface border border-border rounded-sm px-3 h-9 text-[13px] focus:outline-none focus:border-border-strong"
      >
        {!field.required && <option value="">— Not in this file —</option>}
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </label>
  );
}
