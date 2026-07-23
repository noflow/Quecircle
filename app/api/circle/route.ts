import { auth } from "@clerk/nextjs/server";
import { count, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { friendships, groupMembers, groups, users } from "../../db/schema";

async function memberFor(clerkUserId: string) {
  if (!db) return null;
  const [member] = await db.select({ id: users.id }).from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);
  return member ?? null;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!db) return Response.json({ friends: [], groups: [] });
  const member = await memberFor(userId);
  if (!member) return Response.json({ friends: [], groups: [] });

  const friendshipRows = await db.select({ friendId: friendships.friendId }).from(friendships).where(eq(friendships.userId, member.id));
  const friendIds = friendshipRows.map(row => row.friendId);
  const friends = friendIds.length
    ? await db.select({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl, bio: users.bio }).from(users).where(inArray(users.id, friendIds)).orderBy(users.displayName)
    : [];

  const memberGroups = await db.select({ id: groups.id, name: groups.name, createdAt: groups.createdAt })
    .from(groupMembers).innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(eq(groupMembers.userId, member.id)).orderBy(desc(groups.createdAt));
  const groupCounts = await Promise.all(memberGroups.map(async group => {
    const [result] = await db!.select({ value: count() }).from(groupMembers).where(eq(groupMembers.groupId, group.id));
    return [group.id, result?.value ?? 0] as const;
  }));
  const countByGroup = new Map(groupCounts);
  return Response.json({ friends, groups: memberGroups.map(group => ({ ...group, memberCount: countByGroup.get(group.id) ?? 0 })) });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!db) return Response.json({ error: "Groups are temporarily unavailable." }, { status: 503 });
  const member = await memberFor(userId);
  if (!member) return Response.json({ error: "Profile not found." }, { status: 404 });
  const body = await request.json() as { name?: string };
  const name = body.name?.trim().slice(0, 60);
  if (!name || name.length < 2) return Response.json({ error: "Give your group a name with at least two characters." }, { status: 400 });
  const [group] = await db.insert(groups).values({ name, createdBy: member.id }).returning({ id: groups.id, name: groups.name, createdAt: groups.createdAt });
  await db.insert(groupMembers).values({ groupId: group.id, userId: member.id });
  return Response.json({ group: { ...group, memberCount: 1 } }, { status: 201 });
}
