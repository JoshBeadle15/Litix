import "dotenv/config";
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

// Gate everything on whether this app has ever been initialized at all, using
// the presence of any board as the signal (deleting a board is a deliberate,
// confirmed action — unlike deleting an employee, which should be able to
// stick without the next deploy bringing the demo accounts back).
async function main() {
  const existingBoards = await db.select().from(schema.boards);
  if (existingBoards.length > 0) {
    console.log("Already initialized — skipping seed.");
    await sql.end();
    return;
  }

  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  await db.insert(schema.employees).values(DEFAULT_EMPLOYEES.map((e) => ({ ...e, passwordHash })));

  const [board] = await db
    .insert(schema.boards)
    .values({ name: "IT Tickets", description: "Service tickets and IT tasks" })
    .returning();

  await db
    .insert(schema.boardColumns)
    .values(IT_COLUMNS.map((name, i) => ({ boardId: board.id, name, position: i })));

  console.log(
    `Fresh install — seeded demo staff and the IT Tickets board. Default password: "${DEFAULT_PASSWORD}" — change it after first login.`,
  );
  await sql.end();
}

await main();
