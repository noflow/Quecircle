import { auth } from "@clerk/nextjs/server";
import { count, eq } from "drizzle-orm";
import { db } from "../../db";
import { editorLists, editorReviews, friendships, groups, recommendations, titleRatings, users } from "../../db/schema";

async function adminMember() {
  const { userId } = await auth();
  if (!userId || !db) return null;
  const [member] = await db.select({ id: users.id, email: users.email, displayName: users.displayName }).from(users).where(eq(users.clerkUserId, userId)).limit(1);
  const allowedEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map(email => email.trim().toLowerCase()).filter(Boolean);
  if (!member || !allowedEmails.includes(member.email.toLowerCase())) return null;
  return member;
}

export async function GET() {
  if (!db) return Response.json({ isAdmin: false, stats: null });
  const member = await adminMember();
  if (!member) return Response.json({ isAdmin: false, stats: null });
  const [[usersCount], [friendsCount], [groupsCount], [recommendationsCount], [ratingsCount], [reviewsCount], [listsCount]] = await Promise.all([
    db.select({ value: count() }).from(users), db.select({ value: count() }).from(friendships), db.select({ value: count() }).from(groups),
    db.select({ value: count() }).from(recommendations), db.select({ value: count() }).from(titleRatings), db.select({ value: count() }).from(editorReviews), db.select({ value: count() }).from(editorLists),
  ]);
  return Response.json({ isAdmin: true, profile: member, stats: { users: usersCount?.value ?? 0, friendships: friendsCount?.value ?? 0, groups: groupsCount?.value ?? 0, recommendations: recommendationsCount?.value ?? 0, ratings: ratingsCount?.value ?? 0, editorReviews: reviewsCount?.value ?? 0, editorLists: listsCount?.value ?? 0 } });
}
