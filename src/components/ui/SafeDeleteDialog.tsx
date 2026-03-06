import { useState } from 'react';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { DeleteCheckResult } from '@/lib/delete-guards';
import { cn } from '@/lib/utils';

interface SafeDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  entityName: string;
  checkFn: () => Promise<DeleteCheckResult>;
  onConfirm: (hardDelete: boolean) => Promise<void>;
}

export function SafeDeleteDialog({ open, onClose, entityName, checkFn, onConfirm }: SafeDeleteDialogProps) {
  const [state, setState] = useState<'checking' | 'blocked' | 'confirm' | 'deleting'>('checking');
  const [result, setResult] = useState<DeleteCheckResult | null>(null);

  const runCheck = async () => {
    setState('checking');
    try {
      const check = await checkFn();
      setResult(check);
      setState(check.canDelete ? 'confirm' : 'blocked');
    } catch {
      setState('blocked');
      setResult({ canDelete: false, hardDelete: false, dependencies: ['Error verificando dependencias'], warnings: [] });
    }
  };

  const handleConfirm = async () => {
    if (!result) return;
    setState('deleting');
    try {
      await onConfirm(result.hardDelete);
      onClose();
    } catch {
      setState('confirm');
    }
  };

  // Run check on open
  if (open && state === 'checking' && !result) {
    runCheck();
  }

  const handleClose = () => {
    setState('checking');
    setResult(null);
    onClose();
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          {state === 'checking' && (
            <>
              <AlertDialogTitle className="font-barlow">Verificando...</AlertDialogTitle>
              <AlertDialogDescription className="font-dm flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Revisando dependencias de {entityName}
              </AlertDialogDescription>
            </>
          )}
          {state === 'blocked' && (
            <>
              <AlertDialogTitle className="font-barlow flex items-center gap-2">
                <span className="text-2xl">🚫</span> No se puede eliminar
              </AlertDialogTitle>
              <AlertDialogDescription className="font-dm">
                Este registro tiene dependencias activas que deben resolverse primero:
              </AlertDialogDescription>
            </>
          )}
          {(state === 'confirm' || state === 'deleting') && (
            <>
              <AlertDialogTitle className="font-barlow flex items-center gap-2">
                <span className="text-2xl">{result?.hardDelete ? '🗑️' : '📦'}</span>
                {result?.hardDelete ? 'Eliminar definitivamente' : 'Desactivar registro'}
              </AlertDialogTitle>
              <AlertDialogDescription className="font-dm">
                {result?.hardDelete
                  ? `"${entityName}" se eliminará permanentemente.`
                  : `"${entityName}" quedará inactivo. El historial se conserva.`}
              </AlertDialogDescription>
            </>
          )}
        </AlertDialogHeader>

        {/* Content */}
        {state === 'blocked' && result && (
          <div className="space-y-2 py-2">
            {result.dependencies.map((d, i) => (
              <p key={i} className="text-sm text-destructive font-dm flex items-start gap-1.5">
                <span>⛔</span> {d}
              </p>
            ))}
          </div>
        )}

        {(state === 'confirm' || state === 'deleting') && result?.warnings && result.warnings.length > 0 && (
          <div className="rounded-lg bg-[hsl(var(--warning-bg))] border border-[hsl(var(--warning)/0.3)] p-3 space-y-1">
            {result.warnings.map((w, i) => (
              <p key={i} className="text-xs text-[hsl(var(--warning))] font-dm">⚠️ {w}</p>
            ))}
          </div>
        )}

        <AlertDialogFooter>
          {state === 'checking' && (
            <AlertDialogCancel onClick={handleClose}>Cancelar</AlertDialogCancel>
          )}
          {state === 'blocked' && (
            <Button onClick={handleClose} className="w-full">Entendido</Button>
          )}
          {(state === 'confirm' || state === 'deleting') && (
            <>
              <AlertDialogCancel disabled={state === 'deleting'} onClick={handleClose}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleConfirm(); }}
                disabled={state === 'deleting'}
                className={cn(
                  result?.hardDelete
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    : ''
                )}
              >
                {state === 'deleting' ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Procesando...</>
                ) : result?.hardDelete ? 'Eliminar' : 'Desactivar'}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
