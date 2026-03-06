import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres Sam, asistente IA de **Up & Down App** — la plataforma integral de gestión para empresas de maquinaria pesada, proyectos de energía solar, mantenimiento industrial y alquiler de equipos.

## Tu personalidad
- Profesional, conciso y amigable
- Respondes en español colombiano
- Usas emojis con moderación para confirmar acciones (✅, ⚠️, 📊)
- Cuando creas algo, confirmas con los datos creados
- Cuando consultas, presentas la información de forma clara y organizada
- Eres también soporte técnico: ayudas a los usuarios a entender cómo usar la plataforma

## ⚠️ REGLA CRÍTICA: SIEMPRE USA HERRAMIENTAS ANTES DE RESPONDER

**NUNCA respondas preguntas sobre datos sin consultar primero la base de datos.**

Cuando el usuario pregunte sobre cantidades, estados, listados o cualquier dato del sistema:
1. PRIMERO usa la herramienta correspondiente para consultar los datos reales
2. DESPUÉS presenta la información basándote en los resultados reales
3. NUNCA asumas que algo está vacío o que no hay datos — SIEMPRE verifica con la herramienta

Ejemplos de cuándo DEBES usar herramientas:
- "¿Cuántas OTs hay?" → usa query_data con entity "work_orders"
- "¿Cuántas máquinas tenemos?" → usa query_data con entity "machines"  
- "¿Qué clientes tenemos?" → usa query_data con entity "clients"
- "Dame un resumen" → usa dashboard_summary
- "¿Hay alertas?" → usa query_data con entity "alerts"
- "¿Cuánto hemos gastado?" → usa query_data con entity "cost_entries"

**Si no usas una herramienta cuando hay datos disponibles, estás dando información incorrecta.**

## Capacidades operativas
Tienes acceso a herramientas para:
1. **dashboard_summary** — Obtener un resumen completo del estado actual (máquinas, OTs, alertas, proyectos)
2. **query_data** — Consultar cualquier entidad con filtros por estado, nombre, fechas
3. **create_client** — Crear un nuevo cliente
4. **create_supplier** — Crear un nuevo proveedor
5. **create_machine** — Crear una nueva máquina
6. **add_financial_entry** — Registrar ingresos o gastos

## Reglas operativas
- SIEMPRE consulta la base de datos antes de dar cualquier dato numérico o listado
- SIEMPRE pide confirmación antes de crear/modificar datos
- Si falta información obligatoria, pregunta al usuario
- Para gastos/ingresos, siempre asocia a una máquina o proyecto si es posible
- Nunca inventes datos, usa solo lo que el usuario proporciona o lo que retornan las herramientas
- Si no puedes hacer algo, explica por qué y sugiere alternativas

---

# 📘 GUÍA COMPLETA DEL SISTEMA — Up & Down App

Usa esta guía como referencia para ayudar a los usuarios con soporte técnico, explicarles funcionalidades y guiarlos paso a paso.

---

## 1. VISIÓN GENERAL

Up & Down App es un sistema de gestión empresarial (ERP) diseñado para empresas que operan con maquinaria pesada, especialmente en los sectores de energía solar, construcción y alquiler de equipos. La plataforma centraliza la administración de:
- Flota de maquinaria
- Órdenes de trabajo y mantenimiento
- Proyectos y obras
- Clientes y proveedores
- Personal técnico y operarios
- Inventario de repuestos y herramientas
- Finanzas y rentabilidad
- Inspecciones preoperacionales

## 2. ROLES Y PERMISOS

El sistema maneja 5 roles con diferentes niveles de acceso:

| Rol | Acceso |
|-----|--------|
| **Superadmin** | Acceso total a todos los módulos, configuración y auditoría |
| **Gerente** | Dashboard, analytics, finanzas, configuración, todos los módulos operativos |
| **Supervisor** | Gestión operativa: máquinas, proyectos, OTs, personal, inventario, preoperacionales |
| **Técnico** | Solo ve sus propias Órdenes de Trabajo asignadas (Mis OT) |
| **Operario** | Solo puede realizar inspecciones preoperacionales desde campo |

**Cómo explicar los roles a usuarios:**
- Si un usuario no ve un módulo, es porque su rol no tiene permiso. Explícale qué rol se necesita.
- Solo Superadmin y Gerente pueden acceder a Configuración y Analytics.
- Los técnicos solo ven "Mis OT" con las órdenes que les han asignado.

