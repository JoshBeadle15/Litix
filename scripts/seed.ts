import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/server/db/schema";
import { hashPassword } from "../src/server/auth.server";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql, { schema });

const DEFAULT_PASSWORD = "ChangeMe123!";

const DEFAULT_EMPLOYEES = [
  {
    name: "Jordan Lee",
    title: "IT Support Lead",
    color: "var(--chart-1)",
    email: "jordan@litlx.local",
    role: "admin" as const,
  },
  {
    name: "Priya Shah",
    title: "Systems Administrator",
    color: "var(--chart-2)",
    email: "priya@litlx.local",
    role: "member" as const,
  },
  {
    name: "Marcus Webb",
    title: "Help Desk Technician",
    color: "var(--chart-3)",
    email: "marcus@litlx.local",
    role: "member" as const,
  },
  {
    name: "Ava Chen",
    title: "Network Engineer",
    color: "var(--chart-4)",
    email: "ava@litlx.local",
    role: "member" as const,
  },
];

const IT_COLUMNS = ["Backlog", "To Do", "In Progress", "Blocked", "Done"];

async function ensureEmployees() {
  const existing = await db.select().from(schema.employees);
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  let activated = 0;

  for (const def of DEFAULT_EMPLOYEES) {
    const match = existing.find((e) => e.name === def.name);
    if (!match) {
      await db.insert(schema.employees).values({ ...def, passwordHash });
      activated++;
      continue;
    }
    if (!match.passwordHash) {
      await db
        .update(schema.employees)
        .set({ passwordHash, role: def.role, email: match.email ?? def.email })
        .where(eq(schema.employees.id, match.id));
      activated++;
    }
  }

  if (activated > 0) {
    console.log(
      `Activated ${activated} employee login(s). Default password: "${DEFAULT_PASSWORD}" — change it after first login.`,
    );
  } else {
    console.log("Employee logins already set up — skipping.");
  }
}

async function ensureItBoard() {
  const existingBoards = await db.select().from(schema.boards);
  if (existingBoards.length > 0) {
    console.log("Boards already exist — skipping board seed.");
    return;
  }

  const [board] = await db
    .insert(schema.boards)
    .values({ name: "IT Tickets", description: "Service tickets and IT tasks" })
    .returning();

  await db
    .insert(schema.boardColumns)
    .values(IT_COLUMNS.map((name, i) => ({ boardId: board.id, name, position: i })));

  console.log("Seeded the IT Tickets board.");
}

await ensureEmployees();
await ensureItBoard();
await sql.end();
