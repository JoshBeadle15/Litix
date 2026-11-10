import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { employees } from "./db/schema";

export const SESSION_COOKIE = "litlx_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not set. Set it to a long random string in your environment.",
    );
  }
  return secret;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

interface SessionPayload {
  employeeId: string;
  exp: number;
}

function sign(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verify(token: string): SessionPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expectedSig = createHmac("sha256", getSecret()).update(body).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (typeof payload.employeeId !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSessionCookie(employeeId: string): string {
  const token = sign({ employeeId, exp: Date.now() + SESSION_TTL_MS });
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function parseCookieHeader(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) return part.slice(idx + 1).trim();
  }
  return null;
}

export interface SessionEmployee {
  id: string;
  name: string;
  email: string | null;
  title: string | null;
  color: string;
  role: "admin" | "member";
}

export async function getSessionEmployee(
  cookieHeader: string | null | undefined,
): Promise<SessionEmployee | null> {
  const token = parseCookieHeader(cookieHeader, SESSION_COOKIE);
  if (!token) return null;
  const payload = verify(token);
  if (!payload) return null;

  const [employee] = await db.select().from(employees).where(eq(employees.id, payload.employeeId));
  if (!employee) return null;

  return {
    id: employee.id,
    name: employee.name,
    email: employee.email,
    title: employee.title,
    color: employee.color,
    role: employee.role,
  };
}

export class UnauthorizedError extends Error {
  constructor(message = "You must be logged in to do that.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function requireEmployee(employee: SessionEmployee | null): SessionEmployee {
  if (!employee) throw new UnauthorizedError();
  return employee;
}

export function requireAdmin(employee: SessionEmployee | null): SessionEmployee {
  const e = requireEmployee(employee);
  if (e.role !== "admin") throw new ForbiddenError("Only admins can do that.");
  return e;
}
