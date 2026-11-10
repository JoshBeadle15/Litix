import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  getSessionEmployee,
  hashPassword,
  requireAdmin,
  requireEmployee,
  type SessionEmployee,
} from "@/server/auth.server";
import * as svc from "@/server/tickets.server";

const priority = z.enum(["low", "medium", "high", "urgent"]);
const roleSchema = z.enum(["admin", "member"]);
const uuid = z.string().uuid();

function session(): Promise<SessionEmployee | null> {
  return getSessionEmployee(getRequestHeader("cookie"));
}

export const listBoardsFn = createServerFn({ method: "GET" }).handler(async () => {
  requireEmployee(await session());
  return svc.listBoards();
});

export const getBoardFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ boardId: uuid }))
  .handler(async ({ data }) => {
    requireEmployee(await session());
    const detail = await svc.getBoardDetail(data.boardId);
    if (!detail) throw notFound();
    return detail;
  });

export const listEmployeesFn = createServerFn({ method: "GET" }).handler(async () => {
  requireEmployee(await session());
  return svc.listEmployees();
});

export const createEmployeeFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z.string().min(1).max(80),
      title: z.string().max(80).optional(),
      email: z.string().email().optional(),
      role: roleSchema,
      password: z.string().min(8),
    }),
  )
  .handler(async ({ data }) => {
    requireAdmin(await session());
    const passwordHash = await hashPassword(data.password);
    return svc.createEmployee({ ...data, passwordHash });
  });

export const updateEmployeeFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      employeeId: uuid,
      name: z.string().min(1).max(80).optional(),
      title: z.string().max(80).nullable().optional(),
      email: z.string().email().nullable().optional(),
      role: roleSchema.optional(),
      newPassword: z.string().min(8).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const actor = requireAdmin(await session());
    if (data.role !== undefined && actor.id === data.employeeId) {
      throw new Error("You can't change your own role.");
    }
    if (data.role === "member") {
      const target = await svc.getEmployeeById(data.employeeId);
      if (target?.role === "admin" && (await svc.countAdmins()) <= 1) {
        throw new Error("Can't demote the last remaining admin.");
      }
    }
    const { employeeId, newPassword, ...rest } = data;
    const patch: Parameters<typeof svc.updateEmployee>[1] = { ...rest };
    if (newPassword) patch.passwordHash = await hashPassword(newPassword);
    return svc.updateEmployee(employeeId, patch);
  });

export const deleteEmployeeFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ employeeId: uuid }))
  .handler(async ({ data }) => {
    const actor = requireAdmin(await session());
    if (actor.id === data.employeeId) {
      throw new Error("You can't delete your own account while logged in as them.");
    }
    const target = await svc.getEmployeeById(data.employeeId);
    if (target?.role === "admin" && (await svc.countAdmins()) <= 1) {
      throw new Error("Can't delete the last remaining admin.");
    }
    return svc.deleteEmployee(data.employeeId);
  });

export const createBoardFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z.string().min(1).max(80),
      description: z.string().max(280).optional(),
      template: z.enum(["it", "basic", "blank"]),
    }),
  )
  .handler(async ({ data }) => {
    requireAdmin(await session());
    return svc.createBoard(data);
  });

export const deleteBoardFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ boardId: uuid }))
  .handler(async ({ data }) => {
    requireAdmin(await session());
    return svc.deleteBoard(data.boardId);
  });

export const createColumnFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ boardId: uuid, name: z.string().min(1).max(60) }))
  .handler(async ({ data }) => {
    requireAdmin(await session());
    return svc.createColumn(data.boardId, data.name);
  });

export const renameColumnFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ columnId: uuid, name: z.string().min(1).max(60) }))
  .handler(async ({ data }) => {
    requireAdmin(await session());
    return svc.renameColumn(data.columnId, data.name);
  });

export const deleteColumnFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ columnId: uuid }))
  .handler(async ({ data }) => {
    requireAdmin(await session());
    return svc.deleteColumn(data.columnId);
  });

export const reorderColumnsFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ orderedColumnIds: z.array(uuid) }))
  .handler(async ({ data }) => {
    requireAdmin(await session());
    return svc.reorderColumns(data.orderedColumnIds);
  });

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
  .handler(async ({ data }) => {
    requireEmployee(await session());
    return svc.createCard(data);
  });

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
  .handler(async ({ data }) => {
    requireEmployee(await session());
    return svc.updateCard(data);
  });

export const moveCardFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      cardId: uuid,
      toColumnId: uuid,
      orderedCardIds: z.array(uuid),
    }),
  )
  .handler(async ({ data }) => {
    requireEmployee(await session());
    return svc.moveCard(data);
  });

export const deleteCardFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ cardId: uuid }))
  .handler(async ({ data }) => {
    requireEmployee(await session());
    return svc.deleteCard(data.cardId);
  });

export const getCardActivityFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ cardId: uuid }))
  .handler(async ({ data }) => {
    requireEmployee(await session());
    return svc.getCardActivity(data.cardId);
  });

export const addCommentFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      cardId: uuid,
      message: z.string().min(1).max(2000),
    }),
  )
  .handler(async ({ data }) => {
    const actor = requireEmployee(await session());
    return svc.addComment({ cardId: data.cardId, employeeId: actor.id, message: data.message });
  });
