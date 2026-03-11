import { ShareSubject, SubjectSearchResponse } from "@/lib/share/types";
import { SubjectKind } from "@/lib/subject-kind";

const MUSICBRAINZ_API_BASE = "https://musicbrainz.org/ws/2";
const COVER_ART_ARCHIVE_BASE = "https://coverartarchive.org";
const USER_AGENT = "My9/4.0 (https://my9.shatranj.space)";

type MBReleaseGroup = {
  id: string;
  title: string;
  "primary-type"?: string;
  "first-release-date"?: string;
  "artist-credit"?: Array<{
    name?: string;
    artist?: { name?: string; "sort-name"?: string };
  }>;
  tags?: Array<{ name?: string; count?: number }>;
};

type MBSearchResponse = {
  "release-groups"?: MBReleaseGroup[];
  count?: number;
};

function extractYear(date?: string): number | undefined {
  if (!date) return undefined;
  const year = parseInt(date.slice(0, 4), 10);
  if (!Number.isFinite(year) || year < 1900 || year > 2100) return undefined;
  return year;
}

function getArtistName(rg: MBReleaseGroup): string {
  const credits = rg["artist-credit"];
  if (!credits || credits.length === 0) return "";
  return credits.map((c) => c.name || c.artist?.name || "").join(", ");
}

function getCoverUrl(releaseGroupId: string): string {
  return `${COVER_ART_ARCHIVE_BASE}/release-group/${releaseGroupId}/front-250`;
}

function toShareSubject(rg: MBReleaseGroup): ShareSubject {
  const artistName = getArtistName(rg);
  const genres = Array.isArray(rg.tags)
    ? rg.tags
        .filter((t) => t.name && (t.count ?? 0) > 0)
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
        .slice(0, 3)
        .map((t) => t.name!)
    : [];

  const primaryType = rg["primary-type"];
  if (primaryType && !genres.includes(primaryType)) {
    genres.unshift(primaryType);
  }

  return {
    id: rg.id,
    name: artistName ? `${rg.title} - ${artistName}` : rg.title,
    localizedName: rg.title !== (artistName ? `${rg.title} - ${artistName}` : rg.title) ? rg.title : undefined,
    cover: getCoverUrl(rg.id),
    releaseYear: extractYear(rg["first-release-date"]),
    gameTypeId: 0,
    platforms: [],
    genres: genres.slice(0, 3),
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

export function buildMusicSearchResponse(params: {
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
      "可尝试专辑正式名或艺术家名",
      "中英名称切换检索通常更有效",
      "减少关键词，仅保留核心词",
    ],
    noResultQuery: items.length === 0 && query.trim() ? query : null,
  };
}

export async function searchMusicBrainzReleaseGroups(params: {
  query: string;
  kind: SubjectKind;
}): Promise<ShareSubject[]> {
  const q = params.query.trim();
  if (!q) return [];

  // Search by release group name and artist
  const url = `${MUSICBRAINZ_API_BASE}/release-group?query=releasegroup:${encodeURIComponent(q)}&type=album|ep|single&limit=20&fmt=json`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`MusicBrainz search failed: ${response.status}`);
  }

  const json = (await response.json()) as MBSearchResponse;
  const list = Array.isArray(json["release-groups"]) ? json["release-groups"] : [];

  return list.map(toShareSubject).slice(0, 20);
}
