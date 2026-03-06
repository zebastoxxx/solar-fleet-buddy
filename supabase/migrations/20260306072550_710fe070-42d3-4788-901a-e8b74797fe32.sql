
CREATE TABLE public.sam_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text DEFAULT 'Nueva conversación',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.sam_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.sam_conversations
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "own_conversations" ON public.sam_conversations
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
