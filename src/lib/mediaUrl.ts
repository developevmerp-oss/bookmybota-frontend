const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

/** Normalize upload paths and API-hosted media URLs for browser display. */
export function resolveMediaUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads/')) return `${API_ORIGIN}${url}`;
  if (url.startsWith('uploads/')) return `${API_ORIGIN}/${url}`;
  return url;
}

/** Store uploads as /uploads/... paths when possible (stable across hosts). */
export function normalizeUploadPath(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (url.startsWith('/uploads/')) return url;
  if (url.startsWith('uploads/')) return `/${url}`;
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith('/uploads/')) return parsed.pathname;
  } catch {
    /* relative or invalid */
  }
  return url;
}

export function extractUploadUrl(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const record = payload as { url?: string; data?: { url?: string } };
  return normalizeUploadPath(record.url || record.data?.url || '');
}
