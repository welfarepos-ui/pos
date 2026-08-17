import { useState, type ReactNode } from 'react';
import { useNavigate, useLocation, NavLink } from 'react-router-dom';
import { useAuth, type Permission } from '@/context/AuthContext';
import {
  LayoutDashboard, Receipt, Clock, Package, Tags, Boxes,
  ArrowLeftRight, ShoppingCart, Truck, Wallet, Users, BarChart3,
  UserCog, Shield, Banknote, Store, ScrollText, Smartphone,
  Settings, LogOut, Stethoscope, Menu, X,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: Permission;
  end?: boolean;
}

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/admin/sales', label: 'Sales Ledger', icon: Receipt },
      { to: '/admin/shifts', label: 'Shifts', icon: Clock },
    ],
  },
  {
    title: 'Catalog & Inventory',
    items: [
      { to: '/admin/products', label: 'Products', icon: Package, permission: 'products.manage' },
      { to: '/admin/categories', label: 'Categories', icon: Tags, permission: 'products.manage' },
      { to: '/admin/inventory', label: 'Inventory', icon: Boxes, permission: 'inventory.manage' },
      { to: '/admin/stock-movements', label: 'Stock Movements', icon: ArrowLeftRight, permission: 'inventory.manage' },
    ],
  },
  {
    title: 'Procurement & Finance',
    items: [
      { to: '/admin/purchases', label: 'Purchases', icon: ShoppingCart, permission: 'purchases.manage' },
      { to: '/admin/suppliers', label: 'Suppliers', icon: Truck, permission: 'suppliers.manage' },
      { to: '/admin/expenses', label: 'Expenses', icon: Wallet, permission: 'expenses.manage' },
    ],
  },
  {
    title: 'People',
    items: [
      { to: '/admin/customers', label: 'Customers', icon: Users },
      { to: '/admin/staff', label: 'Staff', icon: UserCog, permission: 'staff.manage' },
      { to: '/admin/payroll', label: 'Salaries / Payroll', icon: Banknote, permission: 'payroll.manage' },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/admin/reports', label: 'Reports', icon: BarChart3, permission: 'reports.view' },
      { to: '/admin/stores', label: 'Stores', icon: Store, permission: 'stores.manage' },
      { to: '/admin/audit', label: 'Audit Logs', icon: ScrollText, permission: 'audit.view' },
      { to: '/admin/mpesa', label: 'M-Pesa', icon: Smartphone, permission: 'mpesa.configure' },
      { to: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const { profile, hasPermission, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin');
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-slate-900 flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-700">
          <div className="p-2 bg-teal-700 rounded-xl">
            <Stethoscope size={20} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">Kirinyaga POS</p>
            <p className="text-xs text-slate-400">Admin Portal</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-slate-400">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto scrollbar-thin">
          {navSections.map((section) => {
            const visibleItems = section.items.filter((item) => !item.permission || hasPermission(item.permission));
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.title}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-1">{section.title}</p>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-teal-600 text-white'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`
                      }
                      onClick={() => setSidebarOpen(false)}
                    >
                      <item.icon size={18} />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-slate-700">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-9 h-9 rounded-full bg-teal-600 text-white flex items-center justify-center font-semibold text-sm">
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{profile.full_name}</p>
              <p className="text-xs text-slate-400 capitalize">{profile.role.replace('_', ' ')}</p>
            </div>
            <button onClick={handleSignOut} className="text-slate-400 hover:text-red-400 transition" title="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-slate-900/60 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-600">
            <Menu size={22} />
          </button>
          <span className="text-sm font-semibold text-slate-900">Admin Portal</span>
          <div className="w-6" />
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
}
