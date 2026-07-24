import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db";
import { editorListItems, editorLists, titles, users } from "../../db/schema";

type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";

async function getList(slug: string) {
  if (!db) return null;
  const [list] = await db.select({ id: editorLists.id, name: editorLists.name, description: editorLists.description, seoTitle: editorLists.seoTitle, seoDescription: editorLists.seoDescription, author: users.displayName })
    .from(editorLists).innerJoin(users, eq(editorLists.authorId, users.id)).where(and(eq(editorLists.slug, slug), eq(editorLists.status, "published"))).limit(1);
  if (!list) return null;
  const items = await db.select({ name: titles.name, year: titles.releaseYear, type: titles.type, posterPath: titles.posterPath, position: editorListItems.position }).from(editorListItems).innerJoin(titles, eq(editorListItems.titleId, titles.id)).where(eq(editorListItems.listId, list.id)).orderBy(asc(editorListItems.position));
  return { ...list, items };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> { const list = await getList((await params).slug); return list ? { title: list.seoTitle || `${list.name} | CineApe`, description: list.seoDescription || list.description } : { title: "List not found | CineApe" }; }

export default async function MustWatchListPage({ params }: Props) {
  const list = await getList((await params).slug); if (!list) notFound();
  return <main className="editorial-public"><header className="editorial-header"><Link href="/">CineApe</Link><nav><Link href="/must-watch">Must watch</Link><Link href="/">Find your next pick</Link></nav></header><section className="must-watch-detail"><p>CINEAPE EDITORIAL LIST</p><h1>{list.name}</h1><span>{list.description}</span><small>Curated by {list.author}</small><ol>{list.items.map(item => <li key={`${item.position}-${item.name}`}>{item.posterPath ? <img src={item.posterPath} alt="" /> : <i>{item.position}</i>}<div><b>{item.name}</b><span>{item.type === "tv" ? "TV series" : "Movie"}{item.year ? ` · ${item.year}` : ""}</span></div><em>{String(item.position).padStart(2, "0")}</em></li>)}</ol></section><footer className="editorial-tmdb">This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.</footer></main>;
}
