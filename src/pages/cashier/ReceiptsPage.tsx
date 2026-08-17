import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Sale } from '@/types/database';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { ClipboardList, Search, Loader2, Printer, Eye } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

export function ReceiptsPage() {
  const { profile } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('sales')
      .select('*, cashier:profiles(*), customer:customers(*), sale_items(*, product:products(*))')
      .eq('payment_status', 'success')
      .order('created_at', { ascending: false })
      .limit(50);
    setSales((data as Sale[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile?.id]);

  const filtered = sales.filter((s) =>
    !search || s.receipt_number.toLowerCase().includes(search.toLowerCase()) || (s.mpesa_reference ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const printReceipt = (sale: Sale) => {
    setSelectedSale(sale);
    setTimeout(() => window.print(), 200);
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400"><Loader2 className="animate-spin inline mr-2" size={20} />Loading receipts...</div>;
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Receipts</h1>
        <p className="text-slate-500 mt-1">View and reprint paid receipts.</p>
      </div>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by receipt # or M-Pesa ref..." className="input pl-10" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ClipboardList size={48} />} title="No receipts yet" description="Paid receipts will appear here." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <div key={s.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-slate-900">{s.receipt_number}</span>
                <span className="badge-success">PAID</span>
              </div>
              <p className="text-sm text-slate-500">{formatDateTime(s.created_at)}</p>
              <p className="text-sm text-slate-600 mt-1">Customer: {s.customer?.name ?? 'Walk-in'}</p>
              <p className="text-sm text-slate-600">M-Pesa: {s.mpesa_reference ?? '—'}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                <span className="text-lg font-bold text-slate-900">{formatCurrency(Number(s.total))}</span>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedSale(s)} className="btn-ghost text-xs"><Eye size={16} /> View</button>
                  <button onClick={() => printReceipt(s)} className="btn-secondary text-xs"><Printer size={16} /> Print</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!selectedSale} onClose={() => setSelectedSale(null)} title="Receipt" size="sm">
        {selectedSale && (
          <div className="text-center">
            <p className="font-bold text-lg">KIRINYAGA HEALTHCARE WORKERS CAFETERIA</p>
            <p className="text-xs text-slate-500 mb-4">Kirinyaga County Hospital</p>
            <div className="text-sm text-left space-y-1 mb-4">
              <div className="flex justify-between"><span>Receipt #</span><span className="font-medium">{selectedSale.receipt_number}</span></div>
              <div className="flex justify-between"><span>Date</span><span>{formatDateTime(selectedSale.created_at)}</span></div>
              <div className="flex justify-between"><span>Cashier</span><span>{selectedSale.cashier?.full_name}</span></div>
              <div className="flex justify-between"><span>Customer</span><span>{selectedSale.customer?.name ?? 'Walk-in'}</span></div>
              <div className="flex justify-between"><span>M-Pesa Ref</span><span className="font-medium">{selectedSale.mpesa_reference}</span></div>
            </div>
            <div className="border-t border-dashed border-slate-200 pt-3">
              <table className="w-full text-sm">
                <tbody>
                  {(selectedSale.sale_items ?? []).map((item) => (
                    <tr key={item.id}>
                      <td className="py-1 text-left">{item.product?.name ?? 'Unknown'} x{item.quantity}</td>
                      <td className="py-1 text-right">{formatCurrency(Number(item.subtotal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-200 mt-3 pt-3 flex justify-between font-bold">
              <span>TOTAL</span><span>{formatCurrency(Number(selectedSale.total))}</span>
            </div>
            <p className="text-xs text-slate-400 mt-4">Thank you for dining with us!</p>
            <button onClick={() => window.print()} className="btn-secondary w-full mt-4"><Printer size={16} /> Print Receipt</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
