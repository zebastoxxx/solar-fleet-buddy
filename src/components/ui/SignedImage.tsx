import { useSignedUrl } from '@/hooks/useSignedUrl';
import { ImgHTMLAttributes } from 'react';

interface SignedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | null | undefined;
  fallback?: React.ReactNode;
}

/**
 * Renders an <img> backed by a signed Supabase storage URL.
 * Pass the stored (legacy public) URL or a path; the component fetches a signed URL on mount.
 */
export function SignedImage({ src, fallback = null, alt, ...rest }: SignedImageProps) {
  const signed = useSignedUrl(src);
  if (!signed) return <>{fallback}</>;
  return <img src={signed} alt={alt} {...rest} />;
}
