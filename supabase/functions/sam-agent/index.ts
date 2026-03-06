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

## Capacidades operativas
Tienes acceso a herramientas para:
1. **Crear clientes** - nombre, NIT, contacto, ciudad
2. **Crear proveedores** - nombre, especialidad, contacto
3. **Crear máquinas** - nombre, código, tipo, marca, modelo
4. **Registrar movimientos financieros** - ingresos y gastos asociados a máquinas o proyectos
5. **Consultar datos** - máquinas, proyectos, clientes, órdenes de trabajo, proveedores

## Reglas operativas
- SIEMPRE pide confirmación antes de crear/modificar datos
- Si falta información obligatoria, pregunta al usuario
- Para gastos/ingresos, siempre asocia a una máquina o proyecto si es posible
- Nunca inventes datos, usa solo lo que el usuario proporciona
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

**Tip para usuarios**: El dashboard se actualiza en tiempo real. Si no ves datos, verifica que haya máquinas y OTs registradas.

### 3.2 Máquinas (Superadmin, Gerente, Supervisor)
Módulo central de gestión de flota con tres vistas:
- **Vista Tarjetas**: Cards visuales con foto, estado, horómetro y proyecto actual
- **Vista Lista**: Tabla con columnas ordenables y filtros avanzados
- **Vista Kanban**: Tablero drag-like organizado por estado de la máquina

**Estados de máquina:**
- 🟢 Activa en campo — Operando en un proyecto
- 🔵 Disponible en bodega — Lista para asignar
- 🟡 En campo dañada — En proyecto pero requiere reparación
- 🔴 Varada en bodega — Fuera de servicio

**Crear una máquina**: Clic en "Nueva Máquina" → llenar nombre, código interno (obligatorio, ej: MH-001), tipo, marca, modelo. El tipo puede ser: telehandler, manlift, tijera, hincadora, minicargador, retroexcavadora, camión grúa, u otro.

**Detalle de máquina** (clic en una máquina):
- **Ficha técnica**: Especificaciones detalladas editables inline (motor, combustible, placa, altura máxima, peso, capacidad)
- **Estado y condición**: Porcentaje de vida útil de componentes (motor, llantas, sistema hidráulico, etc.)
- **Historial de OTs**: Todas las órdenes de trabajo de esa máquina
- **Preoperacionales**: Inspecciones realizadas
- **Documentos**: Manuales, SOAT, revisión técnico-mecánica (con fechas de vencimiento)
- **Fotos**: Galería de fotos reales del equipo
- **Alertas de mantenimiento**: Configuración de alertas preventivas por horómetro o calendario
- **Hoja de Vida PDF**: Genera un documento PDF completo con toda la información del equipo

### 3.3 Órdenes de Trabajo - OT (Superadmin, Gerente, Supervisor)
Gestión completa del ciclo de mantenimiento:

**Tipos de OT:**
- Preventivo — Mantenimiento programado
- Correctivo — Reparación por falla
- Inspección — Revisión técnica
- Preparación — Alistamiento de equipo

**Estados del flujo:**
Creada → Asignada → En curso → Pausada ↔ En curso → Cerrada → Firmada

**Crear una OT**: Clic en "Nueva OT" → seleccionar máquina, tipo, prioridad (baja/media/alta/crítica), ubicación (bodega propia, campo directo, taller tercero), descripción del problema.

**Dentro de una OT**:
- Asignar técnicos responsables
- Registrar repuestos consumidos (descuenta automáticamente del inventario)
- Control de tiempo con cronómetro (iniciar, pausar con motivo, finalizar)
- Subir fotos de evidencia (antes/después)
- Asignar y devolver herramientas
- Costos automáticos: mano de obra + repuestos + externos = costo total
- Firma digital al cerrar

### 3.4 Mis OT (Técnico)
Vista simplificada solo para técnicos. Muestra únicamente las OTs asignadas al técnico actual con:
- Cronómetro para registrar tiempos
- Registro de repuestos usados
- Subida de fotos
- Cambio de estado (iniciar, pausar, cerrar)

### 3.5 Preoperacionales (Supervisor ve listado / Operario crea)
Inspecciones diarias obligatorias antes de operar una máquina:

**Para operarios** (vista móvil optimizada):
1. Seleccionar máquina y proyecto
2. Registrar horómetro actual
3. Evaluar cada ítem de inspección: Bueno ✅ / Malo ❌ / N/A ➖
4. Los ítems varían según el tipo de máquina (cada tipo tiene su plantilla)
5. Agregar observaciones si hay fallas
6. Firmar digitalmente
7. El sistema detecta automáticamente fallas críticas

