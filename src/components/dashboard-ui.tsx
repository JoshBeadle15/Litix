import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Calendar, Search } from "lucide-react";

/* ───────── shared dashboard primitives ───────── */

export function Topbar({ active = "Overview" }: { active?: string }) {
  return (
    <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="px-8 h-14 flex items-center gap-4 max-w-[1480px]">
        <div className="flex items-center gap-3 border-r border-border pr-6">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
            M
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              MSU Bookstore
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground">
              Analytics
            </div>
          </div>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          / {active}
        </div>
        <div className="ml-4 relative flex-1 max-w-md">
          <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search campaigns, channels, products…"
            className="w-full bg-surface border border-border rounded-sm pl-9 pr-3 h-9 text-[13px] placeholder:text-muted-foreground/70 focus:outline-none focus:border-border-strong"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
            ⌘K
          </kbd>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Pill icon={Calendar}>Apr 1 → Apr 30</Pill>
          <button className="h-9 px-3 text-[12px] font-mono uppercase tracking-wider bg-primary text-primary-foreground rounded-sm hover:opacity-90">
            New report
          </button>
        </div>
      </div>
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  small,
  layoutGroup,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
  small?: boolean;
  layoutGroup?: string;
}) {
  return (
    <div className="inline-flex border border-border rounded-sm bg-surface p-0.5">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={
              "relative px-3 " +
              (small ? "py-1 text-[10px]" : "py-1.5 text-[11px]") +
              " font-mono uppercase tracking-[0.16em] rounded-[3px] transition-colors " +
              (active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground")
            }
          >
            {active && (
              <motion.span
                layoutId={"seg-" + (layoutGroup ?? (small ? "s" : "l"))}
                className="absolute inset-0 bg-primary rounded-[3px]"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Kpi({
  label,
  value,
  delta,
  invertDelta,
  highlight,
}: {
  label: string;
  value: string;
  delta?: number;
  invertDelta?: boolean;
  highlight?: boolean;
}) {
  const positive = delta !== undefined && (invertDelta ? delta < 0 : delta > 0);
  return (
    <div className={"bg-card p-5 " + (highlight ? "relative" : "")}>
      {highlight && (
        <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-primary via-primary/40 to-transparent" />
      )}
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-3 font-display text-[34px] leading-none tracking-tight tabular-nums">
        {value}
      </div>
      {delta !== undefined && (
        <div className="mt-3 flex items-center gap-1.5">
          <span
            className={
              "inline-flex items-center font-mono text-[11px] tabular-nums " +
              (positive ? "text-positive" : "text-negative")
            }
          >
            {delta > 0 ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {Math.abs(delta).toFixed(1)}%
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">vs prev period</span>
        </div>
      )}
    </div>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "bg-card border border-border rounded-md shadow-[var(--shadow-panel)] " + className
      }
    >
      {children}
    </div>
  );
}
export function PanelEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </div>
  );
}
export function PanelTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-2xl mt-1 tracking-tight">{children}</h2>;
}

export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex gap-4 flex-wrap">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: i.color }} />
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {i.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Pill({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-border rounded-sm px-2.5 h-9 text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-border-strong cursor-pointer">
      {Icon && <Icon className="size-3" />}
      {children}
    </span>
  );
}

export function Th({
  children,
  right,
  sortable,
  active,
  dir,
  onClick,
}: {
  children: React.ReactNode;
  right?: boolean;
  sortable?: boolean;
  active?: boolean;
  dir?: "asc" | "desc";
  onClick?: () => void;
}) {
  if (!sortable) {
    return <th className={"py-2.5 px-6 font-normal " + (right ? "text-right" : "")}>{children}</th>;
  }
  return (
    <th className={"py-2.5 px-6 font-normal " + (right ? "text-right" : "")}>
      <button
        onClick={onClick}
        className={
          "inline-flex items-center gap-1 transition-colors " +
          (right ? "flex-row-reverse" : "") +
          (active ? " text-foreground" : " hover:text-foreground")
        }
      >
        <span>{children}</span>
        <span className="font-mono text-[9px]">{active ? (dir === "asc" ? "↑" : "↓") : ""}</span>
      </button>
    </th>
  );
}
export function Td({
  children,
  right,
  mono,
}: {
  children: React.ReactNode;
  right?: boolean;
  mono?: boolean;
}) {
  return (
    <td
      className={
        "py-3 px-6 " +
        (right ? "text-right " : "") +
        (mono ? "font-mono tabular-nums text-[12px]" : "")
      }
    >
      {children}
    </td>
  );
}

export function StatusDot({ status }: { status: "live" | "paused" | "ended" }) {
  const map = {
    live: { color: "var(--positive)", label: "Live" },
    paused: { color: "var(--accent)", label: "Paused" },
    ended: { color: "var(--muted-foreground)", label: "Ended" },
  } as const;
  const m = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      <span className="size-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

export function ChartTooltip({ active, payload, label, suffix, valueFormatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm border border-border-strong bg-popover/95 backdrop-blur px-3 py-2 shadow-lg">
      {label && (
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {typeof label === "string" && label.match(/^\d{4}-/)
            ? new Date(label).toLocaleDateString("en", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : label}
        </div>
      )}
      <div className="mt-1 space-y-0.5">
        {payload.map((p: any) => (
          <div key={p.dataKey || p.name} className="flex items-center gap-3 text-[12px]">
            <span
              className="size-2 rounded-full"
              style={{ background: p.color || p.stroke || p.fill }}
            />
            <span className="text-muted-foreground capitalize">{p.name || p.dataKey}</span>
            <span className="ml-auto font-mono tabular-nums">
              {valueFormatter
                ? valueFormatter(p.value)
                : suffix
                  ? p.value + suffix
                  : "$" + Intl.NumberFormat("en").format(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
