const TMDB_API = "https://api.themoviedb.org/3/search/multi";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

type SearchItem = {
  media_type?: "movie" | "tv" | "person";
  poster_path?: string | null;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
};

export async function GET(request: Request) {
  const token = process.env.TMDB_API_READ_ACCESS_TOKEN;
  const query = new URL(request.url).searchParams.get("query")?.trim().slice(0, 80);
  if (!query) return Response.json({ error: "A title query is required." }, { status: 400 });
  if (!token) return Response.json({ configured: false, image: null });

  try {
    const url = new URL(TMDB_API);
    url.searchParams.set("query", query);
    url.searchParams.set("language", "en-US");
    url.searchParams.set("include_adult", "false");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!response.ok) return Response.json({ configured: true, image: null }, { status: 502 });
    const data = (await response.json()) as { results?: SearchItem[] };
    const match = data.results?.find((item) => (item.media_type === "movie" || item.media_type === "tv") && item.poster_path);
    return Response.json({
      configured: true,
      image: match?.poster_path ? `${IMAGE_BASE}${match.poster_path}` : null,
      title: match?.title ?? match?.name ?? null,
      year: match?.release_date?.slice(0, 4) ?? match?.first_air_date?.slice(0, 4) ?? null,
    }, { headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } });
  } catch {
    return Response.json({ configured: true, image: null }, { status: 502 });
  }
}