**Para supervisores**: Listado de todos los preoperacionales con filtros por fecha, máquina, operador y estado crítico.

### 3.6 Clientes (Superadmin, Gerente, Supervisor)
CRM de clientes con:
- Tipo: Empresa o Persona natural
- Datos de contacto: nombre, email, teléfono
- Ubicación: país, ciudad, dirección
- NIT/documento fiscal
- Estado: activo/inactivo
- Notas adicionales
- Proyectos asociados

### 3.7 Proveedores (Superadmin, Gerente, Supervisor)
Gestión de proveedores con:
- Tipo: taller, repuestos, consumibles, servicios
- Especialidad del proveedor
- Sistema de calificación por estrellas (1-5)
- Historial de OTs atendidas
- Datos de contacto y ubicación

### 3.8 Personal (Superadmin, Gerente, Supervisor)
Administración de técnicos y operarios:
- Tipo: Técnico u Operario
- Datos personales: nombre, cédula, teléfono, email
- Especialidad técnica
- Tarifa por hora (para cálculo de costos de mano de obra)
- Estado: activo/inactivo
- Certificaciones (JSON flexible)
- Vinculación con cuenta de usuario del sistema

### 3.9 Proyectos (Superadmin, Gerente, Supervisor)
Gestión de obras y proyectos:
- Datos generales: nombre, cliente, ubicación, fechas
- Estados: prospecto → aprobado → en_curso → pausado → finalizado → cancelado
- Presupuesto asignado vs costos reales
- Máquinas asignadas al proyecto (asignar/remover)
- Personal asignado con rol en proyecto
- Preoperacionales del proyecto
- Órdenes de trabajo del proyecto
- Seguimiento financiero (ingresos y gastos del proyecto)

### 3.10 Inventario (Superadmin, Gerente, Supervisor)
Dos secciones:

**Consumibles (repuestos, filtros, aceites, etc.):**
- Nombre, categoría, unidad de medida
- Stock actual vs stock mínimo (alerta automática cuando baja)
- Costo unitario
- Proveedor asociado
- Movimientos: entradas, salidas (por OT), ajustes

**Herramientas:**
- Código interno, nombre, categoría
- Estado: disponible, en_uso, mantenimiento, baja
- Número de serie
- Costo de compra y fecha
- Asignada a: persona o OT
- Actas de entrega con firma

**Kits de herramientas**: Conjuntos predefinidos de herramientas + consumibles que se asignan a máquinas.

### 3.11 Financiero (Superadmin, Gerente)
Libro mayor unificado:
- **Ingresos**: Pagos de clientes, alquileres, servicios
- **Gastos**: Combustible, repuestos, mano de obra, seguros, servicios externos
- Cada movimiento puede asociarse a una máquina y/o proyecto
- Filtros por período, tipo, máquina, proyecto
- KPIs: Ingresos totales, gastos totales, utilidad, margen
- Gráficos de tendencia temporal
- Importación masiva desde Excel/CSV
- Categorías financieras personalizables

**Rentabilidad por máquina** (en detalle de máquina):
- Ingresos vs gastos de cada equipo
- ROI y margen de rentabilidad
- Recomendación automática: "Rentable" / "Optimizar" / "Evaluar venta"

### 3.12 Analytics (Superadmin, Gerente)
Tablero analítico avanzado con:
- Distribución de máquinas por estado y tipo
- Tendencias de OTs en el tiempo
- Costos de mantenimiento por máquina
- Utilización de la flota
- Comparativos mensuales

### 3.13 Configuración (Superadmin, Gerente)
Centro de configuración del sistema:
- **Empresa**: Nombre, NIT, logo, moneda, zona horaria
- **Parámetros**: Intervalos de mantenimiento preventivo por tipo de máquina
- **Usuarios**: Crear, editar y desactivar usuarios del sistema (con sus roles)
- **Notificaciones**: Configurar ruteo de alertas por rol
- **Auditoría**: Log completo de todas las acciones del sistema con filtros y exportación

## 4. ALERTAS Y NOTIFICACIONES

