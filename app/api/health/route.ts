import { sql } from "drizzle-orm";
import { db } from "../../db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!db) return Response.json({ status: "ok", database: "not configured" });

  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok", database: "connected" });
  } catch {
    return Response.json({ status: "degraded", database: "unavailable" }, { status: 503 });
  }
}
