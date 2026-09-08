export type ArtistMediaClip = {
  url: string;
  title?: string;
  duration_sec: number;
  size_bytes?: number;
};

export type ArtistMediaKind = "spotlight" | "audio";

export type ArtistSocialLinks = {
  instagram_url?: string;
  youtube_url?: string;
  instagram_followers?: number | null;
  youtube_followers?: number | null;
  followers_fetched_at?: string | null;
};

export type ArtistMeta = {
  /** Which media type the artist chose (only one allowed at a time). */
  media_kind?: ArtistMediaKind;
  audio_clips?: ArtistMediaClip[];
  spotlight_videos?: ArtistMediaClip[];
  social?: ArtistSocialLinks;
};

export const ARTIST_MEDIA_MAX = 5;
export const ARTIST_MEDIA_MAX_DURATION_SEC = 30;
export const ARTIST_VIDEO_MAX_BYTES = 5 * 1024 * 1024;
export const VENUE_GALLERY_MAX = 12;

export function isComedyArtistSlug(slug: string | null | undefined): boolean {
  const s = String(slug || "").toLowerCase();
  return s === "comedian" || s === "comedy" || s.includes("comed");
}

export function emptyArtistMeta(): ArtistMeta {
  return {
    media_kind: "spotlight",
    audio_clips: [],
    spotlight_videos: [],
    social: {
      instagram_url: "",
      youtube_url: "",
      instagram_followers: null,
      youtube_followers: null,
    },
  };
}

export function getArtistMediaKind(meta: ArtistMeta | null | undefined): ArtistMediaKind {
  const videos = meta?.spotlight_videos || [];
  const audio = meta?.audio_clips || [];
  if (videos.length > 0) return "spotlight";
  if (audio.length > 0) return "audio";
  if (meta?.media_kind === "audio" || meta?.media_kind === "spotlight") return meta.media_kind;
  return "spotlight";
}

export function normalizeArtistMetaClient(raw: unknown): ArtistMeta {
  let parsed: unknown = raw;
  if (typeof parsed === "string") {
    const trimmed = parsed.trim();
    if (!trimmed) {
      parsed = {};
    } else {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        parsed = {};
      }
    }
  }

  const src =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  const social =
    src.social && typeof src.social === "object" && !Array.isArray(src.social)
      ? (src.social as Record<string, unknown>)
      : {};

  const clips = (arr: unknown): ArtistMediaClip[] => {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const url = typeof row.url === "string" ? row.url.trim() : "";
        if (!url) return null;
        return {
          url,
          title: typeof row.title === "string" ? row.title : undefined,
          duration_sec: Number(row.duration_sec) || 0,
          size_bytes: row.size_bytes != null ? Number(row.size_bytes) : undefined,
        } as ArtistMediaClip;
      })
      .filter(Boolean)
      .slice(0, ARTIST_MEDIA_MAX) as ArtistMediaClip[];
  };

  const audioRaw = clips(src.audio_clips);
  const videoRaw = clips(src.spotlight_videos);
  const preferred: ArtistMediaKind | null =
    src.media_kind === "audio" || src.media_kind === "spotlight" ? src.media_kind : null;

  let media_kind: ArtistMediaKind;
  let audio_clips: ArtistMediaClip[];
  let spotlight_videos: ArtistMediaClip[];

  if (videoRaw.length > 0 && audioRaw.length > 0) {
    media_kind = preferred || "spotlight";
    if (media_kind === "audio") {
      audio_clips = audioRaw;
      spotlight_videos = [];
    } else {
      audio_clips = [];
      spotlight_videos = videoRaw;
    }
  } else if (videoRaw.length > 0) {
    media_kind = "spotlight";
    audio_clips = [];
    spotlight_videos = videoRaw;
  } else if (audioRaw.length > 0) {
    media_kind = "audio";
    audio_clips = audioRaw;
    spotlight_videos = [];
  } else {
    media_kind = preferred || "spotlight";
    audio_clips = [];
    spotlight_videos = [];
  }

  return {
    media_kind,
    audio_clips,
    spotlight_videos,
    social: {
      instagram_url: typeof social.instagram_url === "string" ? social.instagram_url : "",
      youtube_url: typeof social.youtube_url === "string" ? social.youtube_url : "",
      instagram_followers:
        social.instagram_followers == null || social.instagram_followers === ""
          ? null
          : Number(social.instagram_followers),
      youtube_followers:
        social.youtube_followers == null || social.youtube_followers === ""
          ? null
          : Number(social.youtube_followers),
      followers_fetched_at:
        typeof social.followers_fetched_at === "string" ? social.followers_fetched_at : null,
    },
  };
}

export function formatFollowerCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n < 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(Math.floor(n));
}

/** Read media duration (seconds) from a File via HTML media element. */
export function readMediaDurationSec(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith("video/");
    const el = document.createElement(isVideo ? "video" : "audio");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      const d = Number(el.duration);
      URL.revokeObjectURL(url);
      if (!Number.isFinite(d) || d <= 0) {
        reject(new Error("Could not read media duration."));
        return;
      }
      resolve(d);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load media file."));
    };
    el.src = url;
  });
}