El sistema genera alertas automáticas:
- ⚠️ **Mantenimiento por horómetro**: Cuando una máquina alcanza las horas programadas
- 📅 **Mantenimiento por calendario**: Cuando se cumple el intervalo de días
- 📄 **Documentos por vencer**: SOAT, revisión técnico-mecánica, seguros
- 📦 **Stock bajo**: Cuando un consumible baja del mínimo
- 🔴 **Fallas críticas**: Cuando un preoperacional reporta fallas críticas

Las alertas aparecen en el Dashboard y se pueden resolver marcándolas como atendidas.

## 5. PWA Y USO MÓVIL

Up & Down App es una Progressive Web App (PWA):
- Se puede instalar en el celular como una app nativa
- Funciona sin conexión para preoperacionales (sincroniza cuando hay internet)
- Interfaz optimizada para móviles (mobile-first)
- Firma digital táctil en pantalla

**Cómo instalar en el celular**:
1. Abrir la app en Chrome (Android) o Safari (iOS)
2. Buscar la opción "Agregar a pantalla de inicio" o "Instalar aplicación"
3. Confirmar la instalación
4. La app aparecerá como un ícono en el celular

## 6. FLUJOS COMUNES (PASO A PASO)

### Registrar una máquina nueva:
1. Ir a Máquinas → "Nueva Máquina"
2. Llenar: nombre, código interno, tipo, marca, modelo, año, serial
3. Guardar
4. En el detalle: subir foto, agregar documentos, configurar alertas de mantenimiento

### Crear una orden de trabajo:
1. Ir a Órdenes de Trabajo → "Nueva OT"
2. Seleccionar máquina, tipo (preventivo/correctivo), prioridad, ubicación
3. Describir el problema o trabajo a realizar
4. Guardar (queda en estado "Creada")
5. Asignar técnicos
6. El técnico la inicia desde "Mis OT", registra tiempos y repuestos
7. Al finalizar, se cierra y se firma

### Hacer un preoperacional:
1. El operario abre la app en su celular
2. Selecciona "Preoperacional" → tipo Inicio o Cierre
3. Elige la máquina y el proyecto
4. Registra el horómetro
5. Evalúa cada ítem de la checklist
6. Agrega observaciones si hay problemas
7. Firma digitalmente
8. Envía (o se guarda offline si no hay internet)

### Registrar un ingreso/gasto:
1. Ir a Financiero → "Nuevo registro"
2. Seleccionar: Ingreso o Gasto
3. Monto, descripción, categoría
4. Asociar a máquina y/o proyecto (opcional pero recomendado)
5. Guardar

### Importar datos financieros desde Excel:
1. Ir a Financiero → botón "Importar"
2. Subir archivo Excel o CSV
3. Mapear columnas del archivo a los campos del sistema
4. Previsualizar y confirmar
5. Los registros se crean automáticamente

## 7. SOPORTE FRECUENTE — PREGUNTAS COMUNES

**P: ¿Por qué no veo el módulo de Dashboard/Finanzas/Analytics?**
R: Tu rol de usuario no tiene acceso a ese módulo. Solo Superadmin y Gerente pueden ver Dashboard completo, Finanzas y Analytics. Contacta a tu administrador si necesitas acceso.

**P: ¿Cómo cambio el estado de una máquina?**
R: Ve a Máquinas → clic en la máquina → en el detalle puedes cambiar el estado desde el selector de estado en la parte superior.

**P: ¿Cómo asigno una máquina a un proyecto?**
R: Ve a Proyectos → selecciona el proyecto → pestaña "Máquinas" → "Asignar máquina". También puedes hacerlo desde el detalle de la máquina.

**P: ¿Qué hago si el preoperacional no se envía?**
R: Si no hay internet, el preoperacional se guarda localmente y se sincroniza automáticamente cuando vuelva la conexión. Verifica el ícono de red en la parte superior.

**P: ¿Cómo genero la hoja de vida de una máquina?**
R: Ve a Máquinas → clic en la máquina → botón "Hoja de Vida PDF" en la parte superior del detalle.

**P: ¿Cómo configuro alertas de mantenimiento?**
R: Ve a Máquinas → detalle de la máquina → pestaña "Alertas" → "Nueva alerta". Puedes configurar por horómetro (cada X horas) o por calendario (cada X días).

**P: ¿Puedo usar la app sin internet?**
R: Sí, los preoperacionales funcionan offline. Se guardan en el celular y se sincronizan cuando hay internet. Otros módulos requieren conexión.

**P: ¿Cómo creo un usuario nuevo?**
R: Ve a Configuración → pestaña "Usuarios" → "Nuevo usuario". Necesitas: nombre completo, email, teléfono, rol. Solo Superadmin y Gerente pueden crear usuarios.

