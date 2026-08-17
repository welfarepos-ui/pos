import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { StatCard } from '@/components/ui/StatCard';
import { formatCurrency } from '@/lib/utils';
import { Loading } from '@/components/ui/Loading';
import {
  ShoppingCart, Smartphone, Wallet, TrendingUp,
  Package, Users, AlertTriangle, BarChart3,
} from 'lucide-react';

type DateRange = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>('today');
  const [stats, setStats] = useState({
    sales: 0, transactions: 0, mpesa: 0, expenses: 0, purchases: 0,
    profit: 0, lowStock: 0, activeCashiers: 0,
  });
  const [salesTrend, setSalesTrend] = useState<{ date: string; total: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number; revenue: number }[]>([]);
  const [categorySales, setCategorySales] = useState<{ name: string; total: number }[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const now = new Date();
      let start = new Date();
      start.setHours(0, 0, 0, 0);

      if (range === 'yesterday') {
        start.setDate(start.getDate() - 1);
        now.setHours(23, 59, 59, 999);
      } else if (range === 'week') {
        start.setDate(start.getDate() - 7);
      } else if (range === 'month') {
        start.setMonth(start.getMonth() - 1);
      }

      const startISO = start.toISOString();
      const endISO = now.toISOString();

      const [{ data: salesData }, { data: expensesData }, { data: purchasesData }, { data: inventoryData }, { data: shiftsData }, { data: saleItemsData }] = await Promise.all([
        supabase.from('sales').select('total, payment_status, created_at').gte('created_at', startISO).lte('created_at', endISO).eq('payment_status', 'success'),
        supabase.from('expenses').select('amount, date').gte('date', start.toISOString().split('T')[0]),
        supabase.from('purchases').select('total, created_at').gte('created_at', startISO).lte('created_at', endISO),
        supabase.from('inventory').select('quantity, minimum_stock, product:products(name)').eq('quantity', 0),
        supabase.from('shifts').select('id').eq('status', 'open'),
        supabase.from('sale_items').select('quantity, subtotal, product:products(name, category:categories(name))').gte('created_at', startISO).lte('created_at', endISO),
      ]);

      const sales = (salesData ?? []) as { total: number; created_at: string }[];
      const expenses = (expensesData ?? []) as { amount: number }[];
      const purchases = (purchasesData ?? []) as { total: number }[];
      const lowStock = (inventoryData ?? []) as unknown as { quantity: number; minimum_stock: number; product: { name: string } }[];
      const items = (saleItemsData ?? []) as unknown as { quantity: number; subtotal: number; product: { name: string; category: { name: string } | null } }[];

      const totalSales = sales.reduce((sum, s) => sum + Number(s.total), 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
      const totalPurchases = purchases.reduce((sum, p) => sum + Number(p.total), 0);

      // Sales trend by day
      const trendMap: Record<string, number> = {};
      sales.forEach((s) => {
        const day = new Date(s.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
        trendMap[day] = (trendMap[day] ?? 0) + Number(s.total);
      });
      setSalesTrend(Object.entries(trendMap).map(([date, total]) => ({ date, total })));

      // Top products
      const productMap: Record<string, { qty: number; revenue: number }> = {};
      items.forEach((i) => {
        const name = i.product?.name ?? 'Unknown';
        if (!productMap[name]) productMap[name] = { qty: 0, revenue: 0 };
        productMap[name].qty += i.quantity;
        productMap[name].revenue += Number(i.subtotal);
      });
      setTopProducts(Object.entries(productMap).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 5));

      // Category sales
      const catMap: Record<string, number> = {};
      items.forEach((i) => {
        const name = i.product?.category?.name ?? 'Uncategorized';
        catMap[name] = (catMap[name] ?? 0) + Number(i.subtotal);
      });
      setCategorySales(Object.entries(catMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total));

      setStats({
        sales: totalSales,
        transactions: sales.length,
        mpesa: totalSales,
        expenses: totalExpenses,
        purchases: totalPurchases,
        profit: totalSales - totalExpenses,
        lowStock: lowStock.length,
        activeCashiers: (shiftsData ?? []).length,
      });
      setLoading(false);
    };
    load();
  }, [range]);

  if (loading) return <Loading label="Loading dashboard..." />;

  const maxTrend = Math.max(...salesTrend.map((t) => t.total), 1);
  const maxCat = Math.max(...categorySales.map((c) => c.total), 1);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500 mt-1">Business overview and performance.</p>
        </div>
        <div className="flex gap-2">
          {(['today', 'yesterday', 'week', 'month'] as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition ${range === r ? 'bg-teal-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {r === 'week' ? 'This Week' : r === 'month' ? 'This Month' : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Today's Sales" value={formatCurrency(stats.sales)} icon={<ShoppingCart size={20} />} accent="teal" />
        <StatCard label="M-Pesa Sales" value={formatCurrency(stats.mpesa)} icon={<Smartphone size={20} />} accent="emerald" />
        <StatCard label="Transactions" value={stats.transactions} icon={<BarChart3 size={20} />} accent="blue" />
        <StatCard label="Gross Profit" value={formatCurrency(stats.profit)} icon={<TrendingUp size={20} />} accent="violet" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Expenses" value={formatCurrency(stats.expenses)} icon={<Wallet size={20} />} accent="rose" />
        <StatCard label="Purchases" value={formatCurrency(stats.purchases)} icon={<Package size={20} />} accent="amber" />
        <StatCard label="Low Stock" value={stats.lowStock} icon={<AlertTriangle size={20} />} accent="rose" />
        <StatCard label="Active Cashiers" value={stats.activeCashiers} icon={<Users size={20} />} accent="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales trend chart */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Sales Over Time</h3>
          {salesTrend.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No sales data for this period.</p>
          ) : (
            <div className="flex items-end gap-2 h-48">
              {salesTrend.map((t) => (
                <div key={t.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-teal-100 rounded-t-lg transition-all hover:bg-teal-200" style={{ height: `${(t.total / maxTrend) * 100}%` }}>
                    <div className="w-full bg-teal-600 rounded-t-lg h-full opacity-70" />
                  </div>
                  <span className="text-xs text-slate-500">{t.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top products */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Top Products</h3>
          {topProducts.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No sales data yet.</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.qty} sold</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{formatCurrency(p.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sales by category */}
        <div className="card p-6 lg:col-span-2">
          <h3 className="font-semibold text-slate-900 mb-4">Sales by Category</h3>
          {categorySales.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No sales data yet.</p>
          ) : (
            <div className="space-y-3">
              {categorySales.map((c) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-700 w-32 truncate">{c.name}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                    <div className="bg-teal-600 h-full rounded-full transition-all flex items-center justify-end px-2" style={{ width: `${(c.total / maxCat) * 100}%` }}>
                      <span className="text-xs text-white font-medium">{formatCurrency(c.total)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
