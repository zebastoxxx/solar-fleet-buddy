import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

export type UserRole = 'superadmin' | 'gerente' | 'supervisor' | 'tecnico' | 'operario';

export interface AuthUser {
  id: string;
  tenant_id: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  avatar_url?: string;
  active: boolean;
}

interface AuthState {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

const ROLE_REDIRECTS: Record<UserRole, string> = {
  superadmin: '/dashboard',
  gerente: '/dashboard',
  supervisor: '/maquinas',
  tecnico: '/mis-ot',
  operario: '/preoperacional',
};

export { ROLE_REDIRECTS };

async function fetchUserProfile(userId: string): Promise<AuthUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, tenant_id, full_name, phone, role, avatar_url, active')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data as AuthUser;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,

  initialize: async () => {
    try {
      // Set up auth state listener BEFORE getting session
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          // Use setTimeout to avoid Supabase auth deadlock
          setTimeout(async () => {
            const profile = await fetchUserProfile(session.user.id);
            set({ session, user: profile, loading: false });
          }, 0);
        } else {
          set({ session: null, user: null, loading: false });
        }
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id);
        set({ session, user: profile, loading: false });
      } else {
        set({ loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.session?.user) {
      const profile = await fetchUserProfile(data.session.user.id);
      if (!profile) throw new Error('No se encontró el perfil de usuario');
      if (!profile.active) {
        await supabase.auth.signOut();
        throw new Error('Tu cuenta está desactivada');
      }
      set({ session: data.session, user: profile });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null });
  },
}));
