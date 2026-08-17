import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { Loading } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { BarChart3, TrendingUp, Package, ShoppingCart, Wallet } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';

export function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [purchases, setPurchases] = useState(0);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number; revenue: number }[]>([]);
  const [cashierSales, setCashierSales] = useState<{ name: string; sales: number; count: number }[]>([]);

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);

      const [{ data: salesData }, { data: expData }, { data: purData }, { data: itemsData }, { data: salesCashier }] = await Promise.all([
        supabase.from('sales').select('total').eq('payment_status', 'success').gte('created_at', start.toISOString()),
        supabase.from('expenses').select('amount').gte('date', start.toISOString().split('T')[0]),
        supabase.from('purchases').select('total').gte('created_at', start.toISOString()),
        supabase.from('sale_items').select('quantity, subtotal, product:products(name)').gte('created_at', start.toISOString()),
        supabase.from('sales').select('total, cashier:profiles(full_name)').eq('payment_status', 'success').gte('created_at', start.toISOString()),
      ]);

      setSales((salesData ?? []).reduce((s: number, r: { total: number }) => s + Number(r.total), 0));
      setExpenses((expData ?? []).reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0));
      setPurchases((purData ?? []).reduce((s: number, r: { total: number }) => s + Number(r.total), 0));

      const prodMap: Record<string, { qty: number; revenue: number }> = {};
      const items = (itemsData ?? []) as unknown as { quantity: number; subtotal: number; product: { name: string } | null }[];
      items.forEach((i) => {
        const name = i.product?.name ?? 'Unknown';
        if (!prodMap[name]) prodMap[name] = { qty: 0, revenue: 0 };
        prodMap[name].qty += i.quantity;
        prodMap[name].revenue += Number(i.subtotal);
      });
      setTopProducts(Object.entries(prodMap).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 10));

      const cashierMap: Record<string, { sales: number; count: number }> = {};
      const cashierData = (salesCashier ?? []) as unknown as { total: number; cashier: { full_name: string } | null }[];
      cashierData.forEach((s) => {
        const name = s.cashier?.full_name ?? 'Unknown';
        if (!cashierMap[name]) cashierMap[name] = { sales: 0, count: 0 };
        cashierMap[name].sales += Number(s.total);
        cashierMap[name].count += 1;
      });
      setCashierSales(Object.entries(cashierMap).map(([name, v]) => ({ name, ...v })));

      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <Loading label="Loading reports..." />;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-slate-500 mt-1">Financial and performance reports for this month.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Revenue" value={formatCurrency(sales)} icon={<TrendingUp size={20} />} accent="teal" />
        <StatCard label="Expenses" value={formatCurrency(expenses)} icon={<Wallet size={20} />} accent="rose" />
        <StatCard label="Purchases" value={formatCurrency(purchases)} icon={<ShoppingCart size={20} />} accent="amber" />
        <StatCard label="Gross Profit" value={formatCurrency(sales - expenses)} icon={<BarChart3 size={20} />} accent="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Top Products</h3>
          {topProducts.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">No data.</p> : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  <div className="flex-1"><p className="text-sm font-medium text-slate-900">{p.name}</p><p className="text-xs text-slate-500">{p.qty} sold</p></div>
                  <span className="text-sm font-semibold">{formatCurrency(p.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Sales by Cashier</h3>
          {cashierSales.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">No data.</p> : (
            <div className="space-y-3">
              {cashierSales.map((c) => (
                <div key={c.name} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold">{c.name.charAt(0)}</div>
                  <div className="flex-1"><p className="text-sm font-medium text-slate-900">{c.name}</p><p className="text-xs text-slate-500">{c.count} transactions</p></div>
                  <span className="text-sm font-semibold">{formatCurrency(c.sales)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
