import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && process.env.NODE_ENV === "production") {
  console.warn("DATABASE_URL is not configured. Database-powered features are disabled.");
}

const client = databaseUrl ? postgres(databaseUrl, { max: 5 }) : null;

export const db = client ? drizzle(client, { schema }) : null;
