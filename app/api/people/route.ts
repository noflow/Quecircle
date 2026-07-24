import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "../../db";
import { friendRequests, friendships, notifications, users } from "../../db/schema";

async function memberFor(clerkUserId: string) {
  if (!db) return null;
  const [member] = await db.select({ id: users.id, displayName: users.displayName }).from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);
  return member ?? null;
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!db) return Response.json({ people: [], suggestions: [], requests: [] });
  const member = await memberFor(userId);
  if (!member) return Response.json({ people: [], suggestions: [], requests: [] });
  const friendRows = await db.select({ id: friendships.friendId }).from(friendships).where(eq(friendships.userId, member.id));
  const friendIds = friendRows.map(row => row.id);
  const pending = await db.select({ id: friendRequests.id, senderId: friendRequests.senderId, recipientId: friendRequests.recipientId, status: friendRequests.status, createdAt: friendRequests.createdAt }).from(friendRequests).where(or(eq(friendRequests.senderId, member.id), eq(friendRequests.recipientId, member.id))).orderBy(desc(friendRequests.createdAt));
  const relatedIds = [...new Set(pending.flatMap(row => [row.senderId, row.recipientId]).filter(id => id !== member.id))];
  const relatedPeople = relatedIds.length ? await db.select({ id: users.id, displayName: users.displayName, username: users.username, avatarUrl: users.avatarUrl, bio: users.bio }).from(users).where(inArray(users.id, relatedIds)) : [];
  const byId = new Map(relatedPeople.map(person => [person.id, person]));
  const requests = pending.filter(row => row.recipientId === member.id && row.status === "pending").map(row => ({ id: row.id, createdAt: row.createdAt, person: byId.get(row.senderId) }));
  const query = new URL(request.url).searchParams.get("q")?.trim().replace(/^@/, "").toLowerCase() ?? "";
  const people = query.length >= 2 ? (await db.select({ id: users.id, displayName: users.displayName, username: users.username, avatarUrl: users.avatarUrl, bio: users.bio }).from(users).where(ilike(users.username, `${query}%`)).limit(12)).filter(person => person.id !== member.id && !friendIds.includes(person.id)).map(person => {
    const incoming = pending.find(row => row.senderId === person.id && row.recipientId === member.id && row.status === "pending");
    const outgoing = pending.find(row => row.senderId === member.id && row.recipientId === person.id && row.status === "pending");
    return { ...person, relationship: incoming ? "incoming" : outgoing ? "outgoing" : "none", requestId: incoming?.id ?? null };
  }) : [];
  const secondDegreeRows = friendIds.length ? await db.select({ id: friendships.friendId }).from(friendships).where(inArray(friendships.userId, friendIds)) : [];
  const mutualCounts = new Map<string, number>();
  for (const row of secondDegreeRows) if (row.id !== member.id && !friendIds.includes(row.id)) mutualCounts.set(row.id, (mutualCounts.get(row.id) ?? 0) + 1);
  const suggestionIds = [...mutualCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => id);
  const suggestions = suggestionIds.length ? await db.select({ id: users.id, displayName: users.displayName, username: users.username, avatarUrl: users.avatarUrl, bio: users.bio }).from(users).where(and(inArray(users.id, suggestionIds), ilike(users.username, "%"))).then(rows => rows.map(person => ({ ...person, mutualCount: mutualCounts.get(person.id) ?? 0, relationship: "none" as const }))) : [];
  return Response.json({ people, suggestions, requests });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!db) return Response.json({ error: "People search is temporarily unavailable." }, { status: 503 });
  const member = await memberFor(userId);
  if (!member) return Response.json({ error: "Profile not found." }, { status: 404 });
  const body = await request.json() as { friendId?: string };
  const friendId = body.friendId?.trim();
  if (!friendId || friendId === member.id) return Response.json({ error: "Choose another CineApe member." }, { status: 400 });
  const [person] = await db.select({ id: users.id }).from(users).where(eq(users.id, friendId)).limit(1);
  if (!person) return Response.json({ error: "Member not found." }, { status: 404 });
  const [alreadyFriends] = await db.select({ id: friendships.friendId }).from(friendships).where(and(eq(friendships.userId, member.id), eq(friendships.friendId, friendId))).limit(1);
  if (alreadyFriends) return Response.json({ error: "This person is already in your Circle." }, { status: 409 });
  const [reverseRequest] = await db.select({ id: friendRequests.id }).from(friendRequests).where(and(eq(friendRequests.senderId, friendId), eq(friendRequests.recipientId, member.id), eq(friendRequests.status, "pending"))).limit(1);
  if (reverseRequest) return Response.json({ error: "This person already sent you a request. Accept it from Find people." }, { status: 409 });
  const [previousRequest] = await db.select({ id: friendRequests.id, status: friendRequests.status }).from(friendRequests).where(and(eq(friendRequests.senderId, member.id), eq(friendRequests.recipientId, friendId))).limit(1);
  if (previousRequest?.status === "pending") return Response.json({ error: "A friend request is already pending." }, { status: 409 });
  if (previousRequest?.status === "declined") {
    await db.update(friendRequests).set({ status: "pending", updatedAt: new Date() }).where(eq(friendRequests.id, previousRequest.id));
    await db.insert(notifications).values({ userId: friendId, kind: "friend_request", message: `${member.displayName} wants to add you to their Circle.`, link: "/?page=friends" });
    return Response.json({ status: "sent" });
  }
  const [created] = await db.insert(friendRequests).values({ senderId: member.id, recipientId: friendId }).onConflictDoNothing().returning({ id: friendRequests.id });
  if (!created) return Response.json({ error: "A friend request is already pending." }, { status: 409 });
  await db.insert(notifications).values({ userId: friendId, kind: "friend_request", message: `${member.displayName} wants to add you to their Circle.`, link: "/?page=friends" });
  return Response.json({ status: "sent" }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!db) return Response.json({ error: "Friend requests are temporarily unavailable." }, { status: 503 });
  const member = await memberFor(userId);
  if (!member) return Response.json({ error: "Profile not found." }, { status: 404 });
  const body = await request.json() as { requestId?: string; action?: "accept" | "decline" };
  if (!body.requestId || !["accept", "decline"].includes(body.action ?? "")) return Response.json({ error: "Choose whether to accept or decline the request." }, { status: 400 });
  const [friendRequest] = await db.select().from(friendRequests).where(and(eq(friendRequests.id, body.requestId), eq(friendRequests.recipientId, member.id), eq(friendRequests.status, "pending"))).limit(1);
  if (!friendRequest) return Response.json({ error: "Friend request not found." }, { status: 404 });
  const status = body.action === "accept" ? "accepted" : "declined";
  await db.update(friendRequests).set({ status, updatedAt: new Date() }).where(eq(friendRequests.id, friendRequest.id));
  if (body.action === "accept") {
    await db.insert(friendships).values([{ userId: member.id, friendId: friendRequest.senderId }, { userId: friendRequest.senderId, friendId: member.id }]).onConflictDoNothing();
    await db.insert(notifications).values({ userId: friendRequest.senderId, kind: "friend_request", message: `${member.displayName} accepted your friend request.`, link: "/?page=friends" });
  } else {
    await db.insert(notifications).values({ userId: friendRequest.senderId, kind: "friend_request", message: `${member.displayName} declined your friend request.`, link: "/?page=friends" });
  }
  return Response.json({ status: body.action });
}
