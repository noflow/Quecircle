import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { recommendations, titles, users } from "../../db/schema";

const statuses = ["pending", "watching", "watched", "not_interested"] as const;

async function memberFor(clerkUserId: string) {
  if (!db) return null;
  const [member] = await db.select({ id: users.id }).from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);
  return member ?? null;
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!db) return Response.json({ recommendations: [] });
  const member = await memberFor(userId);
  if (!member) return Response.json({ recommendations: [] });
  const view = new URL(request.url).searchParams.get("view") ?? "received";
  const isSent = view === "sent";
  const status = view === "watching" ? "watching" : view === "completed" ? "watched" : null;
  const conditions = [eq(isSent ? recommendations.senderId : recommendations.recipientId, member.id)];
  if (status) conditions.push(eq(recommendations.status, status));
  const rows = await db.select({
    id: recommendations.id, status: recommendations.status, note: recommendations.note, createdAt: recommendations.createdAt,
    senderId: recommendations.senderId, recipientId: recommendations.recipientId,
    title: titles.name, type: titles.type, year: titles.releaseYear, posterPath: titles.posterPath,
  }).from(recommendations).innerJoin(titles, eq(recommendations.titleId, titles.id)).where(and(...conditions)).orderBy(desc(recommendations.createdAt));
  const peopleIds = rows.map(row => isSent ? row.recipientId : row.senderId);
  const people = peopleIds.length ? await db.select({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, peopleIds)) : [];
  const byId = new Map(people.map(person => [person.id, person]));
  return Response.json({ recommendations: rows.map(row => ({ ...row, person: byId.get(isSent ? row.recipientId : row.senderId) ?? null })) });
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!db) return Response.json({ error: "Recommendations are temporarily unavailable." }, { status: 503 });
  const member = await memberFor(userId);
  if (!member) return Response.json({ error: "Profile not found." }, { status: 404 });
  const body = await request.json() as { id?: string; status?: string };
  if (!body.id || !body.status || !statuses.includes(body.status as typeof statuses[number])) return Response.json({ error: "Choose a valid recommendation status." }, { status: 400 });
  const updated = await db.update(recommendations).set({ status: body.status as typeof statuses[number], updatedAt: new Date() }).where(and(eq(recommendations.id, body.id), eq(recommendations.recipientId, member.id))).returning({ id: recommendations.id });
  if (!updated.length) return Response.json({ error: "Recommendation not found." }, { status: 404 });
  return Response.json({ status: "updated" });
}
