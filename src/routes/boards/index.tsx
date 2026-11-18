import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { z } from "zod";
import { Check, Plus, Trash2, Trello, X } from "lucide-react";
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
import {
  createBoardFn,
  createDepartmentFn,
  deleteBoardFn,
  listBoardsFn,
  listDepartmentsFn,
} from "@/lib/tickets";

const searchSchema = z.object({
  tab: z.string().optional(),
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
        content: "Trello-style boards for each department's work.",
      },
    ],
  }),
  component: BoardsIndexPage,
});

type Template = "it" | "basic" | "blank";

interface BoardRow {
  id: string;
  name: string;
  description: string | null;
  departmentId: string | null;
  departmentName: string | null;
  cardCount: number;
  createdAt: string | Date;
}

const GENERAL = "__general__";

function BoardsIndexPage() {
  const { user } = Route.useRouteContext();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const isAdmin = user.role === "admin";
  const queryClient = useQueryClient();
  const listBoards = useServerFn(listBoardsFn);
  const listDepartments = useServerFn(listDepartmentsFn);
  const createBoard = useServerFn(createBoardFn);
  const createDepartment = useServerFn(createDepartmentFn);
  const deleteBoard = useServerFn(deleteBoardFn);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const createDepartmentMutation = useMutation({
    mutationFn: (name: string) => createDepartment({ data: { name } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["departments"] }),
  });

  const boards: BoardRow[] = useMemo(() => boardsQuery.data ?? [], [boardsQuery.data]);
  const departments = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data]);

  const tabs = useMemo(
    () => [
      ...departments.map((d) => ({ id: d.id, label: d.name })),
      { id: GENERAL, label: "General" },
    ],
    [departments],
  );

  const activeTab = tab && tabs.some((t) => t.id === tab) ? tab : (tabs[0]?.id ?? GENERAL);

  const tabBoards = useMemo(
    () =>
      boards.filter((b) =>
        activeTab === GENERAL ? !b.departmentId : b.departmentId === activeTab,
      ),
    [boards, activeTab],
  );

  const setTab = (next: string) => navigate({ search: { tab: next } });

  const activeDepartmentId = activeTab === GENERAL ? undefined : activeTab;

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
              Every department gets its own board — columns, cards, and a shared view everyone works
              from.
            </p>
          </div>

          <div className="flex items-center gap-4">
            {isAdmin && (
              <NewBoardDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                pending={createMutation.isPending}
                departments={departments}
                defaultDepartmentId={activeDepartmentId}
                onCreate={(draft) => createMutation.mutate(draft)}
                onCreateDepartment={(name) => createDepartmentMutation.mutateAsync(name)}
                creatingDepartment={createDepartmentMutation.isPending}
              />
            )}
            <UserMenu user={user} />
          </div>
        </header>

        {tabs.length > 1 && (
          <div className="mb-6">
            <SegmentedControl
              value={activeTab}
              onChange={setTab}
              layoutGroup="board-department"
              wrap
              options={tabs}
            />
          </div>
        )}

        {boardsQuery.isLoading ? (
          <Panel className="p-10 text-center text-sm text-muted-foreground">Loading boards…</Panel>
        ) : (
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Trello className="size-4 text-muted-foreground" strokeWidth={1.5} />
              <PanelEyebrow>{activeTab === GENERAL ? "No department" : "Department"}</PanelEyebrow>
              <span className="font-mono text-[10px] text-muted-foreground">
                · {tabBoards.length} board{tabBoards.length === 1 ? "" : "s"}
              </span>
            </div>
            <PanelTitle>{tabs.find((t) => t.id === activeTab)?.label ?? "General"}</PanelTitle>
            <div className="mt-4">
              <BoardGrid
                boards={tabBoards}
                isAdmin={isAdmin}
                emptyText="No board for this department yet."
                onDelete={(id, name) => {
                  if (confirm(`Delete "${name}"? This removes all its columns and cards.`)) {
                    deleteMutation.mutate(id);
                  }
                }}
              />
            </div>
          </section>
        )}
      </div>
    </div>
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
                <Trello className="size-4" strokeWidth={1.5} />
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

const NEW_DEPARTMENT = "__new__";

function NewBoardDialog({
  open,
  onOpenChange,
  onCreate,
  pending,
  departments,
  defaultDepartmentId,
  onCreateDepartment,
  creatingDepartment,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (draft: {
    name: string;
    description?: string;
    template: Template;
    departmentId?: string;
  }) => void;
  pending: boolean;
  departments: { id: string; name: string }[];
  defaultDepartmentId?: string;
  onCreateDepartment: (name: string) => Promise<{ id: string; name: string }>;
  creatingDepartment: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState<string>(defaultDepartmentId ?? "");
  const [template, setTemplate] = useState<Template>("basic");
  const [newDeptMode, setNewDeptMode] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");

  const reset = () => {
    setName("");
    setDescription("");
    setDepartmentId(defaultDepartmentId ?? "");
    setTemplate("basic");
    setNewDeptMode(false);
    setNewDeptName("");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      description: description.trim() || undefined,
      template,
      departmentId: departmentId || undefined,
    });
    reset();
  };

  const submitNewDepartment = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newDeptName.trim();
    if (!trimmed) return;
    const created = await onCreateDepartment(trimmed);
    setDepartmentId(created.id);
    setNewDeptMode(false);
    setNewDeptName("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
        else setDepartmentId(defaultDepartmentId ?? "");
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
            Choose a department and starting layout — you can add, rename, or remove columns
            anytime.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Department">
            {newDeptMode ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="e.g. Merchandising"
                  className={fieldClass}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitNewDepartment(e);
                    }
                    if (e.key === "Escape") {
                      setNewDeptMode(false);
                      setNewDeptName("");
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={creatingDepartment || !newDeptName.trim()}
                  onClick={submitNewDepartment}
                  className="size-9 shrink-0 grid place-items-center rounded-sm bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  aria-label="Create department"
                >
                  <Check className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewDeptMode(false);
                    setNewDeptName("");
                  }}
                  className="size-9 shrink-0 grid place-items-center rounded-sm text-muted-foreground hover:text-foreground"
                  aria-label="Cancel"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <select
                value={departmentId}
                onChange={(e) => {
                  if (e.target.value === NEW_DEPARTMENT) {
                    setNewDeptMode(true);
                    setNewDeptName("");
                  } else {
                    setDepartmentId(e.target.value);
                  }
                }}
                className={fieldClass}
              >
                <option value="">No department (general)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
                <option value={NEW_DEPARTMENT}>+ Create new department…</option>
              </select>
            )}
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Marketing, IT, Merchandising — each department gets its own tab and board, or leave
              this general.
            </p>
          </Field>
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Facilities Tickets"
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
