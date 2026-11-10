import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, MoreHorizontal, Plus, Send, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Topbar } from "@/components/dashboard-ui";
import { Avatar, PriorityBadge } from "@/components/board-ui";
import { UserMenu } from "@/components/user-menu";
import { PRIORITIES, PRIORITY_META, dueMeta, type Priority } from "@/lib/board-constants";
import { getCurrentUserFn } from "@/lib/auth";
import {
  addCommentFn,
  createCardFn,
  createColumnFn,
  deleteCardFn,
  deleteColumnFn,
  getBoardFn,
  getCardActivityFn,
  listEmployeesFn,
  moveCardFn,
  renameColumnFn,
  updateCardFn,
} from "@/lib/tickets";

export const Route = createFileRoute("/boards/$boardId")({
  beforeLoad: async () => {
    const user = await getCurrentUserFn();
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  head: () => ({
    meta: [{ title: "Board — MSU Bookstore Analytics" }],
  }),
  component: BoardDetailPage,
});

interface BoardCard {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string | null;
  priority: Priority;
  dueDate: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeColor: string | null;
}
interface BoardColumn {
  id: string;
  boardId: string;
  name: string;
  position: number;
}
interface Employee {
  id: string;
  name: string;
  title: string | null;
  color: string;
}
interface BoardDetail {
  board: { id: string; name: string; description: string | null };
  columns: BoardColumn[];
  cards: BoardCard[];
}

type DropTarget = { columnId: string; index: number };

const EMPTY_COLUMNS: BoardColumn[] = [];
const EMPTY_CARDS: BoardCard[] = [];

function BoardDetailPage() {
  const { boardId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const isAdmin = user.role === "admin";
  const queryClient = useQueryClient();

  const getBoard = useServerFn(getBoardFn);
  const listEmployees = useServerFn(listEmployeesFn);
  const createColumn = useServerFn(createColumnFn);
  const renameColumn = useServerFn(renameColumnFn);
  const deleteColumn = useServerFn(deleteColumnFn);
  const createCard = useServerFn(createCardFn);
  const moveCard = useServerFn(moveCardFn);

  const boardQuery = useQuery({
    queryKey: ["board", boardId],
    queryFn: () => getBoard({ data: { boardId } }),
    refetchInterval: 15000,
  });
  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees() });

  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [addCardColumnId, setAddCardColumnId] = useState<string | null>(null);
  const [addColumnOpen, setAddColumnOpen] = useState(false);

  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const invalidateBoard = () => queryClient.invalidateQueries({ queryKey: ["board", boardId] });

  const createColumnMutation = useMutation({
    mutationFn: (name: string) => createColumn({ data: { boardId, name } }),
    onSuccess: () => {
      invalidateBoard();
      setAddColumnOpen(false);
    },
  });
  const renameColumnMutation = useMutation({
    mutationFn: (input: { columnId: string; name: string }) => renameColumn({ data: input }),
    onSuccess: invalidateBoard,
  });
  const deleteColumnMutation = useMutation({
    mutationFn: (columnId: string) => deleteColumn({ data: { columnId } }),
    onSuccess: invalidateBoard,
  });
  const createCardMutation = useMutation({
    mutationFn: (input: { columnId: string; title: string }) =>
      createCard({ data: { boardId, columnId: input.columnId, title: input.title } }),
    onSuccess: () => {
      invalidateBoard();
      setAddCardColumnId(null);
    },
  });
  const moveCardMutation = useMutation({
    mutationFn: (input: { cardId: string; toColumnId: string; orderedCardIds: string[] }) =>
      moveCard({ data: input }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["board", boardId] });
      const prev = queryClient.getQueryData<BoardDetail>(["board", boardId]);
      if (prev) {
        const positionMap = new Map(input.orderedCardIds.map((id, i) => [id, i]));
        const nextCards = prev.cards.map((c) => {
          if (c.id === input.cardId) {
            return {
              ...c,
              columnId: input.toColumnId,
              position: positionMap.get(c.id) ?? c.position,
            };
          }
          if (positionMap.has(c.id)) {
            return { ...c, position: positionMap.get(c.id)! };
          }
          return c;
        });
        queryClient.setQueryData(["board", boardId], { ...prev, cards: nextCards });
      }
      return { prev };
    },
    onError: (_err, _input, context) => {
      if (context?.prev) queryClient.setQueryData(["board", boardId], context.prev);
    },
    onSettled: invalidateBoard,
  });

  const columns = useMemo(() => boardQuery.data?.columns ?? EMPTY_COLUMNS, [boardQuery.data]);
  const allCards = useMemo(() => boardQuery.data?.cards ?? EMPTY_CARDS, [boardQuery.data]);
  const employees = employeesQuery.data ?? [];

  const cardsByColumn = useMemo(() => {
    const map = new Map<string, BoardCard[]>();
    for (const col of columns) map.set(col.id, []);
    for (const c of allCards) {
      const arr = map.get(c.columnId);
      if (arr) arr.push(c);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.position - b.position);
    return map;
  }, [columns, allCards]);

  function handleDrop(columnId: string) {
    if (!draggingCardId || !dropTarget || dropTarget.columnId !== columnId) {
      setDraggingCardId(null);
      setDropTarget(null);
      return;
    }
    const withDragged = cardsByColumn.get(columnId) ?? [];
    const originalIndex = withDragged.findIndex((c) => c.id === draggingCardId);
    let insertIndex = dropTarget.index;
    if (originalIndex !== -1 && originalIndex < insertIndex) insertIndex -= 1;

    const destIds = withDragged.filter((c) => c.id !== draggingCardId).map((c) => c.id);
    insertIndex = Math.min(Math.max(insertIndex, 0), destIds.length);
    destIds.splice(insertIndex, 0, draggingCardId);

    moveCardMutation.mutate({
      cardId: draggingCardId,
      toColumnId: columnId,
      orderedCardIds: destIds,
    });
    setDraggingCardId(null);
    setDropTarget(null);
  }

  const activeCard = allCards.find((c) => c.id === activeCardId) ?? null;

  if (boardQuery.isError) {
    return (
      <div>
        <Topbar active="Boards" />
        <div className="px-8 py-16 text-center text-sm text-muted-foreground">
          Board not found.{" "}
          <Link to="/boards" className="text-primary underline">
            Back to boards
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-screen">
      <Topbar active="Boards" />

      <div className="px-8 pt-6 pb-4 border-b border-border flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/boards"
            className="size-8 grid place-items-center rounded-sm border border-border text-muted-foreground hover:text-foreground hover:border-border-strong shrink-0"
          >
            <ArrowLeft className="size-3.5" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-display text-2xl tracking-tight truncate">
              {boardQuery.data?.board.name ?? "Loading…"}
            </h1>
            {boardQuery.data?.board.description && (
              <p className="text-xs text-muted-foreground truncate">
                {boardQuery.data.board.description}
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0">
          <UserMenu user={user} />
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden px-8 py-5">
        {boardQuery.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading board…</div>
        ) : (
          <div className="flex gap-4 h-full items-start">
            {columns.map((col) => (
              <Column
                key={col.id}
                column={col}
                cards={cardsByColumn.get(col.id) ?? []}
                isAdmin={isAdmin}
                draggingCardId={draggingCardId}
                dropTarget={dropTarget}
                onDragOverCard={(index) => setDropTarget({ columnId: col.id, index })}
                onDragOverEnd={() =>
                  setDropTarget((prev) =>
                    prev?.columnId === col.id &&
                    prev.index === (cardsByColumn.get(col.id)?.length ?? 0)
                      ? prev
                      : { columnId: col.id, index: cardsByColumn.get(col.id)?.length ?? 0 },
                  )
                }
                onDrop={() => handleDrop(col.id)}
                onDragStartCard={setDraggingCardId}
                onDragEndCard={() => {
                  setDraggingCardId(null);
                  setDropTarget(null);
                }}
                onOpenCard={setActiveCardId}
                onRename={(name) => renameColumnMutation.mutate({ columnId: col.id, name })}
                onDelete={() => {
                  const count = cardsByColumn.get(col.id)?.length ?? 0;
                  const msg =
                    count > 0
                      ? `Delete "${col.name}"? This removes ${count} card${count === 1 ? "" : "s"} in it.`
                      : `Delete "${col.name}"?`;
                  if (confirm(msg)) deleteColumnMutation.mutate(col.id);
                }}
                addCardOpen={addCardColumnId === col.id}
                onOpenAddCard={() => setAddCardColumnId(col.id)}
                onCloseAddCard={() => setAddCardColumnId(null)}
                onSubmitAddCard={(title) => createCardMutation.mutate({ columnId: col.id, title })}
                addCardPending={createCardMutation.isPending}
              />
            ))}

            {isAdmin && (
              <AddColumn
                open={addColumnOpen}
                onOpen={() => setAddColumnOpen(true)}
                onClose={() => setAddColumnOpen(false)}
                onSubmit={(name) => createColumnMutation.mutate(name)}
                pending={createColumnMutation.isPending}
              />
            )}
          </div>
        )}
      </div>

      {activeCard && (
        <CardDetailDialog
          card={activeCard}
          employees={employees}
          boardId={boardId}
          onClose={() => setActiveCardId(null)}
        />
      )}
    </div>
  );
}

function Column({
  column,
  cards,
  isAdmin,
  draggingCardId,
  dropTarget,
  onDragOverCard,
  onDragOverEnd,
  onDrop,
  onDragStartCard,
  onDragEndCard,
  onOpenCard,
  onRename,
  onDelete,
  addCardOpen,
  onOpenAddCard,
  onCloseAddCard,
  onSubmitAddCard,
  addCardPending,
}: {
  column: BoardColumn;
  cards: BoardCard[];
  isAdmin: boolean;
  draggingCardId: string | null;
  dropTarget: DropTarget | null;
  onDragOverCard: (index: number) => void;
  onDragOverEnd: () => void;
  onDrop: () => void;
  onDragStartCard: (id: string) => void;
  onDragEndCard: () => void;
  onOpenCard: (id: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  addCardOpen: boolean;
  onOpenAddCard: () => void;
  onCloseAddCard: () => void;
  onSubmitAddCard: (title: string) => void;
  addCardPending: boolean;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(column.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const [title, setTitle] = useState("");
  const addInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (addCardOpen) addInputRef.current?.focus();
  }, [addCardOpen]);

  const showIndicatorAt = (index: number) =>
    draggingCardId && dropTarget?.columnId === column.id && dropTarget.index === index;

  const submitName = () => {
    setEditingName(false);
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== column.name) onRename(trimmed);
    else setNameDraft(column.name);
  };

  const submitAddCard = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmitAddCard(title.trim());
    setTitle("");
  };

  return (
    <div
      className="w-[300px] shrink-0 flex flex-col max-h-full bg-surface border border-border rounded-md"
      onDragOver={(e) => {
        if (!draggingCardId) return;
        e.preventDefault();
        onDragOverEnd();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      <div className="px-3 pt-3 pb-2 flex items-center gap-2">
        {editingName && isAdmin ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={submitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitName();
              if (e.key === "Escape") {
                setNameDraft(column.name);
                setEditingName(false);
              }
            }}
            className="flex-1 bg-card border border-border-strong rounded-sm px-2 h-7 text-[13px] focus:outline-none"
          />
        ) : isAdmin ? (
          <button
            onClick={() => setEditingName(true)}
            className="flex-1 text-left text-[13px] font-medium truncate hover:text-primary"
          >
            {column.name}
          </button>
        ) : (
          <span className="flex-1 text-[13px] font-medium truncate">{column.name}</span>
        )}
        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
          {cards.length}
        </span>
        {isAdmin && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="size-6 grid place-items-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-surface-2"
            >
              <MoreHorizontal className="size-3.5" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-7 z-10 w-36 bg-popover border border-border-strong rounded-sm shadow-lg py-1"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="w-full text-left px-3 py-1.5 text-[12px] text-negative hover:bg-surface-2 flex items-center gap-2"
                >
                  <Trash2 className="size-3" /> Delete column
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-[60px]">
        {showIndicatorAt(0) && <DropIndicator />}
        {cards.map((card, i) => (
          <div key={card.id}>
            <Card
              card={card}
              onOpen={() => onOpenCard(card.id)}
              onDragStart={() => onDragStartCard(card.id)}
              onDragEnd={onDragEndCard}
              onDragOver={(e) => {
                if (!draggingCardId) return;
                e.preventDefault();
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const before = e.clientY < rect.top + rect.height / 2;
                onDragOverCard(before ? i : i + 1);
              }}
              dimmed={draggingCardId === card.id}
            />
            {showIndicatorAt(i + 1) && <DropIndicator />}
          </div>
        ))}
      </div>

      <div className="px-2 pb-2">
        {addCardOpen ? (
          <form onSubmit={submitAddCard} className="space-y-1.5">
            <textarea
              ref={addInputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitAddCard(e);
                }
                if (e.key === "Escape") onCloseAddCard();
              }}
              placeholder="Ticket title…"
              rows={2}
              className="w-full bg-card border border-border-strong rounded-sm px-2.5 py-2 text-[13px] resize-none focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={addCardPending}
                className="h-7 px-3 text-[11px] font-mono uppercase tracking-wider bg-primary text-primary-foreground rounded-sm hover:opacity-90 disabled:opacity-50"
              >
                Add
              </button>
              <button
                type="button"
                onClick={onCloseAddCard}
                className="size-7 grid place-items-center rounded-sm text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={onOpenAddCard}
            className="w-full flex items-center gap-1.5 px-2.5 py-2 text-[12px] text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded-sm"
          >
            <Plus className="size-3.5" /> Add a card
          </button>
        )}
      </div>
    </div>
  );
}

