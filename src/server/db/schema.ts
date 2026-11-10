import { relations } from "drizzle-orm";
import { date, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const priorityEnum = pgEnum("priority", ["low", "medium", "high", "urgent"]);
export const activityTypeEnum = pgEnum("activity_type", ["comment", "system"]);
export const roleEnum = pgEnum("role", ["admin", "member"]);

export const employees = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").unique(),
  title: text("title"),
  color: text("color").notNull().default("var(--chart-1)"),
  role: roleEnum("role").notNull().default("member"),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const boards = pgTable("boards", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const boardColumns = pgTable("board_columns", {
  id: uuid("id").primaryKey().defaultRandom(),
  boardId: uuid("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cards = pgTable("cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  boardId: uuid("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  columnId: uuid("column_id")
    .notNull()
    .references(() => boardColumns.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  assigneeId: uuid("assignee_id").references(() => employees.id, { onDelete: "set null" }),
  priority: priorityEnum("priority").notNull().default("medium"),
  dueDate: date("due_date"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cardActivity = pgTable("card_activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  cardId: uuid("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "set null" }),
  type: activityTypeEnum("type").notNull().default("comment"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const boardsRelations = relations(boards, ({ many }) => ({
  columns: many(boardColumns),
  cards: many(cards),
}));

export const boardColumnsRelations = relations(boardColumns, ({ one, many }) => ({
  board: one(boards, { fields: [boardColumns.boardId], references: [boards.id] }),
  cards: many(cards),
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
  board: one(boards, { fields: [cards.boardId], references: [boards.id] }),
  column: one(boardColumns, { fields: [cards.columnId], references: [boardColumns.id] }),
  assignee: one(employees, { fields: [cards.assigneeId], references: [employees.id] }),
  activity: many(cardActivity),
}));

export const cardActivityRelations = relations(cardActivity, ({ one }) => ({
  card: one(cards, { fields: [cardActivity.cardId], references: [cards.id] }),
  employee: one(employees, { fields: [cardActivity.employeeId], references: [employees.id] }),
}));

export const employeesRelations = relations(employees, ({ many }) => ({
  cards: many(cards),
  activity: many(cardActivity),
}));
