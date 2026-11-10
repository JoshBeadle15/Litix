import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  clearSessionCookie,
  createSessionCookie,
  getSessionEmployee,
  hashPassword,
  requireEmployee,
  verifyPassword,
} from "@/server/auth.server";
import * as svc from "@/server/tickets.server";

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(async () => {
  return getSessionEmployee(getRequestHeader("cookie"));
});

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email(), password: z.string().min(1) }))
  .handler(async ({ data }) => {
    const employee = await svc.getEmployeeByEmail(data.email.toLowerCase().trim());
    if (!employee || !employee.passwordHash) {
      throw new Error("Invalid email or password.");
    }
    const ok = await verifyPassword(data.password, employee.passwordHash);
    if (!ok) {
      throw new Error("Invalid email or password.");
    }
    setResponseHeader("set-cookie", createSessionCookie(employee.id));
    return { id: employee.id, name: employee.name, role: employee.role };
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  setResponseHeader("set-cookie", clearSessionCookie());
  return { success: true };
});

export const updateMyProfileFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z.string().min(1).max(80),
      title: z.string().max(80).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const session = requireEmployee(await getSessionEmployee(getRequestHeader("cookie")));
    return svc.updateEmployee(session.id, { name: data.name, title: data.title || null });
  });

export const changePasswordFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    }),
  )
  .handler(async ({ data }) => {
    const session = requireEmployee(await getSessionEmployee(getRequestHeader("cookie")));
    const employee = await svc.getEmployeeById(session.id);
    if (!employee?.passwordHash) throw new Error("No password set on this account.");
    const ok = await verifyPassword(data.currentPassword, employee.passwordHash);
    if (!ok) throw new Error("Current password is incorrect.");
    const passwordHash = await hashPassword(data.newPassword);
    await svc.updateEmployee(session.id, { passwordHash });
    return { success: true };
  });
