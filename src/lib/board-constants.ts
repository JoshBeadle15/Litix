export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  low: { label: "Low", color: "var(--muted-foreground)" },
  medium: { label: "Medium", color: "var(--chart-2)" },
  high: { label: "High", color: "var(--chart-4)" },
  urgent: { label: "Urgent", color: "var(--negative)" },
};

export function dueMeta(dueDate: string | null | undefined) {
  if (!dueDate) return null;
  const d = new Date(dueDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
  const label = d.toLocaleDateString("en", { month: "short", day: "numeric" });
  return { label, overdue: diffDays < 0, dueSoon: diffDays >= 0 && diffDays <= 2 };
}
