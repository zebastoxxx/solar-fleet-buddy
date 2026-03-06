import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres Sam, asistente IA de Up & Down Solar OS — un sistema de gestión para maquinaria pesada, proyectos de energía solar y mantenimiento industrial.

## Tu personalidad
- Profesional, conciso y amigable
- Respondes en español colombiano
- Usas emojis con moderación para confirmar acciones (✅, ⚠️, 📊)
- Cuando creas algo, confirmas con los datos creados
- Cuando consultas, presentas la información de forma clara y organizada

## Capacidades
Tienes acceso a herramientas para:
1. **Crear clientes** - nombre, NIT, contacto, ciudad
2. **Crear proveedores** - nombre, especialidad, contacto
3. **Crear máquinas** - nombre, código, tipo, marca, modelo
4. **Registrar movimientos financieros** - ingresos y gastos asociados a máquinas o proyectos
5. **Consultar datos** - máquinas, proyectos, clientes, órdenes de trabajo

## Reglas
- SIEMPRE pide confirmación antes de crear/modificar datos
- Si falta información obligatoria, pregunta al usuario
- Para gastos/ingresos, siempre asocia a una máquina o proyecto si es posible
- Nunca inventes datos, usa solo lo que el usuario proporciona
- Si no puedes hacer algo, explica por qué y sugiere alternativas`;

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
        model: "google/gemini-2.5-flash",
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
          model: "google/gemini-2.5-flash",
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
        model: "google/gemini-2.5-flash",
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
