import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate, useLocation, NavLink } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Shift } from '@/types/database';
import {
  LayoutDashboard, ShoppingCart, Zap, UtensilsCrossed,
  Users, Receipt, ClipboardList, Clock, LogOut, Stethoscope,
  Menu, X,
} from 'lucide-react';

const navItems = [
  { to: '/cashier', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/cashier/pos', label: 'POS', icon: ShoppingCart },
  { to: '/cashier/quick-sale', label: 'Quick Sale', icon: Zap },
  { to: '/cashier/tables', label: 'Tables / Tabs', icon: UtensilsCrossed },
  { to: '/cashier/customers', label: 'Customers', icon: Users },
  { to: '/cashier/sales', label: 'Sales', icon: Receipt },
  { to: '/cashier/receipts', label: 'Receipts', icon: ClipboardList },
];

export function CashierLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeShift, setActiveShift] = useState<Shift | null | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchActiveShift = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('shifts')
      .select('*')
      .eq('cashier_id', profile.id)
      .eq('status', 'open')
      .maybeSingle();
    setActiveShift(data as Shift | null);
  };

  useEffect(() => {
    fetchActiveShift();
  }, [profile?.id, location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin');
  };

  if (!profile) return null;

  const isOnShiftPage = location.pathname === '/cashier/shift';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-200">
          <div className="p-2 bg-teal-700 rounded-xl">
            <Stethoscope size={20} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-tight">Kirinyaga POS</p>
            <p className="text-xs text-slate-500">Cashier Portal</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-slate-400">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}

          <div className="pt-3 mt-3 border-t border-slate-200">
            <NavLink
              to="/cashier/shift"
              className={`nav-link ${isOnShiftPage ? 'nav-link-active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Clock size={18} />
              {activeShift === undefined ? 'Current Shift' : activeShift ? 'Close Shift' : 'Open Shift'}
            </NavLink>
          </div>
        </nav>

        <div className="px-3 py-4 border-t border-slate-200">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-semibold text-sm">
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{profile.full_name}</p>
              <p className="text-xs text-slate-500 capitalize">{profile.role}</p>
            </div>
            <button onClick={handleSignOut} className="text-slate-400 hover:text-red-600 transition" title="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Shift status bar */}
        {activeShift !== undefined && !activeShift && !isOnShiftPage && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between">
            <p className="text-sm text-amber-800 font-medium">
              No active shift — you must open a shift before making sales
            </p>
            <button onClick={() => navigate('/cashier/shift')} className="btn-primary text-xs px-3 py-1.5">
              Open Shift
            </button>
          </div>
        )}

        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-600">
            <Menu size={22} />
          </button>
          <span className="text-sm font-semibold text-slate-900">Cashier Portal</span>
          <div className="w-6" />
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
}
