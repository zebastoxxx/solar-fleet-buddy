import { supabase } from '@/integrations/supabase/client';

/**
 * Sube una firma (blob PNG) al bucket "documents" en signatures/{tenant_id}/{prefix}_{ts}.png
 * y devuelve la URL pública. Si falla, devuelve el dataURL de respaldo (no rompe el flujo).
 */
export async function uploadSignature(
  blob: Blob | null,
  tenantId: string,
  prefix: string,
  fallbackDataUrl?: string,
): Promise<string> {
  if (!blob) return fallbackDataUrl ?? '';
  try {
    const safePrefix = prefix.replace(/[^a-z0-9._-]+/gi, '-').toLowerCase();
    const path = `signatures/${tenantId}/${safePrefix}_${Date.now()}.png`;
    const { error } = await supabase.storage.from('documents').upload(path, blob, {
      contentType: 'image/png',
      upsert: false,
    });
    if (error) throw error;
    const {
      data: { publicUrl },
    } = supabase.storage.from('documents').getPublicUrl(path);
    return publicUrl;
  } catch (err) {
    console.error('uploadSignature failed, using fallback', err);
    return fallbackDataUrl ?? '';
  }
}
