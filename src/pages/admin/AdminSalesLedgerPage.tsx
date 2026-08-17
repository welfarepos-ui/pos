import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Sale } from '@/types/database';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Loading } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { Search, Receipt } from 'lucide-react';

export function AdminSalesLedgerPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('sales')
        .select('*, cashier:profiles(*), customer:customers(*)')
        .order('created_at', { ascending: false })
        .limit(200);
      setSales((data as Sale[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = sales.filter((s) => {
    const matchSearch = !search || s.receipt_number.toLowerCase().includes(search.toLowerCase()) || (s.mpesa_reference ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.payment_status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) return <Loading label="Loading sales ledger..." />;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Sales Ledger</h1>
        <p className="text-slate-500 mt-1">Complete searchable record of all sales transactions.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by receipt # or M-Pesa ref..." className="input pl-10" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input sm:w-48">
          <option value="all">All statuses</option>
          <option value="success">Success</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Receipt size={48} />} title="No sales found" description="Sales will appear here once transactions are made." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Receipt #</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Cashier</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Customer</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">M-Pesa Ref</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{s.receipt_number}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(s.created_at)}</td>
                    <td className="px-4 py-3 text-slate-600">{s.cashier?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{s.customer?.name ?? 'Walk-in'}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(s.total))}</td>
                    <td className="px-4 py-3 text-slate-600">{s.mpesa_reference ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={s.payment_status === 'success' ? 'badge-success' : s.payment_status === 'pending' ? 'badge-warning' : 'badge-danger'}>{s.payment_status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
