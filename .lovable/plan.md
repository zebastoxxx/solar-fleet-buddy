

# Plan: Fix OT Visibility for Technicians, Operators, and Superadmin

## Problem Summary

After investigation, the database data is **correct** — all work orders exist, all personnel records are linked to user accounts, and RLS policies are properly configured. The issues are in the **frontend code** silently swallowing errors and a potential **auth race condition**.

### Evidence from database:
- All 6 work orders exist with correct `tenant_id`
- OT-005 → Rafael (personnel `058a1c54`, user_id linked ✓)
- OT-006 → Bienvenido (personnel `98768a94`, user_id linked ✓)
- Diego (superadmin) has correct tenant_id in users table ✓
- `get_user_tenant_id()` function works correctly ✓

### Root causes identified:

1. **Silent query failures**: The `MisOT.tsx` queries destructure `{ data }` without checking `error`. If `.single()` fails (e.g., temporary RLS timeout), it returns null and the user sees "profile not linked" instead of the real error.

2. **Auth race condition**: The `authStore.initialize()` uses `setTimeout(0)` inside `onAuthStateChange`, which can cause a brief window where the Supabase client session is set but `auth.uid()` hasn't propagated to the RLS context. Queries fired in this window return empty results.

3. **Rafael's personnel type mismatch**: Rafael's linked personnel record has `type: operario` instead of `tecnico`. While this doesn't block the current queries, it can cause issues when the OT creation modal filters technicians by `type = 'tecnico'`.

4. **Duplicate personnel records**: Rafael has two personnel entries — one linked (type: operario) and one orphaned (type: tecnico, user_id: null). This can confuse supervisors when assigning OTs.

---

## Changes (Frontend Only — No Database Modifications)

### Step 1: Add error handling to MisOT.tsx queries

In the `personnelId` query and `workOrders` query, capture and surface errors instead of silently failing:

```typescript
const { data: personnelId, isLoading: isLoadingPersonnel, error: personnelError } = useQuery({
  queryKey: ['my-personnel-id', user?.id],
  queryFn: async () => {
    const { data, error } = await supabase.from('personnel')
      .select('id').eq('user_id', user!.id).single();
    if (error) {
      console.error('Personnel query error:', error);
      throw error;
    }
    return data?.id || null;
  },
  enabled: !!user?.id,
  retry: 3, // Retry on transient failures
  retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
});
```

Update the "not linked" message to also show when there's an error vs genuinely unlinked.

### Step 2: Add error handling to Dashboard OT queries

In `useDashboardData.ts`, the `useRecentOTs` and `useOpenOTs` hooks don't check for errors. Add error checking and retry logic:

```typescript
queryFn: async () => {
  const { data, error } = await supabase...;
  if (error) throw error;
  return data ?? [];
},
retry: 2,
```

### Step 3: Add retry logic to auth-dependent queries across MisOT

Add `retry: 3` and `retryDelay` to all auth-dependent queries in `MisOT.tsx` to handle the auth race condition where `auth.uid()` returns null temporarily.

### Step 4: Fix Configuración user creation to ensure personnel type matches role

In `Configuracion.tsx` `CreateUserModal`, ensure that when creating a tecnico user, the personnel record is created with `type: 'tecnico'` (not defaulting to something else). Currently it uses `type: role as 'tecnico' | 'operario'` which is correct, but add validation.

### Step 5: Add console.log debugging for development

Add temporary `console.log` statements to:
- `MisOT.tsx` personnelId query result
- `MisOT.tsx` workOrders query result  
- `useRecentOTs` query result

This will make errors visible in console logs for the next debugging session.

---

## Files to modify:
1. **`src/pages/MisOT.tsx`** — Add error handling, retry logic, and debug logging to personnel and work order queries
2. **`src/hooks/useDashboardData.ts`** — Add error checking and retry to `useRecentOTs` and `useOpenOTs`
3. **`src/pages/PreoperacionalOperario.tsx`** — Add same error handling pattern for operario preop queries

