import { PRIORITY_META, type Priority } from "@/lib/board-constants";

export function PriorityBadge({ priority }: { priority: Priority }) {
  const m = PRIORITY_META[priority];
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
      <span className="size-1.5 rounded-full shrink-0" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

export function Avatar({
  name,
  color,
  size = "sm",
}: {
  name?: string | null;
  color?: string | null;
  size?: "xs" | "sm";
}) {
  const dim = size === "xs" ? "size-5 text-[9px]" : "size-6 text-[10px]";
  if (!name) {
    return (
      <span
        className={
          "inline-flex items-center justify-center rounded-full border border-dashed border-border text-muted-foreground shrink-0 " +
          dim
        }
      >
        ?
      </span>
    );
  }
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      title={name}
      className={
        "inline-flex items-center justify-center rounded-full font-mono font-medium text-white shrink-0 " +
        dim
      }
      style={{ background: color ?? "var(--chart-1)" }}
    >
      {initials}
    </span>
  );
}