## 3. MÓDULOS DEL SISTEMA

### 3.1 Dashboard (Superadmin, Gerente, Supervisor)
Vista ejecutiva con indicadores clave en tiempo real:
- **KPIs principales**: Total máquinas, máquinas activas en campo, OTs abiertas, alertas pendientes
- **Estado de la flota**: Distribución visual por estado (activa en campo, disponible en bodega, dañada, varada)
- **Alertas activas**: Notificaciones de mantenimiento preventivo, horómetro y documentos por vencer
- **Actividad reciente**: Timeline de las últimas acciones en el sistema

### 3.2 Máquinas (Superadmin, Gerente, Supervisor)
Módulo central de gestión de flota con tres vistas:
- **Vista Tarjetas**: Cards visuales con foto, estado, horómetro y proyecto actual
- **Vista Lista**: Tabla con columnas ordenables y filtros avanzados
- **Vista Kanban**: Tablero drag-like organizado por estado de la máquina

**Estados de máquina:**
- 🟢 activa_en_campo — Operando en un proyecto
- 🔵 disponible_bodega — Lista para asignar
- 🟡 en_campo_dañada — En proyecto pero requiere reparación
- 🔴 varada_bodega — Fuera de servicio

**Crear una máquina**: Clic en "Nueva Máquina" → llenar nombre, código interno (obligatorio, ej: MH-001), tipo, marca, modelo.

**Detalle de máquina** (clic en una máquina):
- Ficha técnica, estado y condición, historial de OTs, preoperacionales, documentos, fotos, alertas de mantenimiento, hoja de vida PDF

### 3.3 Órdenes de Trabajo - OT (Superadmin, Gerente, Supervisor)
Gestión completa del ciclo de mantenimiento:

**Tipos de OT:** preventivo, correctivo, inspeccion, preparacion

**Estados del flujo:** creada → asignada → en_curso → pausada ↔ en_curso → cerrada → firmada

**Dentro de una OT**: Asignar técnicos, registrar repuestos, cronómetro de tiempos, fotos de evidencia, herramientas, costos automáticos, firma digital.

### 3.4 a 3.13 — Otros módulos
Mis OT (Técnico), Preoperacionales, Clientes, Proveedores, Personal, Proyectos, Inventario (Consumibles + Herramientas + Kits), Financiero, Analytics, Configuración.

## 4. ALERTAS Y NOTIFICACIONES
- ⚠️ Mantenimiento por horómetro
- 📅 Mantenimiento por calendario
- 📄 Documentos por vencer
- 📦 Stock bajo
- 🔴 Fallas críticas en preoperacionales

## 5. PWA Y USO MÓVIL
Up & Down App es una Progressive Web App instalable en celulares. Los preoperacionales funcionan offline.

## 6. SOPORTE FRECUENTE

**P: ¿Por qué no veo un módulo?** R: Tu rol no tiene acceso. Solo Superadmin/Gerente ven todo.
**P: ¿Cómo cambio el estado de una máquina?** R: Máquinas → clic en la máquina → selector de estado.
**P: ¿Cómo asigno una máquina a un proyecto?** R: Proyectos → proyecto → pestaña Máquinas → Asignar.
**P: ¿Cómo genero la hoja de vida?** R: Máquinas → detalle → botón "Hoja de Vida PDF".
**P: ¿Cómo configuro alertas?** R: Máquinas → detalle → pestaña Alertas → Nueva alerta.
**P: ¿Puedo usar la app sin internet?** R: Sí, los preoperacionales funcionan offline.
**P: ¿Cómo creo un usuario?** R: Configuración → Usuarios → Nuevo usuario.
**P: ¿Cómo veo costos de una máquina?** R: Máquinas → detalle → pestaña Financiero.
**P: ¿Cómo exporto datos?** R: Botón exportar en las tablas genera Excel/CSV.

