// Dynamic import of jszip — keeps it out of the main bundle.
import { format } from 'date-fns';

interface DocEntry {
  file_url: string | null;
  file_name?: string | null;
  name: string;
}

export async function downloadDocsAsZip(
  docs: DocEntry[],
  folderName: string,
  onProgress?: (pct: number) => void,
) {
  const validDocs = docs.filter((d) => d.file_url);
  if (!validDocs.length) return;

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const folder = zip.folder(folderName)!;
  const usedNames = new Set<string>();

  for (let i = 0; i < validDocs.length; i++) {
    const doc = validDocs[i];
    try {
      const res = await fetch(doc.file_url!);
      if (!res.ok) continue;
      const blob = await res.blob();

      // Determine file name with extension
      let fileName = doc.file_name || doc.name;
      const urlPath = new URL(doc.file_url!).pathname;
      const urlExt = urlPath.split('.').pop()?.toLowerCase() || '';
      if (fileName && !fileName.includes('.') && urlExt) {
        fileName = `${fileName}.${urlExt}`;
      }

      // Deduplicate
      let finalName = fileName;
      let counter = 1;
      while (usedNames.has(finalName.toLowerCase())) {
        const dotIdx = fileName.lastIndexOf('.');
        if (dotIdx > 0) {
          finalName = `${fileName.slice(0, dotIdx)} (${counter})${fileName.slice(dotIdx)}`;
        } else {
          finalName = `${fileName} (${counter})`;
        }
        counter++;
      }
      usedNames.add(finalName.toLowerCase());

      folder.file(finalName, blob);
    } catch {
      // skip failed downloads
    }
    onProgress?.(Math.round(((i + 1) / validDocs.length) * 100));
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const safeName = folderName.replace(/[^a-zA-Z0-9_\-áéíóúñÁÉÍÓÚÑ ]/g, '').trim();
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}_${format(new Date(), 'yyyy-MM-dd')}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
