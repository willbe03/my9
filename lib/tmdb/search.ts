import { ShareSubject, SubjectSearchResponse } from "@/lib/share/types";
import { SubjectKind } from "@/lib/subject-kind";

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

function getTmdbToken(): string | null {
  return process.env.TMDB_READ_ACCESS_TOKEN?.trim() || null;
}

type TMDBMovie = {
  id: number;
  title: string;
  original_title?: string;
  poster_path?: string | null;
  release_date?: string;
  genre_ids?: number[];
  overview?: string;
};

type TMDBSearchResponse = {
  results?: TMDBMovie[];
  total_results?: number;
};

const GENRE_MAP: Record<number, string> = {
  28: "动作",
  12: "冒险",
  16: "动画",
  35: "喜剧",
  80: "犯罪",
  99: "纪录",
  18: "剧情",
  10751: "家庭",
  14: "奇幻",
  36: "历史",
  27: "恐怖",
  10402: "音乐",
  9648: "悬疑",
  10749: "爱情",
  878: "科幻",
  10770: "电视电影",
  53: "惊悚",
  10752: "战争",
  37: "西部",
};

function extractYear(date?: string): number | undefined {
  if (!date) return undefined;
  const year = parseInt(date.slice(0, 4), 10);
  if (!Number.isFinite(year) || year < 1900 || year > 2100) return undefined;
  return year;
}

function getCoverUrl(posterPath?: string | null): string | null {
  if (!posterPath) return null;
  return `${TMDB_IMAGE_BASE}${posterPath}`;
}

function mapGenres(genreIds?: number[]): string[] {
  if (!Array.isArray(genreIds)) return [];
  return genreIds
    .map((id) => GENRE_MAP[id])
    .filter((g): g is string => Boolean(g))
    .slice(0, 3);
}

function toShareSubject(movie: TMDBMovie): ShareSubject {
  const localizedName =
    movie.original_title && movie.original_title !== movie.title
      ? movie.original_title
      : undefined;

  return {
    id: `tmdb-${movie.id}`,
    name: movie.title,
    localizedName,
    cover: getCoverUrl(movie.poster_path),
    releaseYear: extractYear(movie.release_date),
    gameTypeId: 0,
    platforms: [],
    genres: mapGenres(movie.genre_ids),
  };
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function scoreCandidate(query: string, subject: ShareSubject): number {
  const q = normalizeText(query);
  if (!q) return 0;

  const candidates = [subject.localizedName || "", subject.name];
  let score = 0;

  for (const text of candidates) {
    const normalized = normalizeText(text);
    if (!normalized) continue;
    if (normalized === q) score += 100;
    if (normalized.startsWith(q)) score += 60;
    if (normalized.includes(q)) score += 25;
  }

  return score;
}

export function buildMovieSearchResponse(params: {
  query: string;
  kind: SubjectKind;
  items: ShareSubject[];
}): SubjectSearchResponse {
  const { query, kind, items } = params;
  const ranked = items
    .map((item) => ({ id: item.id, score: scoreCandidate(query, item) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.id);

  const topPickIds = ranked.length > 0 ? ranked : items.slice(0, 2).map((item) => item.id);

  return {
    ok: true,
    source: "bangumi" as const,
    kind,
    items,
    topPickIds,
    suggestions: [
      "可尝试电影正式名或原名",
      "中英名称切换检索通常更有效",
      "减少关键词，仅保留核心词",
    ],
    noResultQuery: items.length === 0 && query.trim() ? query : null,
  };
}

export async function searchTmdbMovies(params: {
  query: string;
  kind: SubjectKind;
}): Promise<ShareSubject[]> {
  const q = params.query.trim();
  if (!q) return [];

  const token = getTmdbToken();
  if (!token) {
    throw new Error("TMDB API token not configured");
  }

  const url = `${TMDB_API_BASE}/search/movie?query=${encodeURIComponent(q)}&language=zh-CN&page=1&include_adult=false`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`TMDB search failed: ${response.status}`);
  }

  const json = (await response.json()) as TMDBSearchResponse;
  const results = Array.isArray(json.results) ? json.results : [];

  return results.map(toShareSubject).slice(0, 20);
}
