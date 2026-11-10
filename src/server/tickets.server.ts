import { asc, eq, sql } from "drizzle-orm";
import { db } from "./db/client";
import { boardColumns, boards, cardActivity, cards, departments, employees } from "./db/schema";

export type Priority = "low" | "medium" | "high" | "urgent";

const TEMPLATE_COLUMNS: Record<"it" | "basic" | "blank", string[]> = {
  it: ["Backlog", "To Do", "In Progress", "Blocked", "Done"],
  basic: ["To Do", "In Progress", "Done"],
  blank: [],
};

export async function listBoards() {
  const rows = await db.select().from(boards).orderBy(asc(boards.createdAt));
  const counts = await db
    .select({ boardId: cards.boardId, count: sql<number>`count(*)`.mapWith(Number) })
    .from(cards)
    .groupBy(cards.boardId);
  const countMap = new Map(counts.map((c) => [c.boardId, c.count]));
  return rows.map((b) => ({ ...b, cardCount: countMap.get(b.id) ?? 0 }));
}

export async function createBoard(input: {
  name: string;
  description?: string;
  template: "it" | "basic" | "blank";
}) {
  const [board] = await db
    .insert(boards)
    .values({ name: input.name, description: input.description })
    .returning();

  const columnNames = TEMPLATE_COLUMNS[input.template];
  if (columnNames.length) {
    await db
      .insert(boardColumns)
      .values(columnNames.map((name, i) => ({ boardId: board.id, name, position: i })));
  }
  return board;
}

export async function deleteBoard(boardId: string) {
  await db.delete(boards).where(eq(boards.id, boardId));
}

export async function getBoardDetail(boardId: string) {
  const [board] = await db.select().from(boards).where(eq(boards.id, boardId));
  if (!board) return null;

  const columns = await db
    .select()
    .from(boardColumns)
    .where(eq(boardColumns.boardId, boardId))
    .orderBy(asc(boardColumns.position));

  const boardCards = await db
    .select({
      id: cards.id,
      boardId: cards.boardId,
      columnId: cards.columnId,
      title: cards.title,
      description: cards.description,
      priority: cards.priority,
      dueDate: cards.dueDate,
      position: cards.position,
      createdAt: cards.createdAt,
      updatedAt: cards.updatedAt,
      assigneeId: cards.assigneeId,
      assigneeName: employees.name,
      assigneeColor: employees.color,
    })
    .from(cards)
    .leftJoin(employees, eq(cards.assigneeId, employees.id))
    .where(eq(cards.boardId, boardId))
    .orderBy(asc(cards.position));

  return { board, columns, cards: boardCards };
}

const EMPLOYEE_PUBLIC_COLUMNS = {
  id: employees.id,
  name: employees.name,
  email: employees.email,
  title: employees.title,
  color: employees.color,
  role: employees.role,
  departmentId: employees.departmentId,
  createdAt: employees.createdAt,
};

export async function listEmployees() {
  return db
    .select({ ...EMPLOYEE_PUBLIC_COLUMNS, departmentName: departments.name })
    .from(employees)
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .orderBy(asc(employees.name));
}

export async function listDepartments() {
  return db.select().from(departments).orderBy(asc(departments.name));
}

export async function createDepartment(name: string) {
  const [row] = await db.insert(departments).values({ name }).returning();
  return row;
}

export async function renameDepartment(id: string, name: string) {
  const [row] = await db
    .update(departments)
    .set({ name })
    .where(eq(departments.id, id))
    .returning();
  return row;
}

export async function deleteDepartment(id: string) {
  await db.delete(departments).where(eq(departments.id, id));
}

export async function getEmployeeByEmail(email: string) {
  const [row] = await db.select().from(employees).where(eq(employees.email, email));
  return row ?? null;
}

export async function getEmployeeById(id: string) {
  const [row] = await db.select().from(employees).where(eq(employees.id, id));
  return row ?? null;
}

export async function createColumn(boardId: string, name: string) {
  const existing = await db
    .select({ position: boardColumns.position })
    .from(boardColumns)
    .where(eq(boardColumns.boardId, boardId));
  const nextPos = existing.length ? Math.max(...existing.map((e) => e.position)) + 1 : 0;
  const [col] = await db
    .insert(boardColumns)
    .values({ boardId, name, position: nextPos })
    .returning();
  return col;
}

export async function renameColumn(columnId: string, name: string) {
  const [col] = await db
    .update(boardColumns)
    .set({ name })
    .where(eq(boardColumns.id, columnId))
    .returning();
  return col;
}

export async function deleteColumn(columnId: string) {
  await db.delete(boardColumns).where(eq(boardColumns.id, columnId));
}

export async function reorderColumns(orderedColumnIds: string[]) {
  await Promise.all(
    orderedColumnIds.map((id, i) =>
      db.update(boardColumns).set({ position: i }).where(eq(boardColumns.id, id)),
    ),
  );
}

