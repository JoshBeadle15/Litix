// Deterministic mock data so the dashboard feels alive but stable.

export type Source =
  | "website"
  | "resero_pos"
  | "meta_ads"
  | "google_ads"
  | "instagram_organic"
  | "facebook_organic";

export const SOURCES: { id: Source; label: string; kind: "channel" | "platform"; color: string }[] =
  [
    { id: "website", label: "Website", kind: "channel", color: "var(--chart-1)" },
    { id: "resero_pos", label: "Resero POS", kind: "channel", color: "var(--chart-2)" },
    { id: "meta_ads", label: "Meta Ads", kind: "platform", color: "var(--chart-3)" },
    { id: "google_ads", label: "Google Ads", kind: "platform", color: "var(--chart-4)" },
    { id: "instagram_organic", label: "Instagram", kind: "platform", color: "var(--chart-5)" },
    { id: "facebook_organic", label: "Facebook", kind: "platform", color: "oklch(0.6 0.14 250)" },
  ];

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Granularity = "day" | "week" | "month";

export const RANGES = [
  { id: "7d", label: "7D", days: 7 },
  { id: "30d", label: "30D", days: 30 },
  { id: "90d", label: "90D", days: 90 },
  { id: "12m", label: "12M", days: 365 },
] as const;

export const GRANS: { id: Granularity; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

export interface SeriesPoint {
  date: string;
  revenue: number;
  spend: number;
  sessions: number;
  conversions: number;
  bySource: Record<Source, number>;
}

export function buildSeries(days: number, granularity: Granularity): SeriesPoint[] {
  const rng = mulberry32(42);
  const today = new Date();
  const points: SeriesPoint[] = [];
  const step = granularity === "day" ? 1 : granularity === "week" ? 7 : 30;
  const buckets = Math.max(6, Math.floor(days / step));

  for (let i = buckets - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i * step);
    const base = 18000 + Math.sin(i / 3) * 4200 + rng() * 5200;
    const revenue = Math.round(
      base * (granularity === "month" ? 28 : granularity === "week" ? 6.5 : 1),
    );
    const spend = Math.round(revenue * (0.18 + rng() * 0.08));
    const sessions = Math.round(
      (1800 + rng() * 900) * (granularity === "month" ? 28 : granularity === "week" ? 6.5 : 1),
    );
    const conversions = Math.round(sessions * (0.024 + rng() * 0.012));
    points.push({
      date: d.toISOString().slice(0, 10),
      revenue,
      spend,
      sessions,
      conversions,
      bySource: {
        website: Math.round(revenue * 0.32),
        resero_pos: Math.round(revenue * 0.41),
        meta_ads: Math.round(revenue * 0.12),
        google_ads: Math.round(revenue * 0.09),
        instagram_organic: Math.round(revenue * 0.04),
        facebook_organic: Math.round(revenue * 0.02),
      },
    });
  }
  return points;
}

