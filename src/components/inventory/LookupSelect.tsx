import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, Check } from 'lucide-react';
import { toast } from 'sonner';

export type LookupType = 'area' | 'category' | 'unit';

interface LookupSelectProps {
  type: LookupType;
  value?: string;
  onChange: (val: string) => void;
  tenantId: string;
  userId?: string;
  placeholder?: string;
  /** Optional fallback values shown together with stored ones (used to migrate legacy enums). */
  defaults?: string[];
  addLabel?: string;
}

export function LookupSelect({
  type, value, onChange, tenantId, userId, placeholder = 'Selecciona', defaults = [], addLabel,
}: LookupSelectProps) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ['inventory-lookups', tenantId, type],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from('inventory_lookups')
        .select('id, value')
        .eq('tenant_id', tenantId)
        .eq('lookup_type', type)
        .order('value', { ascending: true });
      return (data || []) as { id: string; value: string }[];
    },
  });

  // Merge defaults + DB values, dedup, alphabetical
  const merged = Array.from(new Set([...defaults, ...rows.map(r => r.value)]))
    .sort((a, b) => a.localeCompare(b, 'es'));

  const save = async () => {
    const v = newValue.trim();
    if (!v) return;
    if (merged.some(m => m.toLowerCase() === v.toLowerCase())) {
      toast.error('Ya existe ese valor');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('inventory_lookups').insert({
        tenant_id: tenantId,
        lookup_type: type,
        value: v,
        created_by: userId,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['inventory-lookups', tenantId, type] });
      onChange(v);
      setNewValue('');
      setAdding(false);
      toast.success('Agregado');
    } catch (e: any) {
      toast.error(e.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  if (adding) {
    return (
      <div className="flex gap-1.5">
        <Input
          autoFocus
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); save(); }
            if (e.key === 'Escape') { setAdding(false); setNewValue(''); }
          }}
          placeholder={addLabel || 'Nuevo valor'}
          className="font-dm text-sm h-9"
        />
        <Button type="button" size="icon" variant="ghost" disabled={saving} onClick={save} className="h-9 w-9">
          <Check className="h-4 w-4 text-success" />
        </Button>
        <Button type="button" size="icon" variant="ghost" onClick={() => { setAdding(false); setNewValue(''); }} className="h-9 w-9">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="font-dm text-sm flex-1">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-popover z-50">
          {merged.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground font-dm">Sin opciones aún</div>
          )}
          {merged.map((v) => (
            <SelectItem key={v} value={v}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" size="icon" variant="outline" onClick={() => setAdding(true)} className="h-9 w-9 shrink-0" title={addLabel || 'Agregar'}>
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
