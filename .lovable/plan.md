

## Plan: PWA + Cámara/Galería + Compresión + Agente IA "Sam"

### 1. PWA — App Instalable desde el Navegador

**Archivos**: `vite.config.ts`, `public/manifest.json`, `index.html`, `src/main.tsx`

- Instalar `vite-plugin-pwa` y configurar en `vite.config.ts` con `registerType: 'autoUpdate'`, manifest completo (nombre, iconos 192x512, colores), y `navigateFallbackDenylist: [/^\/~oauth/]`
- Ampliar `public/manifest.json` con iconos PWA (192x192 y 512x512) generados desde el logo existente
- Agregar meta tags PWA en `index.html` (apple-touch-icon, apple-mobile-web-app-capable)
- Registrar el service worker en `src/main.tsx`
- El `start_url` será `/preoperacional` para operarios (ya está), pero se puede cambiar a `/` para que el sistema redirija según rol

### 2. Cámara Directa + Galería en OT y Preoperacional

**Archivos**: `src/pages/MisOT.tsx`, `src/pages/PreoperacionalOperario.tsx`

Actualmente en MisOT el input ya tiene `capture="environment"`, pero solo permite cámara. Se cambiará a un selector dual:

- **Botón "Cámara"**: `<input type="file" accept="image/*" capture="environment">` — abre cámara directamente
- **Botón "Galería"**: `<input type="file" accept="image/*">` (sin capture) — abre selector de archivos/galería
- Ambos botones visibles en la zona de fotos de OT (antes/durante/después)
- En **Preoperacional**: agregar campo de foto en `ChecklistItem` cuando resultado es `malo` — botones cámara + galería para evidencia del daño. También en observaciones generales del Formato B

### 3. Compresión de Imágenes antes de Upload

**Archivo nuevo**: `src/lib/image-compress.ts`

```typescript
export async function compressImage(file: File, maxWidth = 1200, quality = 0.7): Promise<File>
```

- Usa Canvas API nativo del navegador (sin dependencias)
- Redimensiona a maxWidth manteniendo aspect ratio
- Comprime a JPEG con quality 0.7 (~70% reducción)
- Retorna nuevo File listo para upload
- Aplicar en: `handlePhotoUpload` de MisOT, uploads en PreoperacionalOperario, `MachinePhotoUpload.tsx`

### 4. Agente IA "Sam" — Panel Conversacional Lateral

Este es el componente más grande. Se implementará con Lovable AI Gateway.

**Archivos nuevos**:
- `supabase/functions/sam-agent/index.ts` — Edge function que conecta con Lovable AI Gateway
- `src/components/ai/SamChat.tsx` — Panel lateral derecho (sheet/drawer) con chat
- `src/components/ai/SamFAB.tsx` — Botón flotante para abrir Sam

**Edge Function `sam-agent`**:
- Usa `LOVABLE_API_KEY` (ya disponible) con modelo `google/gemini-2.5-pro` (el más potente para razonamiento complejo)
- System prompt con ingeniería de prompts completa:
  - Contexto: "Eres Sam, asistente IA de Up & Down Solar OS. Ayudas a gestionar maquinaria pesada, proyectos solares y mantenimiento."
  - Capacidades: crear clientes, proveedores, máquinas; registrar ingresos/gastos; consultar datos
  - Tool calling para operaciones CRUD: `create_client`, `create_supplier`, `create_machine`, `add_cost_entry`, `query_data`
- Cada tool ejecuta queries contra Supabase usando service role key con validación de tenant_id
- Streaming SSE para respuestas fluidas token por token

**Panel UI (`SamChat.tsx`)**:
- Sheet que se despliega desde la derecha (400px desktop, full width mobile)
- Header: avatar de Sam + nombre "Sam" + badge "IA"
- Área de mensajes con scroll, renderizado markdown (`react-markdown` no está instalado, se usará formato simple con `prose` classes)
- Input con envío por Enter y botón
- Mensajes del asistente con indicador de "escribiendo..."
- Cuando Sam ejecuta una acción (crear cliente, etc.), muestra tarjeta de confirmación en el chat

**Integración en AppLayout**:
- `SamFAB` visible en todas las páginas (botón flotante bottom-right con icono de chat/sparkle)
- Al click abre `SamChat` como Sheet desde la derecha
- Estado gestionado con useState en AppLayout

**Flujo de tool-calling**:
1. Usuario dice "Crea un cliente llamado Solar Corp, NIT 900123456"
2. Edge function envía a Lovable AI con tools definidas
3. AI responde con tool_call `create_client({name: "Solar Corp", tax_id: "900123456", ...})`
4. Edge function ejecuta el insert en Supabase, retorna resultado
5. AI responde "✅ Cliente Solar Corp creado exitosamente"
6. Frontend invalida queries relevantes para refrescar datos

**Tools disponibles para Sam**:
- `create_client` / `create_supplier` / `create_machine`
- `add_financial_entry` (ingreso o gasto con proyecto/máquina asociado)
- `query_machines` / `query_projects` / `query_clients` / `query_work_orders`
- `get_machine_status` / `get_project_financials`

### Archivos a crear:
- `src/lib/image-compress.ts`
- `src/components/ai/SamChat.tsx`
- `src/components/ai/SamFAB.tsx`
- `supabase/functions/sam-agent/index.ts`

### Archivos a modificar:
- `vite.config.ts` — agregar vite-plugin-pwa
- `public/manifest.json` — iconos completos
- `index.html` — meta tags PWA
- `src/pages/MisOT.tsx` — botones cámara/galería + compresión
- `src/pages/PreoperacionalOperario.tsx` — foto en items malos + compresión
- `src/components/machines/MachinePhotoUpload.tsx` — compresión
- `src/components/layout/AppLayout.tsx` — integrar SamFAB + SamChat
- `supabase/config.toml` — registrar function sam-agent

### Dependencias nuevas:
- `vite-plugin-pwa`

