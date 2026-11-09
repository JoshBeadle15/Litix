import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/server/db/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql, { schema });

const DEFAULT_EMPLOYEES = [
  { name: "Jordan Lee", title: "IT Support Lead", color: "var(--chart-1)" },
  { name: "Priya Shah", title: "Systems Administrator", color: "var(--chart-2)" },
  { name: "Marcus Webb", title: "Help Desk Technician", color: "var(--chart-3)" },
  { name: "Ava Chen", title: "Network Engineer", color: "var(--chart-4)" },
];

const IT_COLUMNS = ["Backlog", "To Do", "In Progress", "Blocked", "Done"];

async function seed() {
  const existingBoards = await db.select().from(schema.boards);
  if (existingBoards.length > 0) {
    console.log("Boards already exist — skipping seed.");
    await sql.end();
    return;
  }

  await db.insert(schema.employees).values(DEFAULT_EMPLOYEES);

  const [board] = await db
    .insert(schema.boards)
    .values({ name: "IT Tickets", description: "Service tickets and IT tasks" })
    .returning();

  await db
    .insert(schema.boardColumns)
    .values(IT_COLUMNS.map((name, i) => ({ boardId: board.id, name, position: i })));

  console.log("Seeded default employees and the IT Tickets board.");
  await sql.end();
}

await seed();