export const PLATFORMS = ["Meta", "Google", "TikTok"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const OBJECTIVES = [
  "Awareness",
  "Traffic",
  "Conversions",
  "Retargeting",
  "Catalog Sales",
] as const;
export type Objective = (typeof OBJECTIVES)[number];

export interface Campaign {
  id: string;
  name: string;
  platform: Platform;
  objective: Objective;
  budget: number;
  spend: number;
  revenue: number;
  conversions: number;
  impressions: number;
  clicks: number;
  startDate: string;
  endDate: string;
  status: "live" | "paused" | "ended";
}

export const CAMPAIGNS: Campaign[] = [
  {
    id: "c1",
    name: "Spring Drop / Lookbook",
    platform: "Meta",
    objective: "Conversions",
    budget: 16000,
    spend: 12480,
    revenue: 64210,
    conversions: 312,
    impressions: 1240000,
    clicks: 28400,
    startDate: "2026-04-01",
    endDate: "2026-04-30",
    status: "live",
  },
  {
    id: "c2",
    name: "Brand Search — Core",
    platform: "Google",
    objective: "Traffic",
    budget: 10000,
    spend: 8920,
    revenue: 71200,
    conversions: 489,
    impressions: 312000,
    clicks: 19800,
    startDate: "2026-03-01",
    endDate: "2026-12-31",
    status: "live",
  },
  {
    id: "c3",
    name: "Retargeting / Cart 7d",
    platform: "Meta",
    objective: "Retargeting",
    budget: 5000,
    spend: 4210,
    revenue: 38900,
    conversions: 221,
    impressions: 480000,
    clicks: 9120,
    startDate: "2026-02-15",
    endDate: "2026-12-31",
    status: "live",
  },
  {
    id: "c4",
    name: "Performance Max — Catalog",
    platform: "Google",
    objective: "Catalog Sales",
    budget: 18000,
    spend: 15600,
    revenue: 52100,
    conversions: 274,
    impressions: 890000,
    clicks: 14200,
    startDate: "2026-04-05",
    endDate: "2026-05-05",
    status: "live",
  },
  {
    id: "c5",
    name: "Creator Whitelist — Reels",
    platform: "Meta",
    objective: "Awareness",
    budget: 7500,
    spend: 6800,
    revenue: 41200,
    conversions: 187,
    impressions: 612000,
    clicks: 11400,
    startDate: "2026-04-10",
    endDate: "2026-04-28",
    status: "live",
  },
  {
    id: "c6",
    name: "TikTok Spark — UGC v3",
    platform: "TikTok",
    objective: "Awareness",
    budget: 6000,
    spend: 5100,
    revenue: 18900,
    conversions: 92,
    impressions: 720000,
    clicks: 9800,
    startDate: "2026-03-20",
    endDate: "2026-04-20",
    status: "paused",
  },
  {
    id: "c7",
    name: "Holiday Tease (Q4 24)",
    platform: "Meta",
    objective: "Awareness",
    budget: 9500,
    spend: 9200,
    revenue: 12100,
    conversions: 64,
    impressions: 410000,
    clicks: 6200,
    startDate: "2025-12-01",
    endDate: "2025-12-24",
    status: "ended",
  },
];

export interface PlannedCampaign {
  id: string;
  name: string;
  platform: Platform;
  objective: Objective;
  budget: number;
  startDate: string;
  notes?: string;
}

export const PLANNED_CAMPAIGNS: PlannedCampaign[] = [
  {
    id: "p1",
    name: "Finals Week Study Bundle",
    platform: "Meta",
    objective: "Conversions",
    budget: 4500,
    startDate: "2026-12-01",
    notes: "Bundle promo for textbooks + study snacks ahead of finals.",
  },
  {
    id: "p2",
    name: "Spirit Wear — Homecoming",
    platform: "Google",
    objective: "Traffic",
    budget: 6000,
    startDate: "2026-09-15",
  },
  {
    id: "p3",
    name: "New Student Welcome — TikTok",
    platform: "TikTok",
    objective: "Awareness",
    budget: 3000,
    startDate: "2026-08-01",
    notes: "Target incoming freshmen during orientation week.",
  },
];

export interface ChannelRow {
  source: Source;
  revenue: number;
  orders: number;
  aov: number;
  spend: number;
  roas: number;
  share: number;
  delta: number;
  sessions: number;
  cvr: number;
}

const SESSION_SHARE_MAP: Record<Source, number> = {
  website: 0.36,
  resero_pos: 0.04,
  meta_ads: 0.23,
  google_ads: 0.16,
  instagram_organic: 0.13,
  facebook_organic: 0.08,
};

export function buildChannelBreakdown(series: SeriesPoint[]): ChannelRow[] {
  const totalRev = series.reduce((a, p) => a + p.revenue, 0);
  const totalSessions = series.reduce((a, p) => a + p.sessions, 0);
  const totals: Record<Source, number> = {
    website: 0,
    resero_pos: 0,
    meta_ads: 0,
    google_ads: 0,
    instagram_organic: 0,
    facebook_organic: 0,
  };
  series.forEach((p) =>
    (Object.keys(p.bySource) as Source[]).forEach((s) => (totals[s] += p.bySource[s])),
  );

  const spendMap: Record<Source, number> = {
    website: 0,
    resero_pos: 0,
    meta_ads: 28490,
    google_ads: 24520,
    instagram_organic: 1200,
    facebook_organic: 600,
  };
  const deltaMap: Record<Source, number> = {
    website: 8.2,
    resero_pos: 3.4,
    meta_ads: 14.1,
    google_ads: -2.1,
    instagram_organic: 22.7,
    facebook_organic: -6.3,
  };
  const aovMap: Record<Source, number> = {
    website: 84,
    resero_pos: 142,
    meta_ads: 76,
    google_ads: 92,
    instagram_organic: 68,
    facebook_organic: 58,
  };

  return SOURCES.map(({ id }) => {
    const revenue = totals[id];
    const aov = aovMap[id];
    const orders = Math.round(revenue / aov);
    const spend = spendMap[id];
    const sessions = Math.round(totalSessions * SESSION_SHARE_MAP[id]);
    return {
      source: id,
      revenue,
      orders,
      aov,
      spend,
      roas: spend ? revenue / spend : 0,
      share: totalRev ? revenue / totalRev : 0,
      delta: deltaMap[id],
      sessions,
      cvr: sessions ? (orders / sessions) * 100 : 0,
    };
  }).sort((a, b) => b.revenue - a.revenue);
}

export function fmtMoney(n: number, compact = false) {
  if (compact && Math.abs(n) >= 1000) {
    return (
      "$" + Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n)
    );
  }
  return "$" + Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

export function fmtNum(n: number, compact = false) {
  if (compact && Math.abs(n) >= 1000) {
    return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  }
  return Intl.NumberFormat("en-US").format(n);
}
