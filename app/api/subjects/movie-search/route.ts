import { NextResponse } from "next/server";
import { normalizeSearchQuery } from "@/lib/search/query";
import {
  buildMovieSearchResponse,
  searchTmdbMovies,
} from "@/lib/tmdb/search";

const SEARCH_CACHE_CONTROL = "public, max-age=0, s-maxage=900, stale-while-revalidate=86400";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = normalizeSearchQuery(searchParams.get("q"));
  const kind = "movie" as const;

  if (!query) {
    return NextResponse.json(
      buildMovieSearchResponse({ query: "", kind, items: [] }),
      { headers: { "Cache-Control": SEARCH_CACHE_CONTROL } }
    );
  }

  try {
    const items = await searchTmdbMovies({ query, kind });
    return NextResponse.json(
      buildMovieSearchResponse({ query, kind, items }),
      { headers: { "Cache-Control": SEARCH_CACHE_CONTROL } }
    );
  } catch (error) {
    const payload = buildMovieSearchResponse({ query, kind, items: [] });
    return NextResponse.json(
      { ...payload, ok: false, error: error instanceof Error ? error.message : "搜索失败" },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
