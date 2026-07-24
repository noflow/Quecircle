import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../../db";
import { editorListItems, editorLists, titles, users } from "../../../db/schema";

type ListTitle = { tmdbId?: number; type?: string; name?: string; year?: number | null; posterPath?: string | null };
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 70) || "cineape-list";

async function adminMember() {
  const { userId } = await auth(); if (!userId || !db) return null;
  const [member] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.clerkUserId, userId)).limit(1);
  const allowed = (process.env.ADMIN_EMAILS ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  return member && allowed.includes(member.email.toLowerCase()) ? member : null;
}

export async function GET() {
  if (!db) return Response.json({ error: "Studio is temporarily unavailable." }, { status: 503 });
  if (!await adminMember()) return Response.json({ error: "Studio access required." }, { status: 403 });
  const lists = await db.select({ id: editorLists.id, name: editorLists.name, slug: editorLists.slug, status: editorLists.status, createdAt: editorLists.createdAt, publishedAt: editorLists.publishedAt })
    .from(editorLists).orderBy(desc(editorLists.createdAt)).limit(100);
  return Response.json({ lists }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!db) return Response.json({ error: "Studio is temporarily unavailable." }, { status: 503 });
  const member = await adminMember(); if (!member) return Response.json({ error: "Studio access required." }, { status: 403 });
  const body = await request.json() as { name?: string; description?: string; seoTitle?: string; seoDescription?: string; status?: string; items?: ListTitle[] };
  const name = body.name?.trim().slice(0, 160); const description = body.description?.trim().slice(0, 1000); const items = body.items?.slice(0, 50) ?? [];
  const status = body.status === "published" ? "published" : "draft";
  if (!name || !description || items.length < 3) return Response.json({ error: "Give the list a name, description, and at least three titles." }, { status: 400 });
  const [list] = await db.insert(editorLists).values({ authorId: member.id, name, description, slug: `${slugify(name)}-${Date.now().toString(36)}`, seoTitle: body.seoTitle?.trim().slice(0, 70) || null, seoDescription: body.seoDescription?.trim().slice(0, 170) || null, status, publishedAt: status === "published" ? new Date() : null }).returning({ id: editorLists.id, slug: editorLists.slug });
  if (!list) return Response.json({ error: "The list could not be saved." }, { status: 500 });
  for (const [index, item] of items.entries()) {
    const tmdbId = Number(item.tmdbId); const type = item.type === "tv" ? "tv" : "movie"; const itemName = item.name?.trim().slice(0, 180);
    if (!tmdbId || !itemName) continue;
    await db.insert(titles).values({ tmdbId, type, name: itemName, releaseYear: item.year ?? null, posterPath: item.posterPath ?? null }).onConflictDoUpdate({ target: [titles.tmdbId, titles.type], set: { name: itemName, releaseYear: item.year ?? null, posterPath: item.posterPath ?? null, updatedAt: new Date() } });
    const [title] = await db.select({ id: titles.id }).from(titles).where(and(eq(titles.tmdbId, tmdbId), eq(titles.type, type))).limit(1);
    if (title) await db.insert(editorListItems).values({ listId: list.id, titleId: title.id, position: index + 1 });
  }
  return Response.json({ list }, { status: 201 });
}
