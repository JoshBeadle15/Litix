import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Point it at your local or Railway Postgres instance.");
}

const queryClient = postgres(connectionString, { max: 10 });

export const db = drizzle(queryClient, { schema });
