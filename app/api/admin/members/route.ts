import { auth } from "@clerk/nextjs/server";
import { desc, eq, ilike, or } from "drizzle-orm";
import { db } from "../../../db";
import { users } from "../../../db/schema";

async function adminMember() {
  const { userId } = await auth();
  if (!userId || !db) return null;
  const [member] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.clerkUserId, userId)).limit(1);
  const allowedEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map(email => email.trim().toLowerCase()).filter(Boolean);
  return member && allowedEmails.includes(member.email.toLowerCase()) ? member : null;
}

export async function GET(request: Request) {
  if (!db) return Response.json({ error: "Studio is temporarily unavailable." }, { status: 503 });
  if (!await adminMember()) return Response.json({ error: "Studio access required." }, { status: 403 });
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80);
  const where = query ? or(ilike(users.displayName, `%${query}%`), ilike(users.email, `%${query}%`)) : undefined;
  const members = await db.select({
    id: users.id, email: users.email, displayName: users.displayName, avatarUrl: users.avatarUrl, bio: users.bio, createdAt: users.createdAt,
  }).from(users).where(where).orderBy(desc(users.createdAt)).limit(200);
  return Response.json({ members }, { headers: { "Cache-Control": "no-store" } });
}
