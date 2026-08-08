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
    const data = err.data as { error?: string; message?: string };
    if (typeof data.error === 'string' && data.error.trim()) return data.error;
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
