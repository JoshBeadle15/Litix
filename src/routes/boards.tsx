import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Plus, Trash2, Trello } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Panel, PanelEyebrow, PanelTitle, Topbar } from "@/components/dashboard-ui";
import { createBoardFn, deleteBoardFn, listBoardsFn } from "@/lib/tickets";

export const Route = createFileRoute("/boards")({
  head: () => ({
    meta: [
      { title: "Boards — MSU Bookstore Analytics" },
      {
        name: "description",
        content: "Trello-style boards for IT tickets and cross-team task organization.",
      },
    ],
  }),
  component: BoardsIndexPage,
});

type Template = "it" | "basic" | "blank";

function BoardsIndexPage() {
  const queryClient = useQueryClient();
  const listBoards = useServerFn(listBoardsFn);
  const createBoard = useServerFn(createBoardFn);
  const deleteBoard = useServerFn(deleteBoardFn);
  const [dialogOpen, setDialogOpen] = useState(false);

  const boardsQuery = useQuery({ queryKey: ["boards"], queryFn: () => listBoards() });

  const createMutation = useMutation({
    mutationFn: (input: { name: string; description?: string; template: Template }) =>
      createBoard({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      setDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (boardId: string) => deleteBoard({ data: { boardId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["boards"] }),
  });

  const boards = boardsQuery.data ?? [];

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
              Boards for IT tickets and team task tracking — columns, cards, and a shared view
              everyone works from.
            </p>
          </div>

          <NewBoardDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            pending={createMutation.isPending}
            onCreate={(draft) => createMutation.mutate(draft)}
          />
        </header>

        {boardsQuery.isLoading ? (
          <Panel className="p-10 text-center text-sm text-muted-foreground">Loading boards…</Panel>
        ) : boards.length === 0 ? (
          <Panel className="p-10 text-center text-sm text-muted-foreground">
            No boards yet. Create one to start tracking work.
          </Panel>
        ) : (
          <section>
            <div className="mb-4">
              <PanelEyebrow>All boards</PanelEyebrow>
              <PanelTitle>{boards.length} active</PanelTitle>
            </div>
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
                      <p className="mt-3 text-[13px] text-muted-foreground line-clamp-2">
                        {b.description}
                      </p>
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
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      if (confirm(`Delete "${b.name}"? This removes all its columns and cards.`)) {
                        deleteMutation.mutate(b.id);
                      }
                    }}
                    className="absolute top-4 right-4 size-7 grid place-items-center rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-negative hover:border-negative/40 border border-transparent transition-all"
                    aria-label={`Delete ${b.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </Panel>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function NewBoardDialog({
  open,
  onOpenChange,
  onCreate,
  pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (draft: { name: string; description?: string; template: Template }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState<Template>("basic");

  const reset = () => {
    setName("");
    setDescription("");
    setTemplate("basic");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({ name: name.trim(), description: description.trim() || undefined, template });
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
          <Plus className="size-3.5" /> New board
        </button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-tight font-normal">
            Create a board
          </DialogTitle>
          <DialogDescription>
            Pick a starting layout — you can add, rename, or remove columns anytime.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Facilities Requests"
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
