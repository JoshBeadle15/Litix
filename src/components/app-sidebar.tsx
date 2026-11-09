import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid,
  Radio,
  Megaphone,
  ShoppingBag,
  Users,
  FileBarChart,
  Settings,
  Plug,
  Trello,
} from "lucide-react";

const nav = [
  { label: "Overview", to: "/", icon: LayoutGrid },
  { label: "Channels", to: "/channels", icon: Radio },
  { label: "Campaigns", to: "/campaigns", icon: Megaphone },
  { label: "Sales", to: "/sales", icon: ShoppingBag },
  { label: "Audience", to: "/audience", icon: Users },
  { label: "Reports", to: "/reports", icon: FileBarChart },
  { label: "Boards", to: "/boards", icon: Trello },
];

const lower = [
  { label: "Sources", to: "/sources", icon: Plug },
  { label: "Settings", to: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="hidden lg:flex w-[232px] shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="px-5 pt-6 pb-8">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-sm bg-accent grid place-items-center">
            <span className="font-display text-foreground text-lg leading-none">M</span>
          </div>
          <div className="leading-tight">
            <div className="font-display text-[17px] tracking-tight text-accent">MSU</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent/70">
              Bookstore
            </div>
          </div>
        </div>
      </div>

      <nav className="px-3 flex-1">
        <SectionLabel>Workspace</SectionLabel>
        <ul className="space-y-0.5 mb-6">
          {nav.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={
                    "group flex items-center gap-3 rounded-sm px-3 py-2 text-[13px] transition-colors " +
                    (active
                      ? "bg-sidebar-primary text-white"
                      : "text-accent hover:bg-sidebar-primary/80 hover:text-white")
                  }
                >
                  <item.icon className="size-4" strokeWidth={1.5} />
                  <span>{item.label}</span>
                  {active && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
                </Link>
              </li>
            );
          })}
        </ul>

        <SectionLabel>Configure</SectionLabel>
        <ul className="space-y-0.5">
          {lower.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="flex items-center gap-3 rounded-sm px-3 py-2 text-[13px] text-accent hover:bg-sidebar-primary/80 hover:text-white"
              >
                <item.icon className="size-4" strokeWidth={1.5} />
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="m-3 rounded-sm border border-border bg-surface-2 p-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Data freshness
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="font-display text-2xl">04:12</span>
          <span className="font-mono text-[10px] text-positive">● synced</span>
        </div>
        <div className="mt-1 font-mono text-[10px] text-muted-foreground">
          last pull · 6 sources
        </div>
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
      {children}
    </div>
  );
}
