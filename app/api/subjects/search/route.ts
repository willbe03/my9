import { handleBangumiSearchRequest } from "@/lib/bangumi/route";
import { normalizeSearchQuery } from "@/lib/search/query";
import { parseSubjectKind } from "@/lib/subject-kind";
import {
  buildMusicSearchResponse,
  searchMusicBrainzReleaseGroups,
} from "@/lib/musicbrainz/search";
import {
  buildMovieSearchResponse,
  searchTmdbMovies,
} from "@/lib/tmdb/search";
import { NextResponse } from "next/server";

const SEARCH_CACHE_CONTROL = "public, max-age=0, s-maxage=900, stale-while-revalidate=86400";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = parseSubjectKind(searchParams.get("kind"));

  if (kind === "music") {
    const query = normalizeSearchQuery(searchParams.get("q"));
    if (!query) {
      return NextResponse.json(
        buildMusicSearchResponse({ query: "", kind, items: [] }),
        { headers: { "Cache-Control": SEARCH_CACHE_CONTROL } }
      );
    }
    try {
      const items = await searchMusicBrainzReleaseGroups({ query, kind });
      return NextResponse.json(
        buildMusicSearchResponse({ query, kind, items }),
        { headers: { "Cache-Control": SEARCH_CACHE_CONTROL } }
      );
    } catch (error) {
      const payload = buildMusicSearchResponse({ query, kind, items: [] });
      return NextResponse.json(
        { ...payload, ok: false, error: error instanceof Error ? error.message : "搜索失败" },
        { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }
  }

  if (kind === "movie") {
    const query = normalizeSearchQuery(searchParams.get("q"));
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

  // Default: Bangumi search for game, anime, manga, lightnovel, work
  return handleBangumiSearchRequest(request);
}
