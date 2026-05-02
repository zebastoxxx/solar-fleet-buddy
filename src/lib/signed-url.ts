import { supabase } from '@/integrations/supabase/client';

const SIGNED_TTL = 60 * 60; // 1 hour
const cache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Extract { bucket, path } from either a public Supabase URL or a sign-only path.
 * Supports legacy public URLs of the form:
 *   https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<path>
 * And signed URLs (returns null since they're already usable).
 */
function parseStoragePath(input: string): { bucket: string; path: string } | null {
  if (!input) return null;
  // Already a data URL or blob
  if (input.startsWith('data:') || input.startsWith('blob:')) return null;
  try {
    const m = input.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
    if (m) return { bucket: m[1], path: decodeURIComponent(m[2]) };
  } catch { /* noop */ }
  return null;
}

/**
 * Convert a stored public URL into a fresh signed URL. Cached for SIGNED_TTL.
 * If input cannot be parsed (e.g. external URL, data URL), returns it as-is.
 */
export async function getSignedFileUrl(input: string | null | undefined, ttlSeconds = SIGNED_TTL): Promise<string | null> {
  if (!input) return null;
  const parsed = parseStoragePath(input);
  if (!parsed) return input; // not a Supabase storage URL — return as-is

  const cacheKey = `${parsed.bucket}:${parsed.path}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now + 30_000) return cached.url;

  const { data, error } = await supabase.storage.from(parsed.bucket).createSignedUrl(parsed.path, ttlSeconds);
  if (error || !data?.signedUrl) {
    console.warn('Failed to sign url:', parsed, error);
    return null;
  }
  cache.set(cacheKey, { url: data.signedUrl, expiresAt: now + ttlSeconds * 1000 });
  return data.signedUrl;
}

/**
 * Batch-sign multiple URLs. Returns array of same length with signed URLs (or originals/null).
 */
export async function getSignedFileUrls(inputs: (string | null | undefined)[], ttlSeconds = SIGNED_TTL): Promise<(string | null)[]> {
  return Promise.all(inputs.map((u) => getSignedFileUrl(u, ttlSeconds)));
}
