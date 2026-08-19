import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';

/** Extract a user-facing message from RTK Query / API errors */
export function extractApiError(error: unknown, fallback = 'Something went wrong'): string {
  if (!error || typeof error !== 'object') return fallback;

  const err = error as FetchBaseQueryError & { error?: string; message?: string };

  if ('error' in err && typeof err.error === 'string') {
    return err.error;
  }

  if ('message' in err && typeof err.message === 'string') {
    return err.message;
  }

  if ('data' in err && err.data) {
    const data = err.data as {
      error?: string;
      message?: string;
      live_events?: Array<{ name?: string }>;
    };
    if (typeof data.error === 'string' && data.error.trim()) {
      const names = (data.live_events || [])
        .map((e) => e.name)
        .filter((n): n is string => Boolean(n && n.trim()));
      if (names.length > 0) return `${data.error} Live: ${names.join(', ')}`;
      return data.error;
    }
    if (typeof data.message === 'string' && data.message.trim()) return data.message;
    if (typeof data === 'string') return data;
  }

  if ('status' in err) {
    if (err.status === 'FETCH_ERROR') return 'Network error — check if the backend is running.';
    if (err.status === 'PARSING_ERROR') return 'Invalid response from server.';
    if (typeof err.status === 'number') {
      if (err.status === 400) return 'Invalid request. Please check your input.';
      if (err.status === 404) return 'Resource not found.';
      if (err.status >= 500) return 'Server error. Please try again.';
    }
  }

  return fallback;
}

/** Extract success message from API response body */
export function extractApiSuccessMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const msg = (data as { message?: string }).message;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
  }
  return fallback;
}
