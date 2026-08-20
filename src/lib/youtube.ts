export function parseYouTubeId(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const value = raw.trim();
  try {
    const u = new URL(value);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
    const v = u.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const embed = u.pathname.match(/\/embed\/([^/?]+)/);
    if (embed?.[1] && /^[a-zA-Z0-9_-]{11}$/.test(embed[1])) return embed[1];
    const shorts = u.pathname.match(/\/shorts\/([^/?]+)/);
    if (shorts?.[1] && /^[a-zA-Z0-9_-]{11}$/.test(shorts[1])) return shorts[1];
  } catch {
    /* not a URL */
  }
  const loose = value.match(/(?:v=|\/embed\/|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
  return loose?.[1] || null;
}

export function youtubeEmbedSrc(videoId: string, autoplay: boolean) {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    enablejsapi: "1",
    autoplay: autoplay ? "1" : "0",
    mute: autoplay ? "1" : "0",
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

export function youtubeThumb(videoId: string) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
