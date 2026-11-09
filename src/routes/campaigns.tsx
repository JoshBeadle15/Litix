import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { Pause, Play, Plus, Rocket, Square, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CAMPAIGNS,
  fmtMoney,
  fmtNum,
  OBJECTIVES,
  PLANNED_CAMPAIGNS,
  PLATFORMS,
  type Campaign,
  type Objective,
  type Platform,
  type PlannedCampaign,
} from "@/lib/mock-data";
import { Kpi, Panel, PanelEyebrow, PanelTitle, Topbar } from "@/components/dashboard-ui";

export const Route = createFileRoute("/campaigns")({
  head: () => ({
    meta: [
      { title: "Campaigns — MSU Bookstore Analytics" },
      {
        name: "description",
        content:
          "Plan upcoming campaigns and track everything currently live across Meta, Google, and TikTok.",
      },
    ],
  }),
  component: CampaignsPage,
});

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric" });
}

function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(CAMPAIGNS);
  const [planned, setPlanned] = useState<PlannedCampaign[]>(PLANNED_CAMPAIGNS);
  const [dialogOpen, setDialogOpen] = useState(false);

  const inProgress = useMemo(
    () =>
      campaigns
        .filter((c) => c.status !== "ended")
        .sort((a, b) =>
          a.status === b.status ? b.revenue - a.revenue : a.status === "live" ? -1 : 1,
        ),
    [campaigns],
  );

  const totals = useMemo(() => {
    const live = campaigns.filter((c) => c.status === "live");
    const spend = live.reduce((a, c) => a + c.spend, 0);
    const revenue = live.reduce((a, c) => a + c.revenue, 0);
    return {
      spend,
      revenue,
      roas: spend ? revenue / spend : 0,
      liveCount: live.length,
      pausedCount: campaigns.filter((c) => c.status === "paused").length,
    };
  }, [campaigns]);

  const toggleStatus = (id: string) => {
    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: c.status === "live" ? "paused" : "live" } : c,
      ),
    );
  };

  const endCampaign = (id: string) => {
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status: "ended" } : c)));
  };

  const removePlanned = (id: string) => {
    setPlanned((prev) => prev.filter((p) => p.id !== id));
  };

  const launch = (id: string) => {
    const p = planned.find((x) => x.id === id);
    if (!p) return;
    const start = new Date(p.startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 30);
    setCampaigns((prev) => [
      {
        id: "c" + Date.now(),
        name: p.name,
        platform: p.platform,
        objective: p.objective,
        budget: p.budget,
        spend: 0,
        revenue: 0,
        conversions: 0,
        impressions: 0,
        clicks: 0,
        startDate: p.startDate,
        endDate: end.toISOString().slice(0, 10),
        status: "live",
      },
      ...prev,
    ]);
    removePlanned(id);
  };

  const addPlanned = (draft: Omit<PlannedCampaign, "id">) => {
    setPlanned((prev) => [...prev, { ...draft, id: "p" + Date.now() }]);
    setDialogOpen(false);
  };

  return (
    <div className="relative">
      <div
        className="absolute inset-x-0 top-0 h-[420px] pointer-events-none"
        style={{ background: "var(--gradient-glow)" }}
      />
      <Topbar active="Campaigns" />

      <div className="relative px-8 pb-16 max-w-[1480px]">
        <header className="pt-8 pb-6 flex flex-wrap items-end gap-6 justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Marketing · Campaigns
            </div>
            <h1 className="mt-3 font-display text-5xl leading-[1.05] tracking-tight">
              Plan it, launch it, <em className="italic text-primary">track it</em>.
            </h1>
            <p className="mt-3 text-sm text-muted-foreground max-w-lg">
              Draft what's next, launch it when it's ready, and keep an eye on everything spending
              money right now.
            </p>
          </div>

          <NewCampaignDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreate={addPlanned} />
        </header>

        {/* KPI scoreboard */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-md overflow-hidden border border-border shadow-[var(--shadow-panel)]">
          <Kpi
            label="Live Spend"
            value={fmtMoney(totals.spend, true)}
            delta={-3.1}
            invertDelta
            highlight
          />
          <Kpi label="Live Revenue" value={fmtMoney(totals.revenue, true)} delta={9.4} />
          <Kpi label="Blended ROAS" value={totals.roas.toFixed(2) + "×"} delta={6.8} />
          <Kpi
            label="Live Campaigns"
            value={String(totals.liveCount)}
            delta={totals.pausedCount ? -totals.pausedCount : 0}
          />
        </section>

        {/* In progress */}
        <section className="mt-6">
          <div className="flex items-end justify-between mb-4">
            <div>
              <PanelEyebrow>Live now</PanelEyebrow>
              <PanelTitle>In progress</PanelTitle>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {inProgress.length} active
            </div>
          </div>

          {inProgress.length === 0 ? (
            <Panel className="p-10 text-center text-sm text-muted-foreground">
              Nothing in flight. Launch a planned campaign below to get moving.
            </Panel>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {inProgress.map((c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  onToggle={() => toggleStatus(c.id)}
                  onEnd={() => endCampaign(c.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Planner */}
        <section className="mt-10">
          <div className="mb-4">
            <PanelEyebrow>Planning</PanelEyebrow>
            <PanelTitle>Upcoming campaigns</PanelTitle>
          </div>

          <Panel className="p-0">
            {planned.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Nothing on the calendar. Start drafting your next campaign.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {planned.map((p) => (
                  <li key={p.id} className="p-5 flex flex-wrap items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px]">{p.name}</span>
                        <Tag>{p.platform}</Tag>
                        <Tag>{p.objective}</Tag>
                      </div>
                      {p.notes && (
                        <p className="mt-1 text-xs text-muted-foreground max-w-md">{p.notes}</p>
                      )}
                    </div>
                    <div className="font-mono text-[12px] text-muted-foreground tabular-nums">
                      {fmtDate(p.startDate)}
                    </div>
                    <div className="font-mono text-[12px] tabular-nums w-20 text-right">
                      {fmtMoney(p.budget, true)}
                    </div>
                    <div className="flex items-center gap-2">
                      <ActionButton
                        icon={Rocket}
                        label="Launch"
                        onClick={() => launch(p.id)}
                        primary
                      />
                      <ActionButton
                        icon={Trash2}
                        label="Delete"
                        onClick={() => removePlanned(p.id)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>
      </div>
    </div>
  );
}

function CampaignCard({
  campaign,
  onToggle,
  onEnd,
}: {
  campaign: Campaign;
  onToggle: () => void;
  onEnd: () => void;
}) {
  const c = campaign;
  const roas = c.spend ? c.revenue / c.spend : 0;
  const ctr = c.impressions ? (c.clicks / c.impressions) * 100 : 0;
  const pacePct = c.budget ? Math.min(100, (c.spend / c.budget) * 100) : 0;
  const overPace = pacePct >= 95;

  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px] truncate">{c.name}</div>
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <Tag>{c.platform}</Tag>
            <Tag>{c.objective}</Tag>
          </div>
        </div>
        <span
          className={
            "inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider shrink-0 " +
            (c.status === "live" ? "text-positive" : "text-muted-foreground")
          }
        >
          <span
            className={
              "size-1.5 rounded-full " + (c.status === "live" ? "bg-positive" : "bg-accent")
            }
          />
          {c.status === "live" ? "Live" : "Paused"}
        </span>
      </div>

      <div className="mt-4 font-mono text-[10px] text-muted-foreground">
        {fmtDate(c.startDate)} – {fmtDate(c.endDate)}
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between font-mono text-[11px] text-muted-foreground">
          <span>
            {fmtMoney(c.spend, true)} of {fmtMoney(c.budget, true)}
          </span>
          <span>{pacePct.toFixed(0)}%</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-surface-2 overflow-hidden">
          <div
            className={"h-full rounded-full " + (overPace ? "bg-negative" : "bg-primary")}
            style={{ width: pacePct + "%" }}
          />
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border grid grid-cols-4 gap-2 font-mono text-[11px]">
        <Stat label="Revenue" value={fmtMoney(c.revenue, true)} />
        <Stat label="ROAS" value={roas ? roas.toFixed(2) + "×" : "—"} />
        <Stat label="Conv." value={fmtNum(c.conversions)} />
        <Stat label="CTR" value={ctr.toFixed(1) + "%"} />
      </div>

      <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
        <ActionButton
          icon={c.status === "live" ? Pause : Play}
          label={c.status === "live" ? "Pause" : "Resume"}
          onClick={onToggle}
        />
        <ActionButton icon={Square} label="End" onClick={onEnd} />
      </div>
    </Panel>
  );
}

function NewCampaignDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (draft: Omit<PlannedCampaign, "id">) => void;
}) {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<Platform>("Meta");
  const [objective, setObjective] = useState<Objective>("Conversions");
  const [budget, setBudget] = useState("");
  const [startDate, setStartDate] = useState("");

  const reset = () => {
    setName("");
    setPlatform("Meta");
    setObjective("Conversions");
    setBudget("");
    setStartDate("");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const budgetNum = Number(budget);
    if (!name.trim() || !startDate || !budgetNum || budgetNum <= 0) return;
    onCreate({ name: name.trim(), platform, objective, budget: budgetNum, startDate });
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-2 h-9 px-4 text-[12px] font-mono uppercase tracking-wider bg-primary text-primary-foreground rounded-sm hover:opacity-90">
          <Plus className="size-3.5" /> New campaign
        </button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-tight font-normal">
            Draft a campaign
          </DialogTitle>
          <DialogDescription>
            Add it to the planner now — you can launch it whenever it's ready.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Finals Week Study Bundle"
              className={fieldClass}
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Platform">
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
                className={fieldClass}
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Objective">
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value as Objective)}
                className={fieldClass}
              >
                {OBJECTIVES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Budget">
              <input
                type="number"
                min={1}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="5000"
                className={fieldClass}
                required
              />
            </Field>
            <Field label="Start date">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={fieldClass}
                required
              />
            </Field>
          </div>
          <DialogFooter>
            <button
              type="submit"
              className="h-9 px-4 text-[12px] font-mono uppercase tracking-wider bg-primary text-primary-foreground rounded-sm hover:opacity-90"
            >
              Add to planner
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const fieldClass =
  "w-full bg-surface border border-border rounded-sm px-3 h-9 text-[13px] placeholder:text-muted-foreground/70 focus:outline-none focus:border-border-strong";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground border border-border px-1.5 py-0.5 rounded-sm">
      {children}
    </span>
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

function ActionButton({
  icon: Icon,
  label,
  onClick,
  primary,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 border rounded-sm px-2.5 h-8 text-[11px] font-mono uppercase tracking-wider transition-colors " +
        (primary
          ? "border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground"
          : "border-border text-muted-foreground hover:text-foreground hover:border-border-strong")
      }
    >
      <Icon className="size-3" />
      {label}
    </button>
  );
}
