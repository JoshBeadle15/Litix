import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { z } from "zod";
import { Megaphone, Plus, Ticket, Trash2, Trello } from "lucide-react";
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
  Panel,
  PanelEyebrow,
  PanelTitle,
  SegmentedControl,
  Topbar,
} from "@/components/dashboard-ui";
import { UserMenu } from "@/components/user-menu";
import { getCurrentUserFn } from "@/lib/auth";
import { createBoardFn, deleteBoardFn, listBoardsFn, listDepartmentsFn } from "@/lib/tickets";

const searchSchema = z.object({
  tab: z.enum(["marketing", "ticketing"]).optional(),
});

export const Route = createFileRoute("/boards/")({
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const user = await getCurrentUserFn();
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  head: () => ({
    meta: [
      { title: "Boards — MSU Bookstore Analytics" },
      {
        name: "description",
        content: "Trello-style boards for marketing initiatives and departmental ticketing.",
      },
    ],
  }),
  component: BoardsIndexPage,
});

type Template = "it" | "basic" | "blank";
type BoardKind = "marketing" | "ticketing";

interface BoardRow {
  id: string;
  name: string;
  description: string | null;
  kind: BoardKind;
  departmentId: string | null;
  departmentName: string | null;
  cardCount: number;
  createdAt: string | Date;
}

const UNASSIGNED = "__unassigned__";

