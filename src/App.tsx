import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { CashierLayout } from '@/components/layouts/CashierLayout';
import { Loading } from '@/components/ui/Loading';
import type { Role } from '@/types/database';
import { SignInPage } from '@/pages/auth/SignInPage';
import { SignUpPage } from '@/pages/auth/SignUpPage';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminSalesLedgerPage } from '@/pages/admin/AdminSalesLedgerPage';
import { AdminShiftsPage } from '@/pages/admin/AdminShiftsPage';
import { ProductsPage } from '@/pages/admin/ProductsPage';
import { CategoriesPage } from '@/pages/admin/CategoriesPage';
import { InventoryPage, StockMovementsPage } from '@/pages/admin/InventoryPage';
import { PurchasesPage } from '@/pages/admin/PurchasesPage';
import { SuppliersPage } from '@/pages/admin/SuppliersPage';
import { ExpensesPage } from '@/pages/admin/ExpensesPage';
import { AdminCustomersPage } from '@/pages/admin/AdminCustomersPage';
import { StaffPage } from '@/pages/admin/StaffPage';
import { PayrollPage } from '@/pages/admin/PayrollPage';
import { ReportsPage } from '@/pages/admin/ReportsPage';
import { StoresPage } from '@/pages/admin/StoresPage';
import { AuditLogsPage } from '@/pages/admin/AuditLogsPage';
import { MpesaConfigPage } from '@/pages/admin/MpesaConfigPage';
import { SettingsPage } from '@/pages/admin/SettingsPage';
import { CashierDashboard } from '@/pages/cashier/CashierDashboard';
import { POSPage } from '@/pages/cashier/POSPage';
import { QuickSalePage } from '@/pages/cashier/QuickSalePage';
import { TablesPage } from '@/pages/cashier/TablesPage';
import { CustomersPage } from '@/pages/cashier/CustomersPage';
import { SalesPage } from '@/pages/cashier/SalesPage';
import { ReceiptsPage } from '@/pages/cashier/ReceiptsPage';
import { ShiftPage } from '@/pages/cashier/ShiftPage';

const ADMIN_ROLES: Role[] = ['super_admin', 'admin', 'storekeeper', 'accountant', 'auditor'];
const CASHIER_ROLES: Role[] = ['cashier'];

function HomeRedirect() {
  const { session, profile, loading } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <Navigate to="/signin" replace />;
  if (!profile) return <Loading label="Loading your profile..." />;
  if (ADMIN_ROLES.includes(profile.role)) return <Navigate to="/admin" replace />;
  return <Navigate to="/cashier" replace />;
}

function RequireRole({ roles, layout: Layout, children }: { roles: Role[]; layout: typeof AdminLayout; children: ReactNode }) {
  const { session, profile, loading, hasRole } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <Navigate to="/signin" replace />;
  if (!profile) return <Loading label="Loading your profile..." />;
  if (!hasRole(roles)) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  return <RequireRole roles={ADMIN_ROLES} layout={AdminLayout}>{children}</RequireRole>;
}

function CashierRoute({ children }: { children: ReactNode }) {
  return <RequireRole roles={CASHIER_ROLES} layout={CashierLayout}>{children}</RequireRole>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/signup" element={<SignUpPage />} />

      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/sales" element={<AdminRoute><AdminSalesLedgerPage /></AdminRoute>} />
      <Route path="/admin/shifts" element={<AdminRoute><AdminShiftsPage /></AdminRoute>} />
      <Route path="/admin/products" element={<AdminRoute><ProductsPage /></AdminRoute>} />
      <Route path="/admin/categories" element={<AdminRoute><CategoriesPage /></AdminRoute>} />
      <Route path="/admin/inventory" element={<AdminRoute><InventoryPage /></AdminRoute>} />
      <Route path="/admin/stock-movements" element={<AdminRoute><StockMovementsPage /></AdminRoute>} />
      <Route path="/admin/purchases" element={<AdminRoute><PurchasesPage /></AdminRoute>} />
      <Route path="/admin/suppliers" element={<AdminRoute><SuppliersPage /></AdminRoute>} />
      <Route path="/admin/expenses" element={<AdminRoute><ExpensesPage /></AdminRoute>} />
      <Route path="/admin/customers" element={<AdminRoute><AdminCustomersPage /></AdminRoute>} />
      <Route path="/admin/staff" element={<AdminRoute><StaffPage /></AdminRoute>} />
      <Route path="/admin/payroll" element={<AdminRoute><PayrollPage /></AdminRoute>} />
      <Route path="/admin/reports" element={<AdminRoute><ReportsPage /></AdminRoute>} />
      <Route path="/admin/stores" element={<AdminRoute><StoresPage /></AdminRoute>} />
      <Route path="/admin/audit" element={<AdminRoute><AuditLogsPage /></AdminRoute>} />
      <Route path="/admin/mpesa" element={<AdminRoute><MpesaConfigPage /></AdminRoute>} />
      <Route path="/admin/settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />

      <Route path="/cashier" element={<CashierRoute><CashierDashboard /></CashierRoute>} />
      <Route path="/cashier/pos" element={<CashierRoute><POSPage /></CashierRoute>} />
      <Route path="/cashier/quick-sale" element={<CashierRoute><QuickSalePage /></CashierRoute>} />
      <Route path="/cashier/tables" element={<CashierRoute><TablesPage /></CashierRoute>} />
      <Route path="/cashier/customers" element={<CashierRoute><CustomersPage /></CashierRoute>} />
      <Route path="/cashier/sales" element={<CashierRoute><SalesPage /></CashierRoute>} />
      <Route path="/cashier/receipts" element={<CashierRoute><ReceiptsPage /></CashierRoute>} />
      <Route path="/cashier/shift" element={<CashierRoute><ShiftPage /></CashierRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
