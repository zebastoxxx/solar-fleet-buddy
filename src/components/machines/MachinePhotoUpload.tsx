import { useState, useRef } from 'react';
import { Camera, Upload, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { compressImage } from '@/lib/image-compress';

interface Props {
  currentUrl?: string | null;
  machineId?: string;
  onUrlChange?: (url: string) => void;
  /** For create modal: hold local file before machine exists */
  onFileSelect?: (file: File) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function MachinePhotoUpload({ currentUrl, machineId, onUrlChange, onFileSelect, className, size = 'md' }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tenantId = useAuthStore((s) => s.user?.tenant_id);

  const handleFile = async (file: File) => {
    const compressed = await compressImage(file);
    const objectUrl = URL.createObjectURL(compressed);
    setPreview(objectUrl);

    if (onFileSelect) {
      onFileSelect(compressed);
      return;
    }

    if (!machineId || !tenantId) return;
    setUploading(true);
    try {
      const ext = compressed.name.split('.').pop() || 'jpg';
      const path = `${tenantId}/${machineId}.${ext}`;
      const { error } = await supabase.storage.from('machine-photos').upload(path, compressed, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('machine-photos').getPublicUrl(path);
      await supabase.from('machines').update({ cover_photo_url: publicUrl }).eq('id', machineId);
      onUrlChange?.(publicUrl);
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const displayUrl = preview || currentUrl;
  const h = size === 'sm' ? 'h-24' : 'h-[140px]';

  return (
    <div
      className={cn(
        'relative rounded-xl bg-muted flex items-center justify-center overflow-hidden cursor-pointer group border border-dashed border-border hover:border-primary/50 transition-colors',
        h,
        className
      )}
      onClick={() => inputRef.current?.click()}
    >
      {displayUrl ? (
        <>
          <img src={displayUrl} alt="Foto máquina" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="h-6 w-6 text-white" />
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <Upload className="h-5 w-5" />
          <span className="text-[11px] font-dm">{uploading ? 'Subiendo...' : 'Subir foto'}</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}

export async function uploadMachinePhoto(file: File, machineId: string, tenantId: string): Promise<string> {
  const compressed = await compressImage(file);
  const ext = compressed.name.split('.').pop() || 'jpg';
  const path = `${tenantId}/${machineId}.${ext}`;
  const { error } = await supabase.storage.from('machine-photos').upload(path, compressed, { upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('machine-photos').getPublicUrl(path);
  await supabase.from('machines').update({ cover_photo_url: publicUrl }).eq('id', machineId);
  return publicUrl;
}
