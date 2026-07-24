import { auth } from "@clerk/nextjs/server";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "../../../db";
import { friendships, recommendations, titleRatings, titles, userTitleStates, users } from "../../../db/schema";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!db) return Response.json({ error: "Profiles are temporarily unavailable." }, { status: 503 });
  const [viewer] = await db.select({ id: users.id }).from(users).where(eq(users.clerkUserId, userId)).limit(1);
  if (!viewer) return Response.json({ error: "Your CineApe profile is not ready yet." }, { status: 409 });
  const friendId = (await params).id;
  const [connection] = await db.select({ friendId: friendships.friendId }).from(friendships).where(and(eq(friendships.userId, viewer.id), eq(friendships.friendId, friendId))).limit(1);
  if (!connection) return Response.json({ error: "You can only view profiles in your CineApe Circle." }, { status: 403 });
  const [profile] = await db.select({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl, bio: users.bio, createdAt: users.createdAt }).from(users).where(eq(users.id, friendId)).limit(1);
  if (!profile) return Response.json({ error: "Member not found." }, { status: 404 });
  const [[ratings], [sent], [received]] = await Promise.all([
    db.select({ value: count() }).from(titleRatings).where(eq(titleRatings.userId, friendId)),
    db.select({ value: count() }).from(recommendations).where(eq(recommendations.senderId, friendId)),
    db.select({ value: count() }).from(recommendations).where(eq(recommendations.recipientId, friendId)),
  ]);
  const recentRatings = await db.select({ title: titles.name, type: titles.type, year: titles.releaseYear, posterPath: titles.posterPath, score: titleRatings.score, review: titleRatings.review, updatedAt: titleRatings.updatedAt })
    .from(titleRatings).innerJoin(titles, eq(titleRatings.titleId, titles.id)).where(eq(titleRatings.userId, friendId)).orderBy(desc(titleRatings.updatedAt)).limit(6);
  const completed = await db.select({ title: titles.name, type: titles.type, year: titles.releaseYear, posterPath: titles.posterPath })
    .from(userTitleStates).innerJoin(titles, eq(userTitleStates.titleId, titles.id)).where(and(eq(userTitleStates.userId, friendId), eq(userTitleStates.status, "completed"))).orderBy(desc(userTitleStates.updatedAt)).limit(6);
  return Response.json({ profile, stats: { ratings: ratings?.value ?? 0, sent: sent?.value ?? 0, received: received?.value ?? 0 }, recentRatings, completed }, { headers: { "Cache-Control": "no-store" } });
}
