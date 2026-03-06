import { useState, useRef, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, Sparkles, Loader2, Trash2, ImagePlus, Paperclip, History, ArrowLeft, Plus, Bot } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import { useLocation } from 'react-router-dom';

type Msg = { role: 'user' | 'assistant'; content: string; timestamp?: string };

type Conversation = {
  id: string;
  title: string;
  messages: Msg[];
  created_at: string;
  updated_at: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sam-agent`;

// Context-aware suggestions based on current route
function getSuggestions(pathname: string): string[] {
  const base = [
    '¿Qué puedes hacer?',
    '¿Cómo funciona la plataforma?',
  ];

  if (pathname.includes('/dashboard')) {
    return [
      '📊 Dame un resumen del estado de la flota',
      '⚠️ ¿Cuántas alertas tenemos pendientes?',
      '🔧 ¿Cuántas OTs están abiertas?',
      ...base,
    ];
  }
  if (pathname.includes('/maquinas')) {
    return [
      '🚜 ¿Cuántas máquinas tenemos activas?',
      '➕ Crea una nueva máquina',
      '🔍 Busca máquinas disponibles en bodega',
      '📋 ¿Cómo configuro alertas de mantenimiento?',
    ];
  }
  if (pathname.includes('/ordenes') || pathname.includes('/mis-ot')) {
    return [
      '🔧 ¿Cuántas OTs están en curso?',
      '📝 ¿Cómo creo una orden de trabajo?',
      '⏱️ ¿Cómo funciona el cronómetro de OT?',
      '📊 Muéstrame las OTs de esta semana',
    ];
  }
  if (pathname.includes('/clientes')) {
    return [
      '👥 ¿Cuántos clientes tenemos?',
      '➕ Crea un nuevo cliente',
      '🔍 Busca un cliente específico',
      '📋 ¿Cómo asocio un cliente a un proyecto?',
    ];
  }
  if (pathname.includes('/proveedores')) {
    return [
      '🏭 Lista los proveedores activos',
      '➕ Registra un nuevo proveedor',
      '⭐ ¿Cómo califico a un proveedor?',
    ];
  }
  if (pathname.includes('/proyectos')) {
    return [
      '📁 ¿Cuántos proyectos están activos?',
      '📊 ¿Cómo veo el presupuesto de un proyecto?',
      '🚜 ¿Cómo asigno máquinas a un proyecto?',
    ];
  }
  if (pathname.includes('/inventario')) {
    return [
      '📦 ¿Qué ítems tienen stock bajo?',
      '🔧 ¿Cómo registro un movimiento de inventario?',
      '📋 ¿Cómo funcionan los kits de herramientas?',
    ];
  }
  if (pathname.includes('/financiero')) {
    return [
      '💰 Registra un ingreso de $5.000.000',
      '📊 ¿Cuál es el resumen financiero del mes?',
      '💸 Registra un gasto de combustible',
      '📥 ¿Cómo importo datos desde Excel?',
    ];
  }
  if (pathname.includes('/preoperacional')) {
    return [
      '📋 ¿Cómo hago un preoperacional?',
      '⚠️ ¿Qué pasa si hay fallas críticas?',
      '📱 ¿Funciona sin internet?',
    ];
  }
  if (pathname.includes('/configuracion')) {
    return [
      '⚙️ ¿Cómo creo un nuevo usuario?',
      '🔔 ¿Cómo configuro las alertas?',
      '👥 ¿Qué roles existen en el sistema?',
    ];
  }
  return [
    '🚜 ¿Cuántas máquinas tenemos?',
    '➕ Crea un cliente nuevo',
    '💰 Registra un gasto',
    ...base,
  ];
}

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
      body: JSON.stringify({
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        tenant_id: tenantId,
        user_id: userId,
      }),
    });

    if (resp.status === 429) { onError('⏳ Demasiadas solicitudes. Intenta en unos segundos.'); return; }
    if (resp.status === 402) { onError('💳 Créditos agotados. Contacta al administrador.'); return; }
    if (!resp.ok || !resp.body) { onError('❌ Error al conectar con Sam.'); return; }

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
  } catch {
    onError('🔌 Error de conexión con Sam.');
  }
}

// Generate a short title from the first user message
function generateTitle(msg: string): string {
  const clean = msg.replace(/[^\w\sáéíóúñ¿¡]/gi, '').trim();
  return clean.length > 40 ? clean.slice(0, 40) + '...' : clean || 'Nueva conversación';
}

export function SamChat({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const location = useLocation();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Conversation history
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Follow-up suggestions after assistant response
  const [followUps, setFollowUps] = useState<string[]>([]);

  const suggestions = getSuggestions(location.pathname);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, followUps]);

  // Focus input on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  // Load conversations on open
  useEffect(() => {
    if (open && user) loadConversations();
  }, [open, user]);

  const loadConversations = async () => {
    if (!user) return;
    setLoadingHistory(true);
    const { data } = await supabase
      .from('sam_conversations')
      .select('id, title, messages, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(20);
    if (data) setConversations(data as any);
    setLoadingHistory(false);
  };

  const saveConversation = useCallback(async (msgs: Msg[], convId: string | null) => {
    if (!user || msgs.length === 0) return;
    const title = generateTitle(msgs.find(m => m.role === 'user')?.content || '');

    if (convId) {
      await supabase
        .from('sam_conversations')
        .update({ messages: msgs as any, title, updated_at: new Date().toISOString() })
        .eq('id', convId);
    } else {
      const { data } = await supabase
        .from('sam_conversations')
        .insert({ user_id: user.id, tenant_id: user.tenant_id, messages: msgs as any, title })
        .select('id')
        .single();
      if (data) setActiveConvId(data.id);
    }
  }, [user]);

  // Generate follow-up suggestions based on last assistant message
  const generateFollowUps = (lastAssistantMsg: string) => {
    const lower = lastAssistantMsg.toLowerCase();
    const suggestions: string[] = [];

    if (lower.includes('cliente') || lower.includes('creado')) {
      suggestions.push('📋 Muéstrame todos los clientes', '➕ Crea otro cliente');
    }
    if (lower.includes('máquina') || lower.includes('equipo')) {
      suggestions.push('🔧 Ver estado de la flota', '📊 Costos de mantenimiento');
    }
    if (lower.includes('gasto') || lower.includes('ingreso') || lower.includes('registrado')) {
      suggestions.push('📊 Resumen financiero', '💰 Registrar otro movimiento');
    }
    if (lower.includes('proveedor')) {
      suggestions.push('📋 Ver todos los proveedores', '⭐ Calificar proveedor');
    }
    if (lower.includes('orden de trabajo') || lower.includes('ot ')) {
      suggestions.push('📋 OTs pendientes', '➕ Crear nueva OT');
    }
    if (lower.includes('ayud') || lower.includes('soporte') || lower.includes('plataforma')) {
      suggestions.push('👥 ¿Qué roles existen?', '📱 ¿Cómo instalo la app?', '📋 ¿Cómo hago un preoperacional?');
    }

    if (suggestions.length === 0) {
      suggestions.push('📊 Resumen general', '❓ ¿Qué más puedes hacer?');
    }

    setFollowUps(suggestions.slice(0, 3));
  };

  const send = async (overrideText?: string) => {
    const text = (overrideText || input).trim();
    if (!text || isLoading || !user) return;

    const userMsg: Msg = { role: 'user', content: text, timestamp: new Date().toISOString() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setError('');
    setFollowUps([]);

    let assistantSoFar = '';
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { role: 'assistant', content: assistantSoFar, timestamp: new Date().toISOString() }];
      });
    };

    await streamChat({
      messages: newMessages,
      tenantId: user.tenant_id,
      userId: user.id,
      onDelta: (chunk) => upsertAssistant(chunk),
      onDone: () => {
        setIsLoading(false);
        qc.invalidateQueries({ queryKey: ['clients'] });
        qc.invalidateQueries({ queryKey: ['suppliers'] });
        qc.invalidateQueries({ queryKey: ['machines'] });
        qc.invalidateQueries({ queryKey: ['cost-entries'] });

        // Save & generate follow-ups after state updates
        setTimeout(() => {
          setMessages(current => {
            const finalMsgs = [...current];
            saveConversation(finalMsgs, activeConvId);
            const lastAssistant = finalMsgs.filter(m => m.role === 'assistant').pop();
            if (lastAssistant) generateFollowUps(lastAssistant.content);
            return current;
          });
        }, 100);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Upload to storage and send as message
    const ext = file.name.split('.').pop();
    const path = `sam-uploads/${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(path, file);

    if (uploadError) {
      setError('Error al subir archivo');
      return;
    }

    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
    const fileMsg = file.type.startsWith('image/')
      ? `[Imagen adjunta: ${file.name}](${urlData.publicUrl})`
      : `[Archivo adjunto: ${file.name}](${urlData.publicUrl})`;

    send(fileMsg);
    e.target.value = '';
  };

  const newChat = () => {
    setMessages([]);
    setActiveConvId(null);
    setError('');
    setFollowUps([]);
    setShowHistory(false);
  };

  const loadConversation = (conv: Conversation) => {
    setMessages(conv.messages);
    setActiveConvId(conv.id);
    setShowHistory(false);
    setFollowUps([]);
  };

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('sam_conversations').delete().eq('id', convId);
    setConversations(prev => prev.filter(c => c.id !== convId));
    if (activeConvId === convId) newChat();
  };

  // History view
  if (showHistory) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-[420px] p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowHistory(false)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <SheetTitle className="font-barlow text-base">Historial</SheetTitle>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loadingHistory && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loadingHistory && conversations.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">No hay conversaciones guardadas</p>
            )}
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv)}
                className={cn(
                  'w-full text-left p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors group',
                  activeConvId === conv.id && 'bg-muted border-[hsl(var(--gold)/0.3)]'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-dm font-medium truncate">{conv.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(conv.updated_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {' · '}{(conv.messages || []).length} msgs
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={(e) => deleteConversation(conv.id, e)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </button>
            ))}
          </div>

          <div className="p-3 border-t border-border">
            <Button onClick={newChat} className="w-full bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-bright))] text-white">
              <Plus className="h-4 w-4 mr-2" /> Nueva conversación
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

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
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">GPT-5.2</Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { loadConversations(); setShowHistory(true); }}>
                <History className="h-3.5 w-3.5" />
              </Button>
              {messages.length > 0 && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={newChat}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="py-8">
              <div className="text-center mb-6">
                <div className="h-14 w-14 rounded-2xl bg-[hsl(var(--gold)/0.1)] flex items-center justify-center mx-auto mb-3 rotate-3">
                  <Bot className="h-7 w-7 text-[hsl(var(--gold))]" />
                </div>
                <p className="font-barlow font-bold text-lg">¡Hola! Soy Sam 🤖</p>
                <p className="text-xs text-muted-foreground font-dm mt-1 max-w-[280px] mx-auto leading-relaxed">
                  Tu asistente IA con GPT-5.2. Puedo ayudarte a gestionar la plataforma, crear registros, consultar datos y darte soporte técnico.
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-dm font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
                  Sugerencias
                </p>
                {suggestions.slice(0, 4).map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => send(suggestion)}
                    className="block w-full text-left text-[13px] font-dm p-2.5 rounded-xl border border-border hover:bg-[hsl(var(--gold)/0.05)] hover:border-[hsl(var(--gold)/0.3)] transition-all duration-150"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                'flex gap-2',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {msg.role === 'assistant' && (
                <div className="h-6 w-6 rounded-full bg-[hsl(var(--gold)/0.15)] flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="h-3 w-3 text-[hsl(var(--gold))]" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm',
                  msg.role === 'user'
                    ? 'bg-[hsl(var(--gold))] text-white rounded-br-md'
                    : 'bg-muted rounded-bl-md'
                )}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none font-dm [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&>h1]:font-barlow [&>h2]:font-barlow [&>h3]:font-barlow [&>table]:text-xs [&>pre]:text-xs [&>blockquote]:border-l-[hsl(var(--gold))] [&_strong]:text-foreground [&_a]:text-[hsl(var(--gold))]">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words font-dm">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-2 items-start">
              <div className="h-6 w-6 rounded-full bg-[hsl(var(--gold)/0.15)] flex items-center justify-center shrink-0">
                <Sparkles className="h-3 w-3 text-[hsl(var(--gold))] animate-pulse" />
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-md px-3.5 py-2.5">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="text-center">
              <p className="text-xs text-destructive font-dm bg-destructive/10 rounded-lg py-2 px-3">{error}</p>
            </div>
          )}

          {/* Follow-up suggestions */}
          {followUps.length > 0 && !isLoading && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[10px] font-dm text-muted-foreground uppercase tracking-wider">Continuar con...</p>
              {followUps.map((fu) => (
                <button
                  key={fu}
                  onClick={() => { setFollowUps([]); send(fu); }}
                  className="block w-full text-left text-[12px] font-dm p-2 rounded-lg border border-border/60 hover:bg-[hsl(var(--gold)/0.05)] hover:border-[hsl(var(--gold)/0.3)] transition-all"
                >
                  {fu}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border p-3 flex-shrink-0">
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              onChange={handleFileUpload}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
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
              onClick={() => send()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