function DropIndicator() {
  return <div className="h-0.5 my-1 rounded-full bg-primary" />;
}

function Card({
  card,
  onOpen,
  onDragStart,
  onDragEnd,
  onDragOver,
  dimmed,
}: {
  card: BoardCard;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  dimmed: boolean;
}) {
  const due = dueMeta(card.dueDate);
  return (
    <button
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onClick={onOpen}
      className={
        "w-full text-left mb-2 p-3 bg-card border border-border rounded-sm shadow-[var(--shadow-panel)] hover:border-border-strong cursor-grab active:cursor-grabbing transition-opacity " +
        (dimmed ? "opacity-30" : "")
      }
    >
      <div className="text-[13px] leading-snug">{card.title}</div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <PriorityBadge priority={card.priority} />
        <Avatar name={card.assigneeName} color={card.assigneeColor} size="xs" />
      </div>
      {due && (
        <div
          className={
            "mt-2 inline-flex font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border " +
            (due.overdue
              ? "border-negative/40 text-negative"
              : due.dueSoon
                ? "border-accent/40 text-accent"
                : "border-border text-muted-foreground")
          }
        >
          Due {due.label}
        </div>
      )}
    </button>
  );
}

function AddColumn({
  open,
  onOpen,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSubmit: (name: string) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim());
    setName("");
  };
  if (!open) {
    return (
      <button
        onClick={onOpen}
        className="w-[260px] shrink-0 h-10 flex items-center gap-1.5 px-3 text-[12px] text-muted-foreground border border-dashed border-border rounded-md hover:text-foreground hover:border-border-strong"
      >
        <Plus className="size-3.5" /> Add column
      </button>
    );
  }
  return (
    <form
      onSubmit={submit}
      className="w-[260px] shrink-0 bg-surface border border-border rounded-md p-2 space-y-1.5"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        placeholder="Column name…"
        className="w-full bg-card border border-border-strong rounded-sm px-2.5 h-8 text-[13px] focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-7 px-3 text-[11px] font-mono uppercase tracking-wider bg-primary text-primary-foreground rounded-sm hover:opacity-90 disabled:opacity-50"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onClose}
          className="size-7 grid place-items-center rounded-sm text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </form>
  );
}

