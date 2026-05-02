import { ReactNode } from 'react';
import { getSignedFileUrl } from '@/lib/signed-url';
import { useSignedUrl } from '@/hooks/useSignedUrl';

interface SignedAnchorProps {
  url: string | null | undefined;
  download?: string;
  className?: string;
  children: ReactNode;
  title?: string;
  target?: string;
  rel?: string;
}

/**
 * Anchor that resolves a signed URL on mount. Falls back to a disabled span if signing fails.
 * Use for download/open links to private storage objects.
 */
export function SignedAnchor({ url, download, className, children, title, target = '_blank', rel = 'noopener noreferrer' }: SignedAnchorProps) {
  const signed = useSignedUrl(url);
  if (!signed) {
    return <span className={className} title={title} aria-disabled style={{ opacity: 0.5, pointerEvents: 'none' }}>{children}</span>;
  }
  return (
    <a href={signed} download={download} className={className} title={title} target={target} rel={rel}>
      {children}
    </a>
  );
}

/** Imperative helper for onClick handlers. */
export async function openSigned(url: string | null | undefined): Promise<void> {
  const signed = await getSignedFileUrl(url);
  if (signed) window.open(signed, '_blank', 'noopener,noreferrer');
}
