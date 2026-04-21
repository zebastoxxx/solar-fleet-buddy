import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify caller role
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims, error: claimsErr } = await callerClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const callerId = claims.claims.sub as string;
    const { data: callerProfile } = await supabaseAdmin.from('users').select('role, tenant_id').eq('id', callerId).single();
    if (!callerProfile || !['superadmin', 'gerente', 'supervisor'].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const action = (body?.action as string) || 'create';

    // ─── ACTION: list_unlinked_auth_users ───
    // Returns auth users belonging to caller's tenant that have NO public.users row,
    // OR public.users rows that have no personnel record yet. Used by the
    // "Diagnóstico de personal" panel.
    if (action === 'list_unlinked_auth_users') {
      // Fetch all auth users (admin only)
      const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listErr) {
        return new Response(JSON.stringify({ error: listErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Get all public.users rows in this tenant
      const { data: publicUsers } = await supabaseAdmin.from('users')
        .select('id, full_name, role')
        .eq('tenant_id', callerProfile.tenant_id);

      // Get all personnel.user_id values in this tenant
      const { data: linkedPersonnel } = await supabaseAdmin.from('personnel')
        .select('user_id')
        .eq('tenant_id', callerProfile.tenant_id)
        .not('user_id', 'is', null);

      const linkedSet = new Set((linkedPersonnel || []).map((p: any) => p.user_id));
      const publicById = new Map((publicUsers || []).map((u: any) => [u.id, u]));

      // Auth users that exist in this tenant (have a public.users row) but NO personnel
      const candidates = (list?.users || [])
        .filter((au: any) => publicById.has(au.id))
        .filter((au: any) => !linkedSet.has(au.id))
        .map((au: any) => {
          const pu: any = publicById.get(au.id);
          return {
            id: au.id,
            email: au.email,
            full_name: pu?.full_name || au.email,
            role: pu?.role || null,
          };
        });

      return new Response(JSON.stringify({ users: candidates }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── ACTION: create_and_link_personnel ───
    // Creates a brand new auth user + public.users + links to an EXISTING
    // personnel record (by personnel_id). Used to fix orphan personnel rows.
    if (action === 'create_and_link_personnel') {
      const { email, password, fullName, role, personnelId } = body;
      if (!email || !password || !fullName || !role || !personnelId) {
        return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!['tecnico', 'operario'].includes(role)) {
        return new Response(JSON.stringify({ error: 'Role must be tecnico or operario' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Verify personnel belongs to caller tenant and is currently unlinked
      const { data: personRow, error: personErr } = await supabaseAdmin.from('personnel')
        .select('id, tenant_id, user_id')
        .eq('id', personnelId)
        .single();
      if (personErr || !personRow) {
        return new Response(JSON.stringify({ error: 'Personnel not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (personRow.tenant_id !== callerProfile.tenant_id) {
        return new Response(JSON.stringify({ error: 'Tenant mismatch' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (personRow.user_id) {
        return new Response(JSON.stringify({ error: 'Personnel already linked' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: createdAuth, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr || !createdAuth?.user) {
        return new Response(JSON.stringify({ error: createErr?.message || 'Auth create failed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const newUserId = createdAuth.user.id;

      // Insert into public.users
      const { error: insUserErr } = await supabaseAdmin.from('users').insert({
        id: newUserId,
        tenant_id: callerProfile.tenant_id,
        full_name: fullName,
        role,
        active: true,
        created_by: callerId,
      });
      if (insUserErr) {
        // Roll back the auth user to avoid orphans
        await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => null);
        return new Response(JSON.stringify({ error: insUserErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Link personnel
      const { error: linkErr } = await supabaseAdmin.from('personnel')
        .update({ user_id: newUserId })
        .eq('id', personnelId);
      if (linkErr) {
        return new Response(JSON.stringify({ error: linkErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ user_id: newUserId }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ─── DEFAULT ACTION: create (legacy: only auth user) ───
    const { email, password, fullName, role, tenantId } = body;

    if (!email || !password || !fullName || !role) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: corsHeaders });
    }

    if (tenantId !== callerProfile.tenant_id) {
      return new Response(JSON.stringify({ error: 'Tenant mismatch' }), { status: 403, headers: corsHeaders });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ user: data.user }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
