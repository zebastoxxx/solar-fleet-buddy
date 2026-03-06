import { useState, useRef, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, Sparkles, Loader2, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

type Msg = { role: 'user' | 'assistant'; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sam-agent`;

async function streamChat({
  messages,
  tenantId,
  userId,
  onDelta,
  onDone,
  onError,
}: {
  messages: Msg[];
  tenantId: string;
  userId: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}) {
  try {
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages, tenant_id: tenantId, user_id: userId }),
    });

    if (resp.status === 429) {
      onError('Demasiadas solicitudes. Intenta en unos segundos.');
      return;
    }
    if (resp.status === 402) {
      onError('Créditos agotados. Contacta al administrador.');
      return;
    }
    if (!resp.ok || !resp.body) {
      onError('Error al conectar con Sam.');
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') break;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + '\n' + textBuffer;
          break;
        }
      }
    }

    // Flush remaining
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split('\n')) {
        if (!raw) continue;
        if (raw.endsWith('\r')) raw = raw.slice(0, -1);
        if (raw.startsWith(':') || raw.trim() === '') continue;
        if (!raw.startsWith('data: ')) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  } catch (e) {
    onError('Error de conexión con Sam.');
  }
}

export function SamChat({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading || !user) return;

    const userMsg: Msg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setError('');

    let assistantSoFar = '';
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    await streamChat({
      messages: [...messages, userMsg],
      tenantId: user.tenant_id,
      userId: user.id,
      onDelta: (chunk) => upsertAssistant(chunk),
      onDone: () => {
        setIsLoading(false);
        // Invalidate common queries after potential CRUD actions
        qc.invalidateQueries({ queryKey: ['clients'] });
        qc.invalidateQueries({ queryKey: ['suppliers'] });
        qc.invalidateQueries({ queryKey: ['machines'] });
        qc.invalidateQueries({ queryKey: ['cost-entries'] });
      },
      onError: (err) => {
        setError(err);
        setIsLoading(false);
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError('');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[420px] p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-[hsl(var(--gold))] flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <SheetTitle className="font-barlow text-base">Sam</SheetTitle>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">IA</Badge>
            </div>
            {messages.length > 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearChat}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="h-12 w-12 rounded-full bg-[hsl(var(--gold)/0.1)] flex items-center justify-center mx-auto mb-3">
                <Sparkles className="h-6 w-6 text-[hsl(var(--gold))]" />
              </div>
              <p className="font-barlow font-semibold text-sm">¡Hola! Soy Sam</p>
              <p className="text-xs text-muted-foreground font-dm mt-1 max-w-[280px] mx-auto">
                Tu asistente IA. Puedo ayudarte a crear clientes, proveedores, máquinas, registrar ingresos y gastos, y consultar datos.
              </p>
              <div className="mt-4 space-y-1.5">
                {[
                  'Crea un cliente llamado Solar Corp',
                  '¿Cuántas máquinas tenemos activas?',
                  'Registra un gasto de $500.000 en combustible',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                    className="block w-full text-left text-xs font-dm p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    💬 {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                'flex',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3 py-2 text-sm font-dm',
                  msg.role === 'user'
                    ? 'bg-[hsl(var(--gold))] text-white rounded-br-sm'
                    : 'bg-muted rounded-bl-sm'
                )}
              >
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          {error && (
            <div className="text-center">
              <p className="text-xs text-destructive font-dm">{error}</p>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border p-3 flex-shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un mensaje..."
              rows={1}
              className="flex-1 resize-none bg-muted rounded-xl px-3 py-2.5 text-sm font-dm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--gold))] max-h-[120px] min-h-[40px]"
              style={{ height: 'auto', overflow: 'hidden' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
            <Button
              size="icon"
              className="h-10 w-10 rounded-xl bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-bright))] text-white shrink-0"
              disabled={!input.trim() || isLoading}
              onClick={send}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
