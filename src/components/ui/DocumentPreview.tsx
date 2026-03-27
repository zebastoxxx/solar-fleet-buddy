import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Eye, X, FileText, FileSpreadsheet, File } from 'lucide-react';

interface DocumentPreviewProps {
  url: string;
  name: string;
  open: boolean;
  onClose: () => void;
}

function getFileExtension(url: string, fileName?: string): string {
  const source = fileName || url;
  const ext = source.split('.').pop()?.toLowerCase()?.split('?')[0] || '';
  return ext;
}

function isPreviewable(ext: string): 'image' | 'pdf' | 'none' {
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  return 'none';
}

function FileIcon({ ext }: { ext: string }) {
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet className="h-12 w-12 text-green-600" />;
  if (['doc', 'docx'].includes(ext)) return <FileText className="h-12 w-12 text-blue-600" />;
  if (ext === 'pdf') return <FileText className="h-12 w-12 text-red-600" />;
  return <File className="h-12 w-12 text-muted-foreground" />;
}

export function DocumentPreview({ url, name, open, onClose }: DocumentPreviewProps) {
  const ext = getFileExtension(url, name);
  const previewType = isPreviewable(ext);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-4 py-3 border-b border-border flex flex-row items-center justify-between">
          <DialogTitle className="font-barlow text-base truncate pr-4">{name}</DialogTitle>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
              <a href={url} download={name} target="_blank" rel="noopener noreferrer">
                <Download className="h-3.5 w-3.5" /> Descargar
              </a>
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-auto bg-muted/30 min-h-[300px] max-h-[75vh] flex items-center justify-center">
          {previewType === 'image' && (
            <img src={url} alt={name} className="max-w-full max-h-[70vh] object-contain p-4" />
          )}
          {previewType === 'pdf' && (
            <iframe src={url} className="w-full h-[70vh] border-0" title={name} />
          )}
          {previewType === 'none' && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <FileIcon ext={ext} />
              <div>
                <p className="font-dm text-sm font-medium text-foreground">{name}</p>
                <p className="font-dm text-xs text-muted-foreground mt-1">
                  Vista previa no disponible para archivos .{ext || 'desconocido'}
                </p>
              </div>
              <Button variant="default" size="sm" className="gap-1.5" asChild>
                <a href={url} download={name} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4" /> Descargar archivo
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PreviewButton({ url, name }: { url: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(true)} title="Vista previa">
        <Eye className="h-3.5 w-3.5" />
      </Button>
      {open && <DocumentPreview url={url} name={name} open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