## 7. TERMINOLOGÍA
- **OT**: Orden de Trabajo
- **Preop**: Inspección diaria antes de operar
- **Horómetro**: Contador de horas de operación
- **KPI**: Indicador clave de rendimiento
- **ROI**: Retorno sobre la inversión
`;

// Tool definitions for the AI model
const tools = [
  {
    type: "function",
    function: {
      name: "dashboard_summary",
      description: "Obtener un resumen completo del estado actual del sistema: conteo de máquinas por estado, OTs por estado, alertas pendientes, proyectos activos, inventario bajo. SIEMPRE usa esta herramienta cuando el usuario pida un resumen o pregunte por el estado general.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_data",
      description: "Consultar datos del sistema. OBLIGATORIO usarla siempre que el usuario pregunte por cantidades, listados, estados o cualquier dato. Soporta filtrar por estado, nombre, tipo, prioridad, etc.",
      parameters: {
        type: "object",
        properties: {
          entity: {
            type: "string",
            enum: ["machines", "clients", "suppliers", "projects", "work_orders", "alerts", "personnel", "inventory", "cost_entries", "preop_records"],
            description: "Tipo de entidad a consultar",
          },
          status_filter: {
            type: "string",
            description: "Filtrar por estado específico. Para OTs: creada, asignada, en_curso, pausada, cerrada, firmada. Para máquinas: activa_en_campo, disponible_bodega, en_campo_dañada, varada_bodega. Para proyectos: prospecto, aprobado, activo, en_curso, pausado, finalizado, cancelado. Para alertas: usar 'pendiente' para no resueltas o 'resuelta' para resueltas.",
          },
          name_filter: { type: "string", description: "Filtro de búsqueda por nombre, código o descripción" },
          type_filter: { type: "string", description: "Filtrar por tipo (para OTs: preventivo, correctivo, inspeccion, preparacion)" },
          priority_filter: { type: "string", description: "Filtrar por prioridad (baja, normal, alta, critica)" },
          date_from: { type: "string", description: "Fecha inicio para filtrar (YYYY-MM-DD)" },
          date_to: { type: "string", description: "Fecha fin para filtrar (YYYY-MM-DD)" },
          limit: { type: "number", description: "Cantidad máxima de resultados (default 20)" },
        },
        required: ["entity"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_client",
      description: "Crear un nuevo cliente en el sistema",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nombre del cliente o empresa" },
          tax_id: { type: "string", description: "NIT o documento fiscal" },
          contact_name: { type: "string", description: "Nombre de contacto" },
          contact_email: { type: "string", description: "Email de contacto" },
          contact_phone: { type: "string", description: "Teléfono de contacto" },
          city: { type: "string", description: "Ciudad" },
          type: { type: "string", enum: ["empresa", "persona"], description: "Tipo de cliente" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_supplier",
      description: "Crear un nuevo proveedor en el sistema",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nombre del proveedor" },
          specialty: { type: "string", description: "Especialidad o tipo de servicio" },
          contact_name: { type: "string", description: "Nombre de contacto" },
          contact_phone: { type: "string", description: "Teléfono" },
          contact_email: { type: "string", description: "Email" },
          city: { type: "string", description: "Ciudad" },
          tax_id: { type: "string", description: "NIT" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_machine",
      description: "Crear una nueva máquina en el sistema",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nombre de la máquina" },
          internal_code: { type: "string", description: "Código interno" },
          type: {
            type: "string",
            enum: ["grua_telescopica", "grua_pluma", "montacargas", "manlift", "camion_grua", "vehiculo", "otro"],
            description: "Tipo de máquina",
          },
          brand: { type: "string", description: "Marca" },
          model: { type: "string", description: "Modelo" },
          year: { type: "number", description: "Año de fabricación" },
          serial_number: { type: "string", description: "Número de serie" },
        },
        required: ["name", "internal_code", "type"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_financial_entry",
      description: "Registrar un ingreso o gasto financiero",
      parameters: {
        type: "object",
        properties: {
          entry_type: { type: "string", enum: ["ingreso", "gasto"], description: "Tipo de movimiento" },
          amount: { type: "number", description: "Monto en COP" },
          description: { type: "string", description: "Descripción del movimiento" },
          cost_type: { type: "string", description: "Categoría (combustible, repuestos, alquiler, etc.)" },
          machine_name: { type: "string", description: "Nombre o código de la máquina asociada (opcional)" },
          project_name: { type: "string", description: "Nombre del proyecto asociado (opcional)" },
        },
        required: ["entry_type", "amount", "description"],
        additionalProperties: false,
      },
    },
  },
];

// Execute tool calls against Supabase
async function executeTool(
  toolName: string,
  args: Record<string, any>,
  tenantId: string,
  userId: string
): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    switch (toolName) {

      case "dashboard_summary": {
        // Fetch all key metrics in parallel
        const [
          machinesRes,
          otRes,
          alertsRes,
          projectsRes,
          inventoryRes,
          personnelRes,
        ] = await Promise.all([
          supabase.from("machines").select("status", { count: "exact" }).eq("tenant_id", tenantId).eq("active", true),
          supabase.from("work_orders").select("status", { count: "exact" }).eq("tenant_id", tenantId),
          supabase.from("alerts").select("severity, type", { count: "exact" }).eq("tenant_id", tenantId).eq("resolved", false),
          supabase.from("projects").select("status", { count: "exact" }).eq("tenant_id", tenantId),
          supabase.from("inventory_consumables").select("name, stock_current, stock_minimum").eq("tenant_id", tenantId).eq("active", true),
          supabase.from("personnel").select("type, status").eq("tenant_id", tenantId),
        ]);

        // Count machines by status
        const machines = machinesRes.data || [];
        const machinesByStatus: Record<string, number> = {};
        machines.forEach((m: any) => { machinesByStatus[m.status] = (machinesByStatus[m.status] || 0) + 1; });

        // Count OTs by status
        const ots = otRes.data || [];
        const otsByStatus: Record<string, number> = {};
        ots.forEach((o: any) => { otsByStatus[o.status] = (otsByStatus[o.status] || 0) + 1; });

        // Alerts
        const alerts = alertsRes.data || [];
        const alertsBySeverity: Record<string, number> = {};
        alerts.forEach((a: any) => { alertsBySeverity[a.severity] = (alertsBySeverity[a.severity] || 0) + 1; });

        // Projects by status
        const projects = projectsRes.data || [];
        const projectsByStatus: Record<string, number> = {};
        projects.forEach((p: any) => { projectsByStatus[p.status] = (projectsByStatus[p.status] || 0) + 1; });

        // Low stock items
        const inventory = inventoryRes.data || [];
        const lowStock = inventory.filter((i: any) => i.stock_current <= i.stock_minimum);

        // Personnel
        const personnel = personnelRes.data || [];
        const activePersonnel = personnel.filter((p: any) => p.status === 'activo');

        const summary = {
          maquinas: {
            total: machines.length,
            por_estado: machinesByStatus,
          },
          ordenes_trabajo: {
            total: ots.length,
            por_estado: otsByStatus,
            abiertas: (otsByStatus['creada'] || 0) + (otsByStatus['asignada'] || 0) + (otsByStatus['en_curso'] || 0) + (otsByStatus['pausada'] || 0),
          },
          alertas_pendientes: {
            total: alerts.length,
            por_severidad: alertsBySeverity,
          },
          proyectos: {
            total: projects.length,
            por_estado: projectsByStatus,
          },
          inventario_bajo_stock: lowStock.map((i: any) => ({ nombre: i.name, actual: i.stock_current, minimo: i.stock_minimum })),
          personal: {
            total: personnel.length,
            activos: activePersonnel.length,
            tecnicos: activePersonnel.filter((p: any) => p.type === 'tecnico').length,
            operarios: activePersonnel.filter((p: any) => p.type === 'operario').length,
          },
        };

        return `📊 Resumen del sistema:\n${JSON.stringify(summary, null, 2)}`;
      }

      case "create_client": {
        const { data, error } = await supabase
          .from("clients")
          .insert([{ ...args, tenant_id: tenantId, created_by: userId }])
          .select()
          .single();
        if (error) return `Error al crear cliente: ${error.message}`;
        return `✅ Cliente "${data.name}" creado exitosamente (ID: ${data.id})`;
      }

      case "create_supplier": {
        const { data, error } = await supabase
          .from("suppliers")
          .insert([{ ...args, tenant_id: tenantId }])
          .select()
          .single();
        if (error) return `Error al crear proveedor: ${error.message}`;
        return `✅ Proveedor "${data.name}" creado exitosamente (ID: ${data.id})`;
      }

      case "create_machine": {
        const { data, error } = await supabase
          .from("machines")
          .insert([{ ...args, tenant_id: tenantId }])
          .select()
          .single();
        if (error) return `Error al crear máquina: ${error.message}`;
        return `✅ Máquina "${data.name}" [${data.internal_code}] creada exitosamente`;
      }

      case "add_financial_entry": {
        let machineId = null;
        let projectId = null;

        if (args.machine_name) {
          const { data: machines } = await supabase
            .from("machines")
            .select("id, name")
            .eq("tenant_id", tenantId)
            .or(`name.ilike.%${args.machine_name}%,internal_code.ilike.%${args.machine_name}%`)
            .limit(1);
          if (machines?.length) machineId = machines[0].id;
        }

        if (args.project_name) {
          const { data: projects } = await supabase
            .from("projects")
            .select("id, name")
            .eq("tenant_id", tenantId)
            .ilike("name", `%${args.project_name}%`)
            .limit(1);
          if (projects?.length) projectId = projects[0].id;
        }

        const { data, error } = await supabase
          .from("cost_entries")
          .insert([{
            tenant_id: tenantId,
            entry_type: args.entry_type,
            amount: args.amount,
            description: args.description,
            cost_type: args.cost_type || "general",
            machine_id: machineId,
            project_id: projectId,
            source: "sam_agent",
            cost_date: new Date().toISOString().split("T")[0],
            created_by: userId,
          }])
          .select()
          .single();
        if (error) return `Error al registrar: ${error.message}`;
        return `✅ ${args.entry_type === "ingreso" ? "Ingreso" : "Gasto"} de $${Number(args.amount).toLocaleString("es-CO")} registrado — "${args.description}"`;
      }

      case "query_data": {
        const limit = args.limit || 20;
        const entity = args.entity;

        switch (entity) {
          case "machines": {
            let query = supabase
              .from("machines")
              .select("name, internal_code, type, status, horometer_current, brand, model, current_project_id")
              .eq("tenant_id", tenantId)
              .eq("active", true);
            if (args.status_filter) query = query.eq("status", args.status_filter);
            if (args.type_filter) query = query.eq("type", args.type_filter);
            if (args.name_filter) query = query.or(`name.ilike.%${args.name_filter}%,internal_code.ilike.%${args.name_filter}%`);
            const { data, error } = await query.limit(limit);
            if (error) return `Error: ${error.message}`;
            
            // Also provide counts by status for context
            const { data: allMachines } = await supabase
              .from("machines")
              .select("status")
              .eq("tenant_id", tenantId)
              .eq("active", true);
            const counts: Record<string, number> = {};
            (allMachines || []).forEach((m: any) => { counts[m.status] = (counts[m.status] || 0) + 1; });
            
            return `Total máquinas activas: ${allMachines?.length || 0}\nDistribución por estado: ${JSON.stringify(counts)}\n\nResultados (${data?.length || 0}):\n${JSON.stringify(data, null, 2)}`;
          }

          case "work_orders": {
            let query = supabase
              .from("work_orders")
              .select("code, type, status, priority, problem_description, created_at, closed_at, total_cost, actual_hours")
              .eq("tenant_id", tenantId)
              .order("created_at", { ascending: false });
            if (args.status_filter) query = query.eq("status", args.status_filter);
            if (args.type_filter) query = query.eq("type", args.type_filter);
            if (args.priority_filter) query = query.eq("priority", args.priority_filter);
            if (args.name_filter) query = query.or(`code.ilike.%${args.name_filter}%,problem_description.ilike.%${args.name_filter}%`);
            if (args.date_from) query = query.gte("created_at", args.date_from);
            if (args.date_to) query = query.lte("created_at", args.date_to + "T23:59:59");
            const { data, error } = await query.limit(limit);
            if (error) return `Error: ${error.message}`;
            
            // Also get counts by status
            const { data: allOts } = await supabase
              .from("work_orders")
              .select("status")
              .eq("tenant_id", tenantId);
            const counts: Record<string, number> = {};
            (allOts || []).forEach((o: any) => { counts[o.status] = (counts[o.status] || 0) + 1; });
            const abiertas = (counts['creada'] || 0) + (counts['asignada'] || 0) + (counts['en_curso'] || 0) + (counts['pausada'] || 0);
            
            return `Total OTs: ${allOts?.length || 0}\nAbiertas (no cerradas/firmadas): ${abiertas}\nPor estado: ${JSON.stringify(counts)}\n\nResultados filtrados (${data?.length || 0}):\n${JSON.stringify(data, null, 2)}`;
          }

          case "clients": {
            let query = supabase.from("clients").select("name, tax_id, contact_name, contact_email, contact_phone, city, status, type").eq("tenant_id", tenantId);
            if (args.status_filter) query = query.eq("status", args.status_filter);
            if (args.name_filter) query = query.or(`name.ilike.%${args.name_filter}%,contact_name.ilike.%${args.name_filter}%`);
            const { data, error, count } = await query.limit(limit);
            if (error) return `Error: ${error.message}`;
            const { count: total } = await supabase.from("clients").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
            return `Total clientes: ${total || 0}\nResultados (${data?.length || 0}):\n${JSON.stringify(data, null, 2)}`;
          }

          case "suppliers": {
            let query = supabase.from("suppliers").select("name, specialty, contact_name, contact_phone, city, status, rating, type").eq("tenant_id", tenantId);
            if (args.status_filter) query = query.eq("status", args.status_filter);
            if (args.name_filter) query = query.or(`name.ilike.%${args.name_filter}%,specialty.ilike.%${args.name_filter}%`);
            const { data, error } = await query.limit(limit);
            if (error) return `Error: ${error.message}`;
            const { count: total } = await supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
            return `Total proveedores: ${total || 0}\nResultados (${data?.length || 0}):\n${JSON.stringify(data, null, 2)}`;
          }

          case "projects": {
            let query = supabase.from("projects").select("name, status, city, budget, start_date, end_date_estimated, description").eq("tenant_id", tenantId);
            if (args.status_filter) query = query.eq("status", args.status_filter);
            if (args.name_filter) query = query.ilike("name", `%${args.name_filter}%`);
            const { data, error } = await query.limit(limit);
            if (error) return `Error: ${error.message}`;
            const { count: total } = await supabase.from("projects").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
            return `Total proyectos: ${total || 0}\nResultados (${data?.length || 0}):\n${JSON.stringify(data, null, 2)}`;
          }

          case "alerts": {
            let query = supabase.from("alerts").select("type, severity, message, machine_id, created_at, resolved").eq("tenant_id", tenantId);
            if (args.status_filter === 'pendiente') query = query.eq("resolved", false);
            else if (args.status_filter === 'resuelta') query = query.eq("resolved", true);
            else query = query.eq("resolved", false); // default: show pending
            query = query.order("created_at", { ascending: false });
            const { data, error } = await query.limit(limit);
            if (error) return `Error: ${error.message}`;
            const { count: pendientes } = await supabase.from("alerts").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("resolved", false);
            return `Alertas pendientes: ${pendientes || 0}\nResultados (${data?.length || 0}):\n${JSON.stringify(data, null, 2)}`;
          }

          case "personnel": {
            let query = supabase.from("personnel").select("full_name, type, specialty, phone, email, status, hourly_rate").eq("tenant_id", tenantId);
            if (args.status_filter) query = query.eq("status", args.status_filter);
            if (args.type_filter) query = query.eq("type", args.type_filter);
            if (args.name_filter) query = query.ilike("full_name", `%${args.name_filter}%`);
            const { data, error } = await query.limit(limit);
            if (error) return `Error: ${error.message}`;
            const { count: total } = await supabase.from("personnel").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
            return `Total personal: ${total || 0}\nResultados (${data?.length || 0}):\n${JSON.stringify(data, null, 2)}`;
          }

          case "inventory": {
            let query = supabase.from("inventory_consumables").select("name, category, unit, stock_current, stock_minimum, unit_cost").eq("tenant_id", tenantId).eq("active", true);
            if (args.name_filter) query = query.ilike("name", `%${args.name_filter}%`);
            const { data, error } = await query.limit(limit);
            if (error) return `Error: ${error.message}`;
            const lowStock = (data || []).filter((i: any) => i.stock_current <= i.stock_minimum);
            return `Total items: ${data?.length || 0}\nItems con stock bajo: ${lowStock.length}\n${lowStock.length > 0 ? `⚠️ Bajo stock: ${lowStock.map((i: any) => `${i.name} (${i.stock_current}/${i.stock_minimum})`).join(', ')}` : ''}\n\nResultados:\n${JSON.stringify(data, null, 2)}`;
          }

          case "cost_entries": {
            let query = supabase.from("cost_entries").select("entry_type, amount, description, cost_type, cost_date, source").eq("tenant_id", tenantId).order("cost_date", { ascending: false });
            if (args.type_filter) query = query.eq("entry_type", args.type_filter);
            if (args.date_from) query = query.gte("cost_date", args.date_from);
            if (args.date_to) query = query.lte("cost_date", args.date_to);
            if (args.name_filter) query = query.ilike("description", `%${args.name_filter}%`);
            const { data, error } = await query.limit(limit);
            if (error) return `Error: ${error.message}`;
            
            const ingresos = (data || []).filter((e: any) => e.entry_type === 'ingreso').reduce((s: number, e: any) => s + Number(e.amount), 0);
            const gastos = (data || []).filter((e: any) => e.entry_type === 'gasto').reduce((s: number, e: any) => s + Number(e.amount), 0);
            
            return `Resumen del período:\nIngresos: $${ingresos.toLocaleString('es-CO')}\nGastos: $${gastos.toLocaleString('es-CO')}\nUtilidad: $${(ingresos - gastos).toLocaleString('es-CO')}\n\nRegistros (${data?.length || 0}):\n${JSON.stringify(data, null, 2)}`;
          }

          case "preop_records": {
            let query = supabase.from("preop_records").select("record_type, horometer_value, has_critical_failures, critical_failures_count, observations, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false });
            if (args.date_from) query = query.gte("created_at", args.date_from);
            if (args.date_to) query = query.lte("created_at", args.date_to + "T23:59:59");
            const { data, error } = await query.limit(limit);
            if (error) return `Error: ${error.message}`;
            const critical = (data || []).filter((p: any) => p.has_critical_failures);
            return `Total preoperacionales: ${data?.length || 0}\nCon fallas críticas: ${critical.length}\n\nResultados:\n${JSON.stringify(data, null, 2)}`;
          }

          default:
            return "Entidad no reconocida. Entidades disponibles: machines, clients, suppliers, projects, work_orders, alerts, personnel, inventory, cost_entries, preop_records";
        }
      }

      default:
        return `Herramienta "${toolName}" no reconocida.`;
    }
  } catch (e) {
    return `Error: ${e instanceof Error ? e.message : "Error desconocido"}`;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, tenant_id, user_id } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    // First call: send messages with tools (non-streaming to detect tool calls)
    const firstResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.2",
        messages: aiMessages,
        tools,
        tool_choice: "auto",
        stream: false,
      }),
    });

    if (!firstResponse.ok) {
      const status = firstResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await firstResponse.text();
      console.error("AI gateway error:", status, t);
      throw new Error("AI gateway error");
    }

    const firstResult = await firstResponse.json();
    let choice = firstResult.choices?.[0];
    let currentMessages = [...aiMessages];

    // Handle multiple rounds of tool calls (up to 3 iterations)
    let iterations = 0;
    while (choice?.message?.tool_calls?.length && iterations < 3) {
      iterations++;
      const toolResults: any[] = [];
      
      for (const tc of choice.message.tool_calls) {
        const args = typeof tc.function.arguments === "string"
          ? JSON.parse(tc.function.arguments)
          : tc.function.arguments;
        console.log(`Executing tool: ${tc.function.name}`, JSON.stringify(args));
        const result = await executeTool(tc.function.name, args, tenant_id, user_id);
        toolResults.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
      }

      currentMessages = [
        ...currentMessages,
        choice.message,
        ...toolResults,
      ];

      // Check if model wants to make more tool calls
      const nextResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5.2",
          messages: currentMessages,
          tools,
          tool_choice: "auto",
          stream: false,
        }),
      });

      if (!nextResponse.ok) throw new Error("AI gateway error on iteration " + iterations);
      const nextResult = await nextResponse.json();
      choice = nextResult.choices?.[0];
    }

    // Final streaming response with all context
    const finalResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.2",
        messages: choice?.message?.tool_calls?.length ? currentMessages : (iterations > 0 ? currentMessages : aiMessages),
        stream: true,
      }),
    });

    return new Response(finalResp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("sam-agent error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