export async function createCard(input: {
  boardId: string;
  columnId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  priority?: Priority;
  dueDate?: string;
}) {
  const existing = await db
    .select({ position: cards.position })
    .from(cards)
    .where(eq(cards.columnId, input.columnId));
  const nextPos = existing.length ? Math.max(...existing.map((e) => e.position)) + 1 : 0;

  const [card] = await db
    .insert(cards)
    .values({
      boardId: input.boardId,
      columnId: input.columnId,
      title: input.title,
      description: input.description,
      assigneeId: input.assigneeId,
      priority: input.priority ?? "medium",
      dueDate: input.dueDate,
      position: nextPos,
    })
    .returning();

  await db
    .insert(cardActivity)
    .values({ cardId: card.id, type: "system", message: "Ticket created" });
  return card;
}

export async function updateCard(input: {
  cardId: string;
  title?: string;
  description?: string | null;
  assigneeId?: string | null;
  priority?: Priority;
  dueDate?: string | null;
}) {
  const [existing] = await db.select().from(cards).where(eq(cards.id, input.cardId));
  if (!existing) throw new Error("Card not found");

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.assigneeId !== undefined) patch.assigneeId = input.assigneeId;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.dueDate !== undefined) patch.dueDate = input.dueDate;

  const [updated] = await db.update(cards).set(patch).where(eq(cards.id, input.cardId)).returning();

  const events: string[] = [];
  if (input.assigneeId !== undefined && input.assigneeId !== existing.assigneeId) {
    if (input.assigneeId) {
      const [emp] = await db.select().from(employees).where(eq(employees.id, input.assigneeId));
      events.push(`Assigned to ${emp?.name ?? "someone"}`);
    } else {
      events.push("Unassigned");
    }
  }
  if (input.priority !== undefined && input.priority !== existing.priority) {
    events.push(`Priority changed to ${input.priority}`);
  }
  if (input.dueDate !== undefined && input.dueDate !== existing.dueDate) {
    events.push(input.dueDate ? `Due date set to ${input.dueDate}` : "Due date removed");
  }
  if (events.length) {
    await db
      .insert(cardActivity)
      .values(
        events.map((message) => ({ cardId: input.cardId, type: "system" as const, message })),
      );
  }

  return updated;
}

export async function moveCard(input: {
  cardId: string;
  toColumnId: string;
  orderedCardIds: string[];
}) {
  const [existing] = await db.select().from(cards).where(eq(cards.id, input.cardId));
  const columnChanged = !!existing && existing.columnId !== input.toColumnId;

  await Promise.all(
    input.orderedCardIds.map((id, i) =>
      db
        .update(cards)
        .set({ columnId: input.toColumnId, position: i, updatedAt: new Date() })
        .where(eq(cards.id, id)),
    ),
  );

  if (columnChanged) {
    const [col] = await db.select().from(boardColumns).where(eq(boardColumns.id, input.toColumnId));
    await db.insert(cardActivity).values({
      cardId: input.cardId,
      type: "system",
      message: `Moved to ${col?.name ?? "another column"}`,
    });
  }
}

export async function deleteCard(cardId: string) {
  await db.delete(cards).where(eq(cards.id, cardId));
}

export async function getCardActivity(cardId: string) {
  return db
    .select({
      id: cardActivity.id,
      type: cardActivity.type,
      message: cardActivity.message,
      createdAt: cardActivity.createdAt,
      employeeId: cardActivity.employeeId,
      employeeName: employees.name,
      employeeColor: employees.color,
    })
    .from(cardActivity)
    .leftJoin(employees, eq(cardActivity.employeeId, employees.id))
    .where(eq(cardActivity.cardId, cardId))
    .orderBy(asc(cardActivity.createdAt));
}

export async function addComment(input: { cardId: string; employeeId?: string; message: string }) {
  const [row] = await db
    .insert(cardActivity)
    .values({
      cardId: input.cardId,
      employeeId: input.employeeId,
      type: "comment",
      message: input.message,
    })
    .returning();
  return row;
}

const COLOR_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export async function createEmployee(input: {
  name: string;
  title?: string;
  email?: string;
  role: "admin" | "member";
  passwordHash?: string;
  departmentId?: string;
}) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(employees);
  const [row] = await db
    .insert(employees)
    .values({
      name: input.name,
      title: input.title,
      email: input.email,
      role: input.role,
      passwordHash: input.passwordHash,
      departmentId: input.departmentId,
      color: COLOR_PALETTE[count % COLOR_PALETTE.length],
    })
    .returning(EMPLOYEE_PUBLIC_COLUMNS);
  return row;
}

export async function updateEmployee(
  id: string,
  patch: {
    name?: string;
    title?: string | null;
    email?: string | null;
    role?: "admin" | "member";
    passwordHash?: string;
    departmentId?: string | null;
  },
) {
  const [row] = await db
    .update(employees)
    .set(patch)
    .where(eq(employees.id, id))
    .returning(EMPLOYEE_PUBLIC_COLUMNS);
  return row;
}

export async function deleteEmployee(id: string) {
  await db.delete(employees).where(eq(employees.id, id));
}

export async function countAdmins() {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(employees)
    .where(eq(employees.role, "admin"));
  return count;
}
