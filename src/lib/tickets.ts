import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { z } from "zod";
import * as svc from "@/server/tickets.server";

const priority = z.enum(["low", "medium", "high", "urgent"]);
const uuid = z.string().uuid();

export const listBoardsFn = createServerFn({ method: "GET" }).handler(() => svc.listBoards());

export const getBoardFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ boardId: uuid }))
  .handler(async ({ data }) => {
    const detail = await svc.getBoardDetail(data.boardId);
    if (!detail) throw notFound();
    return detail;
  });

export const listEmployeesFn = createServerFn({ method: "GET" }).handler(() => svc.listEmployees());

export const createEmployeeFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z.string().min(1).max(80),
      title: z.string().max(80).optional(),
      email: z.string().email().optional(),
    }),
  )
  .handler(async ({ data }) => svc.createEmployee(data));

export const createBoardFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z.string().min(1).max(80),
      description: z.string().max(280).optional(),
      template: z.enum(["it", "basic", "blank"]),
    }),
  )
  .handler(async ({ data }) => svc.createBoard(data));

export const deleteBoardFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ boardId: uuid }))
  .handler(async ({ data }) => svc.deleteBoard(data.boardId));

export const createColumnFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ boardId: uuid, name: z.string().min(1).max(60) }))
  .handler(async ({ data }) => svc.createColumn(data.boardId, data.name));

export const renameColumnFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ columnId: uuid, name: z.string().min(1).max(60) }))
  .handler(async ({ data }) => svc.renameColumn(data.columnId, data.name));

export const deleteColumnFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ columnId: uuid }))
  .handler(async ({ data }) => svc.deleteColumn(data.columnId));

export const reorderColumnsFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ orderedColumnIds: z.array(uuid) }))
  .handler(async ({ data }) => svc.reorderColumns(data.orderedColumnIds));

export const createCardFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      boardId: uuid,
      columnId: uuid,
      title: z.string().min(1).max(200),
      description: z.string().max(5000).optional(),
      assigneeId: uuid.optional(),
      priority: priority.optional(),
      dueDate: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => svc.createCard(data));

export const updateCardFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      cardId: uuid,
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(5000).nullable().optional(),
      assigneeId: uuid.nullable().optional(),
      priority: priority.optional(),
      dueDate: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => svc.updateCard(data));

export const moveCardFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      cardId: uuid,
      toColumnId: uuid,
      orderedCardIds: z.array(uuid),
    }),
  )
  .handler(async ({ data }) => svc.moveCard(data));

export const deleteCardFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ cardId: uuid }))
  .handler(async ({ data }) => svc.deleteCard(data.cardId));

export const getCardActivityFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ cardId: uuid }))
  .handler(async ({ data }) => svc.getCardActivity(data.cardId));

export const addCommentFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      cardId: uuid,
      employeeId: uuid.optional(),
      message: z.string().min(1).max(2000),
    }),
  )
  .handler(async ({ data }) => svc.addComment(data));