function BoardsIndexPage() {
  const { user } = Route.useRouteContext();
  const { tab = "marketing" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const isAdmin = user.role === "admin";
  const queryClient = useQueryClient();
  const listBoards = useServerFn(listBoardsFn);
  const listDepartments = useServerFn(listDepartmentsFn);
  const createBoard = useServerFn(createBoardFn);
  const deleteBoard = useServerFn(deleteBoardFn);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  const boardsQuery = useQuery({ queryKey: ["boards"], queryFn: () => listBoards() });
  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: () => listDepartments(),
  });

  const createMutation = useMutation({
    mutationFn: (input: {
      name: string;
      description?: string;
      template: Template;
      kind: BoardKind;
      departmentId?: string;
    }) => createBoard({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      setDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (boardId: string) => deleteBoard({ data: { boardId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["boards"] }),
  });

  const boards: BoardRow[] = useMemo(() => boardsQuery.data ?? [], [boardsQuery.data]);
  const departments = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data]);

  const tabBoards = useMemo(() => boards.filter((b) => b.kind === tab), [boards, tab]);

  const departmentGroups = useMemo(() => {
    if (tab !== "ticketing") return [];
    const groups = new Map<string, { id: string; name: string; boards: BoardRow[] }>();
    for (const dept of departments) {
      groups.set(dept.id, { id: dept.id, name: dept.name, boards: [] });
    }
    const unassigned: BoardRow[] = [];
    for (const board of tabBoards) {
      if (board.departmentId && groups.has(board.departmentId)) {
        groups.get(board.departmentId)!.boards.push(board);
      } else {
        unassigned.push(board);
      }
    }
    const result = Array.from(groups.values());
    if (unassigned.length || result.length === 0) {
      result.push({ id: UNASSIGNED, name: "General / Unassigned", boards: unassigned });
    }
    return result;
  }, [tab, tabBoards, departments]);

  const visibleGroups =
    departmentFilter === "all"
      ? departmentGroups
      : departmentGroups.filter((g) => g.id === departmentFilter);

  const setTab = (next: BoardKind) => {
    setDepartmentFilter("all");
    navigate({ search: { tab: next } });
  };

  return (
    <div className="relative">
      <div
        className="absolute inset-x-0 top-0 h-[420px] pointer-events-none"
        style={{ background: "var(--gradient-glow)" }}
      />
      <Topbar active="Boards" />

      <div className="relative px-8 pb-16 max-w-[1480px]">
        <header className="pt-8 pb-6 flex flex-wrap items-end gap-6 justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Team · Boards
            </div>
            <h1 className="mt-3 font-display text-5xl leading-[1.05] tracking-tight">
              Work, <em className="italic text-primary">organized</em>.
            </h1>
            <p className="mt-3 text-sm text-muted-foreground max-w-lg">
              Marketing initiative boards and departmental IT ticket boards — columns, cards, and a
              shared view everyone works from.
            </p>
          </div>

          <div className="flex items-center gap-4">
            {isAdmin && (
              <NewBoardDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                pending={createMutation.isPending}
                departments={departments}
                defaultKind={tab}
                onCreate={(draft) => createMutation.mutate(draft)}
              />
            )}
            <UserMenu user={user} />
          </div>
        </header>

        <div className="mb-6 flex flex-wrap items-center gap-3 justify-between">
          <SegmentedControl
            value={tab}
            onChange={setTab}
            layoutGroup="board-kind"
            options={[
              { id: "marketing", label: "Marketing" },
              { id: "ticketing", label: "Ticketing" },
            ]}
          />
          {tab === "ticketing" && departmentGroups.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterChip
                active={departmentFilter === "all"}
                onClick={() => setDepartmentFilter("all")}
              >
                All departments
              </FilterChip>
              {departmentGroups.map((g) => (
                <FilterChip
                  key={g.id}
                  active={departmentFilter === g.id}
                  onClick={() => setDepartmentFilter(g.id)}
                >
                  {g.name} · {g.boards.length}
                </FilterChip>
              ))}
            </div>
          )}
        </div>

        {boardsQuery.isLoading ? (
          <Panel className="p-10 text-center text-sm text-muted-foreground">Loading boards…</Panel>
        ) : tab === "marketing" ? (
          <BoardGrid
            boards={tabBoards}
            isAdmin={isAdmin}
            emptyText="No marketing boards yet. Create one to start tracking campaign work."
            onDelete={(id, name) => {
              if (confirm(`Delete "${name}"? This removes all its columns and cards.`)) {
                deleteMutation.mutate(id);
              }
            }}
          />
        ) : (
          <div className="space-y-10">
            {visibleGroups.map((group) => (
              <section key={group.id}>
                <div className="mb-4 flex items-center gap-2">
                  <Ticket className="size-4 text-muted-foreground" strokeWidth={1.5} />
                  <PanelEyebrow>
                    {group.id === UNASSIGNED ? "No department" : "Department"}
                  </PanelEyebrow>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    · {group.boards.length} board{group.boards.length === 1 ? "" : "s"}
                  </span>
                </div>
                <PanelTitle>{group.name}</PanelTitle>
                <div className="mt-4">
                  <BoardGrid
                    boards={group.boards}
                    isAdmin={isAdmin}
                    emptyText="No ticket board for this department yet."
                    onDelete={(id, name) => {
                      if (confirm(`Delete "${name}"? This removes all its columns and cards.`)) {
                        deleteMutation.mutate(id);
                      }
                    }}
                  />
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "h-7 px-2.5 rounded-sm font-mono text-[10px] uppercase tracking-wider border transition-colors " +
        (active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground hover:border-border-strong")
      }
    >
      {children}
    </button>
  );
}

function BoardGrid({
  boards,
  isAdmin,
  emptyText,
  onDelete,
}: {
  boards: BoardRow[];
  isAdmin: boolean;
  emptyText: string;
  onDelete: (id: string, name: string) => void;
}) {
  if (boards.length === 0) {
    return <Panel className="p-8 text-center text-sm text-muted-foreground">{emptyText}</Panel>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {boards.map((b) => (
        <Panel key={b.id} className="p-5 group relative">
          <Link to="/boards/$boardId" params={{ boardId: b.id }} className="block">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-sm bg-surface-2 border border-border grid place-items-center text-primary">
                {b.kind === "marketing" ? (
                  <Megaphone className="size-4" strokeWidth={1.5} />
                ) : (
                  <Trello className="size-4" strokeWidth={1.5} />
                )}
              </div>
              <div className="text-[15px] truncate">{b.name}</div>
            </div>
            {b.description && (
              <p className="mt-3 text-[13px] text-muted-foreground line-clamp-2">{b.description}</p>
            )}
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>{b.cardCount} cards</span>
              <span>
                {new Date(b.createdAt).toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </Link>
          {isAdmin && (
            <button
              onClick={(e) => {
                e.preventDefault();
                onDelete(b.id, b.name);
              }}
              className="absolute top-4 right-4 size-7 grid place-items-center rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-negative hover:border-negative/40 border border-transparent transition-all"
              aria-label={`Delete ${b.name}`}
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </Panel>
      ))}
    </div>
  );
}

function NewBoardDialog({
  open,
  onOpenChange,
  onCreate,
  pending,
  departments,
  defaultKind,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (draft: {
    name: string;
    description?: string;
    template: Template;
    kind: BoardKind;
    departmentId?: string;
  }) => void;
  pending: boolean;
  departments: { id: string; name: string }[];
  defaultKind: BoardKind;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<BoardKind>(defaultKind);
  const [departmentId, setDepartmentId] = useState<string>("");
  const [template, setTemplate] = useState<Template>(defaultKind === "ticketing" ? "it" : "basic");

  const reset = () => {
    setName("");
    setDescription("");
    setKind(defaultKind);
    setDepartmentId("");
    setTemplate(defaultKind === "ticketing" ? "it" : "basic");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      description: description.trim() || undefined,
      template,
      kind,
      departmentId: kind === "ticketing" && departmentId ? departmentId : undefined,
    });
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
        else {
          setKind(defaultKind);
          setTemplate(defaultKind === "ticketing" ? "it" : "basic");
        }
      }}
    >
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-2 h-9 px-4 text-[12px] font-mono uppercase tracking-wider bg-primary text-primary-foreground rounded-sm hover:opacity-90">
          <Plus className="size-3.5" /> New board
        </button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-tight font-normal">
            Create a board
          </DialogTitle>
          <DialogDescription>
            Pick a type and starting layout — you can add, rename, or remove columns anytime.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Board type">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: "marketing", label: "Marketing", icon: Megaphone },
                  { id: "ticketing", label: "Ticketing", icon: Ticket },
                ] as { id: BoardKind; label: string; icon: typeof Megaphone }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setKind(opt.id);
                    setTemplate(opt.id === "ticketing" ? "it" : "basic");
                    if (opt.id === "marketing") setDepartmentId("");
                  }}
                  className={
                    "h-9 inline-flex items-center justify-center gap-1.5 rounded-sm border text-[11px] font-mono uppercase tracking-wider transition-colors " +
                    (kind === opt.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-border-strong")
                  }
                >
                  <opt.icon className="size-3.5" strokeWidth={1.5} />
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
          {kind === "ticketing" && (
            <Field label="Department (optional)">
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className={fieldClass}
              >
                <option value="">No department (general)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Each department can have its own ticket board, or leave this general.
              </p>
            </Field>
          )}
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind === "ticketing" ? "e.g. Facilities Tickets" : "e.g. Spring Promo"}
              className={fieldClass}
              required
              autoFocus
            />
          </Field>
          <Field label="Description (optional)">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this board is for"
              className={fieldClass}
            />
          </Field>
          <Field label="Starting columns">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "it", label: "IT Tickets" },
                  { id: "basic", label: "Basic" },
                  { id: "blank", label: "Blank" },
                ] as { id: Template; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTemplate(opt.id)}
                  className={
                    "h-9 rounded-sm border text-[11px] font-mono uppercase tracking-wider transition-colors " +
                    (template === opt.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-border-strong")
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {template === "it"
                ? "Backlog, To Do, In Progress, Blocked, Done"
                : template === "basic"
                  ? "To Do, In Progress, Done"
                  : "No columns — add your own"}
            </p>
          </Field>
          <DialogFooter>
            <button
              type="submit"
              disabled={pending}
              className="h-9 px-4 text-[12px] font-mono uppercase tracking-wider bg-primary text-primary-foreground rounded-sm hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Creating…" : "Create board"}
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
