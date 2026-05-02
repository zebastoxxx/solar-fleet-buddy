import { useEffect, useState } from 'react';
import { getSignedFileUrl } from '@/lib/signed-url';

/**
 * React hook to convert a stored Supabase storage URL/path into a fresh signed URL.
 * Returns null while loading or if signing fails.
 */
export function useSignedUrl(input: string | null | undefined, ttlSeconds?: number): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!input) { setUrl(null); return; }
    getSignedFileUrl(input, ttlSeconds).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [input, ttlSeconds]);
  return url;
}
