import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, Role } from '@/types/database';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  hasRole: (roles: Role[]) => boolean;
  hasPermission: (permission: Permission) => boolean;
  refreshProfile: () => Promise<void>;
}

export type Permission =
  | 'pos.access'
  | 'pos.sell'
  | 'shift.open'
  | 'shift.close'
  | 'shift.view_all'
  | 'admin.access'
  | 'products.manage'
  | 'inventory.manage'
  | 'purchases.manage'
  | 'suppliers.manage'
  | 'expenses.manage'
  | 'customers.manage'
  | 'reports.view'
  | 'staff.manage'
  | 'payroll.manage'
  | 'stores.manage'
  | 'audit.view'
  | 'mpesa.configure'
  | 'mpesa.reconcile'
  | 'sales.void'
  | 'sales.refund';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    'pos.access', 'pos.sell', 'shift.open', 'shift.close', 'shift.view_all',
    'admin.access', 'products.manage', 'inventory.manage', 'purchases.manage',
    'suppliers.manage', 'expenses.manage', 'customers.manage', 'reports.view',
    'staff.manage', 'payroll.manage', 'stores.manage', 'audit.view',
    'mpesa.configure', 'mpesa.reconcile', 'sales.void', 'sales.refund',
  ],
  admin: [
    'pos.access', 'pos.sell', 'shift.open', 'shift.close', 'shift.view_all',
    'admin.access', 'products.manage', 'inventory.manage', 'purchases.manage',
    'suppliers.manage', 'expenses.manage', 'customers.manage', 'reports.view',
    'staff.manage', 'payroll.manage', 'stores.manage', 'audit.view',
    'mpesa.configure', 'mpesa.reconcile', 'sales.void', 'sales.refund',
  ],
  cashier: ['pos.access', 'pos.sell', 'shift.open', 'shift.close', 'customers.manage'],
  storekeeper: ['admin.access', 'inventory.manage', 'purchases.manage', 'suppliers.manage'],
  accountant: ['admin.access', 'expenses.manage', 'reports.view', 'purchases.manage'],
  auditor: ['admin.access', 'reports.view', 'audit.view'],
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('Profile fetch error:', error);
      return;
    }
    setProfile(data as Profile | null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        fetchProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        (async () => {
          await fetchProfile(newSession.user.id);
        })();
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error: error.message };
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        full_name: fullName,
        role: 'super_admin',
        employee_id: `EMP-${Date.now().toString().slice(-6)}`,
        status: 'active',
      });
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  };

  const hasRole = (roles: Role[]) => {
    if (!profile) return false;
    return roles.includes(profile.role);
  };

  const hasPermission = (permission: Permission) => {
    if (!profile) return false;
    return ROLE_PERMISSIONS[profile.role]?.includes(permission) ?? false;
  };

  const refreshProfile = async () => {
    if (session?.user) await fetchProfile(session.user.id);
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signUp, signOut, hasRole, hasPermission, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
