import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Customer, Sale } from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Loading } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Users, Search, Plus, Loader2 } from 'lucide-react';

export function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [customerSales, setCustomerSales] = useState<Sale[]>([]);
  const [newCust, setNewCust] = useState({ name: '', phone: '', employee_number: '', customer_type: 'staff' as 'staff' | 'visitor' | 'student' });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('customers').select('*').order('name');
    setCustomers((data as Customer[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addCustomer = async () => {
    if (!newCust.name || !newCust.phone) return;
    await supabase.from('customers').insert(newCust);
    setNewCust({ name: '', phone: '', employee_number: '', customer_type: 'staff' });
    setShowAdd(false);
    load();
  };

  const viewCustomer = async (c: Customer) => {
    setSelected(c);
    const { data } = await supabase.from('sales').select('*').eq('customer_id', c.id).order('created_at', { ascending: false }).limit(20);
    setCustomerSales((data as Sale[]) ?? []);
  };

  const filtered = customers.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search) || (c.employee_number ?? '').includes(search)
  );

  if (loading) return <Loading label="Loading customers..." />;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-slate-500 mt-1">Manage customer records and purchase history.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={18} /> Add Customer</button>
      </div>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, phone, or employee number..." className="input pl-10" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Users size={48} />} title="No customers found" />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Employee #</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => viewCustomer(c)}>
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-slate-600">{c.phone}</td>
                  <td className="px-4 py-3 text-slate-600">{c.employee_number ?? '—'}</td>
                  <td className="px-4 py-3"><span className="badge-neutral capitalize">{c.customer_type}</span></td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Customer" size="sm">
        <div className="space-y-4">
          <div><label className="label">Full name</label><input type="text" value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} className="input" /></div>
          <div><label className="label">Phone number</label><input type="tel" value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} className="input" placeholder="07XXXXXXXX" /></div>
          <div><label className="label">Employee number (optional)</label><input type="text" value={newCust.employee_number} onChange={(e) => setNewCust({ ...newCust, employee_number: e.target.value })} className="input" /></div>
          <div>
            <label className="label">Customer type</label>
            <select value={newCust.customer_type} onChange={(e) => setNewCust({ ...newCust, customer_type: e.target.value as 'staff' | 'visitor' | 'student' })} className="input">
              <option value="staff">Staff</option><option value="visitor">Visitor</option><option value="student">Student</option>
            </select>
          </div>
          <button onClick={addCustomer} disabled={!newCust.name || !newCust.phone} className="btn-primary w-full">Add Customer</button>
        </div>
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ''} size="md">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Phone:</span> <span className="font-medium">{selected.phone}</span></div>
              <div><span className="text-slate-500">Type:</span> <span className="font-medium capitalize">{selected.customer_type}</span></div>
              {selected.employee_number && <div><span className="text-slate-500">Employee #:</span> <span className="font-medium">{selected.employee_number}</span></div>}
            </div>
            <div className="border-t border-slate-200 pt-4">
              <h4 className="font-semibold text-slate-900 mb-3">Purchase History</h4>
              {customerSales.length === 0 ? <p className="text-sm text-slate-400">No purchases yet.</p> : (
                <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
                  {customerSales.map((s) => (
                    <div key={s.id} className="flex justify-between text-sm p-2 bg-slate-50 rounded-lg">
                      <div><p className="font-medium">{s.receipt_number}</p><p className="text-xs text-slate-500">{formatDate(s.created_at)}</p></div>
                      <p className="font-semibold">{formatCurrency(Number(s.total))}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
