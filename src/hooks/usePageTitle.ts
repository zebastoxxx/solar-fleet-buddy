import { useEffect } from 'react';

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Up & Down Solar`;
    return () => { document.title = 'Up & Down Solar'; };
  }, [title]);
}
