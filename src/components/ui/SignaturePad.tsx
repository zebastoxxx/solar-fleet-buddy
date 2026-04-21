import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface SignaturePadRef {
  clear: () => void;
  isEmpty: () => boolean;
  toBlob: (type?: string) => Promise<Blob | null>;
  toDataURL: (type?: string) => string;
}

interface SignaturePadProps {
  width?: string | number;
  height?: number;
  onChange?: (dataUrl: string) => void;
  onClear?: () => void;
  strokeColor?: string;
  strokeWidth?: number;
  className?: string;
  showClearButton?: boolean;
  placeholder?: string;
}

/**
 * Pad de firma con Pointer Events, escalado DPR y trazo suavizado.
 * - touch-action: none + preventDefault evita scroll al firmar en móvil.
 * - setPointerCapture asegura que el trazo siga al dedo aunque salga del canvas.
 * - quadraticCurveTo entre puntos medios suaviza el trazo.
 * - ResizeObserver re-escala al rotar el dispositivo o cambiar el contenedor.
 */
export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  (
    {
      width = '100%',
      height = 180,
      onChange,
      onClear,
      strokeColor = '#111',
      strokeWidth = 2.2,
      className,
      showClearButton = true,
      placeholder = '✍️ Firma aquí',
    },
    ref,
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDrawing = useRef(false);
    const hasDrawn = useRef(false);
    const lastPoint = useRef<{ x: number; y: number } | null>(null);
    const lastSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

    /** Configura ancho/alto del backing buffer aplicando DPR y reaplica el contexto. */
    const setupCanvas = (preserve = false) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const cssW = rect.width || canvas.offsetWidth;
      const cssH = height;

      // Si el tamaño no cambió, no re-inicializamos para no borrar el trazo
      if (preserve && lastSize.current.w === cssW && lastSize.current.h === cssH) return;

      let snapshot: ImageData | null = null;
      const prevCtx = canvas.getContext('2d');
      if (preserve && prevCtx && lastSize.current.w > 0) {
        try {
          snapshot = prevCtx.getImageData(0, 0, canvas.width, canvas.height);
        } catch {
          snapshot = null;
        }
      }

      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.height = `${cssH}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (snapshot && preserve) {
        // Pintar el snapshot anterior centrado a 1:1 px del buffer
        try {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.putImageData(snapshot, 0, 0);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.scale(dpr, dpr);
        } catch {
          /* ignore */
        }
      }

      lastSize.current = { w: cssW, h: cssH };
    };

    useEffect(() => {
      setupCanvas(false);
      const ro = new ResizeObserver(() => setupCanvas(true));
      if (containerRef.current) ro.observe(containerRef.current);
      return () => ro.disconnect();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [height, strokeColor, strokeWidth]);

    const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      isDrawing.current = true;
      const pos = getPos(e);
      lastPoint.current = pos;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      // Punto inicial visible aunque sea un toque corto
      ctx.arc(pos.x, pos.y, strokeWidth / 2.2, 0, Math.PI * 2);
      ctx.fillStyle = strokeColor;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current) return;
      e.preventDefault();
      e.stopPropagation();
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      const pos = getPos(e);
      const prev = lastPoint.current;
      if (prev) {
        const dx = pos.x - prev.x;
        const dy = pos.y - prev.y;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
        const mid = { x: (pos.x + prev.x) / 2, y: (pos.y + prev.y) / 2 };
        ctx.quadraticCurveTo(prev.x, prev.y, mid.x, mid.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(mid.x, mid.y);
      }
      lastPoint.current = pos;
      hasDrawn.current = true;
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current) return;
      e.preventDefault();
      e.stopPropagation();
      isDrawing.current = false;
      lastPoint.current = null;
      const canvas = canvasRef.current;
      if (canvas) {
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      if (hasDrawn.current && onChange) {
        onChange(canvas?.toDataURL('image/png') ?? '');
      }
    };

    const clear = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      hasDrawn.current = false;
      onClear?.();
    };

    useImperativeHandle(
      ref,
      () => ({
        clear,
        isEmpty: () => !hasDrawn.current,
        toDataURL: (type = 'image/png') => canvasRef.current?.toDataURL(type) ?? '',
        toBlob: (type = 'image/png') =>
          new Promise<Blob | null>((resolve) => {
            const c = canvasRef.current;
            if (!c) return resolve(null);
            c.toBlob((b) => resolve(b), type);
          }),
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [strokeColor, strokeWidth],
    );

    return (
      <div ref={containerRef} className={cn('w-full', className)} style={{ width }}>
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full border-2 border-dashed border-border rounded-xl bg-card cursor-crosshair select-none block"
            style={{
              height,
              touchAction: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none',
              WebkitTouchCallout: 'none',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onContextMenu={(e) => e.preventDefault()}
          />
          {!hasDrawn.current && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground pointer-events-none font-dm">
              {placeholder}
            </p>
          )}
        </div>
        {showClearButton && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            className="mt-1 text-xs text-muted-foreground font-dm"
          >
            Limpiar firma
          </Button>
        )}
      </div>
    );
  },
);

SignaturePad.displayName = 'SignaturePad';