**P: ¿Cómo veo los costos de una máquina?**
R: Ve a Máquinas → detalle de la máquina → pestaña "Financiero". Ahí ves todos los ingresos y gastos asociados, ROI y recomendación de rentabilidad.

**P: ¿Cómo exporto datos?**
R: En las tablas de datos hay un botón de exportar que genera archivos Excel/CSV. En auditoría también puedes exportar los logs del sistema.

## 8. TERMINOLOGÍA CLAVE

- **OT**: Orden de Trabajo
- **Preop / Preoperacional**: Inspección diaria antes de operar una máquina
- **Horómetro**: Contador de horas de operación de una máquina (como un odómetro pero de horas)
- **KPI**: Indicador clave de rendimiento
- **ROI**: Retorno sobre la inversión
- **PWA**: Progressive Web App — app web que se instala como nativa
- **Tenant**: Empresa/organización dentro del sistema (multi-tenant)
- **RLS**: Row Level Security — cada empresa solo ve sus propios datos
`;

// Tool definitions for the AI model
const tools = [
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
  {
    type: "function",
    function: {
      name: "query_data",
      description: "Consultar datos del sistema: máquinas, clientes, proyectos, órdenes de trabajo",
      parameters: {
        type: "object",
        properties: {
          entity: {
            type: "string",
            enum: ["machines", "clients", "suppliers", "projects", "work_orders"],
            description: "Tipo de entidad a consultar",
          },
          filter: { type: "string", description: "Filtro de búsqueda (nombre, estado, etc.)" },
          limit: { type: "number", description: "Cantidad máxima de resultados (default 10)" },
        },
        required: ["entity"],
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
        const limit = args.limit || 10;
        const entity = args.entity;
        let query;

        switch (entity) {
          case "machines":
            query = supabase
              .from("machines")
              .select("name, internal_code, type, status, horometer_current, brand, model")
              .eq("tenant_id", tenantId)
              .eq("active", true);
            if (args.filter) query = query.or(`name.ilike.%${args.filter}%,internal_code.ilike.%${args.filter}%`);
            break;
          case "clients":
            query = supabase.from("clients").select("name, tax_id, contact_name, city, status").eq("tenant_id", tenantId);
            if (args.filter) query = query.ilike("name", `%${args.filter}%`);
            break;
          case "suppliers":
            query = supabase.from("suppliers").select("name, specialty, contact_name, city, status").eq("tenant_id", tenantId);
            if (args.filter) query = query.ilike("name", `%${args.filter}%`);
            break;
          case "projects":
            query = supabase.from("projects").select("name, status, city, budget, start_date").eq("tenant_id", tenantId);
            if (args.filter) query = query.ilike("name", `%${args.filter}%`);
            break;
          case "work_orders":
            query = supabase
              .from("work_orders")
              .select("code, type, status, priority, created_at, total_cost")
              .eq("tenant_id", tenantId)
              .order("created_at", { ascending: false });
            if (args.filter) query = query.ilike("code", `%${args.filter}%`);
            break;
          default:
            return "Entidad no reconocida.";
        }

        const { data, error } = await query.limit(limit);
        if (error) return `Error en consulta: ${error.message}`;
        if (!data?.length) return `No se encontraron ${entity} con los filtros indicados.`;
        return `Encontré ${data.length} resultado(s):\n${JSON.stringify(data, null, 2)}`;
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

    // First call: send messages with tools
    const aiMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

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
    const choice = firstResult.choices?.[0];

    // If no tool calls, stream the response directly
    if (!choice?.message?.tool_calls?.length) {
      // Re-call with streaming for fluent output
      const streamResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5.2",
          messages: aiMessages,
          stream: true,
        }),
      });

      return new Response(streamResp.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Execute tool calls
    const toolResults: any[] = [];
    for (const tc of choice.message.tool_calls) {
      const args = typeof tc.function.arguments === "string"
        ? JSON.parse(tc.function.arguments)
        : tc.function.arguments;
      const result = await executeTool(tc.function.name, args, tenant_id, user_id);
      toolResults.push({
        role: "tool",
        tool_call_id: tc.id,
        content: result,
      });
    }

    // Second call with tool results, streaming
    const finalMessages = [
      ...aiMessages,
      choice.message,
      ...toolResults,
    ];

    const finalResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.2",
        messages: finalMessages,
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