function CardDetailDialog({
  card,
  employees,
  boardId,
  onClose,
}: {
  card: BoardCard;
  employees: Employee[];
  boardId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const updateCard = useServerFn(updateCardFn);
  const deleteCard = useServerFn(deleteCardFn);
  const addComment = useServerFn(addCommentFn);
  const getCardActivity = useServerFn(getCardActivityFn);

  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [comment, setComment] = useState("");

  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description ?? "");
  }, [card.id, card.title, card.description]);

  const invalidateBoard = () => queryClient.invalidateQueries({ queryKey: ["board", boardId] });
  const invalidateActivity = () =>
    queryClient.invalidateQueries({ queryKey: ["card-activity", card.id] });

  const updateMutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      updateCard({ data: { cardId: card.id, ...patch } }),
    onSuccess: () => {
      invalidateBoard();
      invalidateActivity();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteCard({ data: { cardId: card.id } }),
    onSuccess: () => {
      invalidateBoard();
      onClose();
    },
  });
  const commentMutation = useMutation({
    mutationFn: (message: string) => addComment({ data: { cardId: card.id, message } }),
    onSuccess: () => {
      setComment("");
      invalidateActivity();
    },
  });

  const activityQuery = useQuery({
    queryKey: ["card-activity", card.id],
    queryFn: () => getCardActivity({ data: { cardId: card.id } }),
  });

  const submitComment = (e: FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    commentMutation.mutate(comment.trim());
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title.trim() !== card.title) {
                updateMutation.mutate({ title: title.trim() });
              } else {
                setTitle(card.title);
              }
            }}
            className="font-display text-xl tracking-tight bg-transparent focus:outline-none focus:bg-surface rounded-sm px-1 -mx-1 w-full"
          />
          <DialogTitle className="sr-only">Edit ticket</DialogTitle>
          <DialogDescription className="sr-only">
            Edit ticket details, assignee, priority, due date, and activity.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FieldBlock label="Assignee">
            <select
              value={card.assigneeId ?? ""}
              onChange={(e) => updateMutation.mutate({ assigneeId: e.target.value || null })}
              className={fieldClass}
            >
              <option value="">Unassigned</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </FieldBlock>
          <FieldBlock label="Priority">
            <select
              value={card.priority}
              onChange={(e) => updateMutation.mutate({ priority: e.target.value as Priority })}
              className={fieldClass}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_META[p].label}
                </option>
              ))}
            </select>
          </FieldBlock>
          <FieldBlock label="Due date">
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={card.dueDate ?? ""}
                onChange={(e) => updateMutation.mutate({ dueDate: e.target.value || null })}
                className={fieldClass}
              />
            </div>
          </FieldBlock>
        </div>

        <FieldBlock label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              const next = description.trim() || null;
              if (next !== (card.description ?? null)) {
                updateMutation.mutate({ description: next });
              }
            }}
            rows={4}
            placeholder="Add more detail…"
            className="w-full bg-surface border border-border rounded-sm px-3 py-2 text-[13px] resize-none focus:outline-none focus:border-border-strong"
          />
        </FieldBlock>

        <div className="pt-2 border-t border-border">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
            Activity
          </div>
          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {activityQuery.data?.length === 0 && (
              <div className="text-[12px] text-muted-foreground">No activity yet.</div>
            )}
            {activityQuery.data?.map((a) => (
              <div key={a.id} className="flex items-start gap-2.5">
                {a.type === "comment" ? (
                  <Avatar name={a.employeeName} color={a.employeeColor} size="xs" />
                ) : (
                  <span className="size-5 grid place-items-center text-muted-foreground shrink-0">
                    ·
                  </span>
                )}
                <div className="min-w-0">
                  <div className="text-[12px]">
                    {a.type === "system" ? (
                      <span className="text-muted-foreground">{a.message}</span>
                    ) : (
                      <>
                        <span className="font-medium">{a.employeeName ?? "Someone"}</span>{" "}
                        {a.message}
                      </>
                    )}
                  </div>
                  <div className="font-mono text-[9px] text-muted-foreground mt-0.5">
                    {new Date(a.createdAt).toLocaleString("en", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={submitComment} className="mt-3 flex items-center gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment…"
              className="flex-1 bg-surface border border-border rounded-sm px-3 h-9 text-[13px] focus:outline-none focus:border-border-strong"
            />
            <button
              type="submit"
              disabled={commentMutation.isPending}
              className="size-9 grid place-items-center rounded-sm bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Send className="size-3.5" />
            </button>
          </form>
        </div>

        <div className="pt-2 border-t border-border flex justify-end">
          <button
            onClick={() => {
              if (confirm(`Delete "${card.title}"? This can't be undone.`)) deleteMutation.mutate();
            }}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wider text-negative border border-negative/30 rounded-sm hover:bg-negative hover:text-white"
          >
            <Trash2 className="size-3.5" /> Delete ticket
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const fieldClass =
  "w-full bg-surface border border-border rounded-sm px-3 h-9 text-[13px] placeholder:text-muted-foreground/70 focus:outline-none focus:border-border-strong";

function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
