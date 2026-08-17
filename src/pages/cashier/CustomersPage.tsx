import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Customer, Sale } from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Users, Search, Plus, Loader2, Phone, X } from 'lucide-react';

export function CustomersPage() {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSales, setCustomerSales] = useState<Sale[]>([]);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', employee_number: '', customer_type: 'staff' as 'staff' | 'visitor' | 'student' });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('customers').select('*').order('name');
    setCustomers((data as Customer[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) return;
    await supabase.from('customers').insert(newCustomer);
    setNewCustomer({ name: '', phone: '', employee_number: '', customer_type: 'staff' });
    setShowAdd(false);
    load();
  };

  const viewCustomer = async (c: Customer) => {
    setSelectedCustomer(c);
    const { data } = await supabase.from('sales').select('*').eq('customer_id', c.id).order('created_at', { ascending: false }).limit(20);
    setCustomerSales((data as Sale[]) ?? []);
  };

  const filtered = customers.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search) || (c.employee_number ?? '').includes(search)
  );

  if (loading) {
    return <div className="p-8 text-center text-slate-400"><Loader2 className="animate-spin inline mr-2" size={20} />Loading customers...</div>;
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-slate-500 mt-1">Manage customer records and purchase history.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={18} /> Add Customer
        </button>
      </div>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, phone, or employee number..." className="input pl-10" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Users size={48} />} title="No customers found" description="Add customers or adjust your search." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <button key={c.id} onClick={() => viewCustomer(c)} className="card p-4 text-left card-hover">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-semibold">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.phone}</p>
                </div>
                <span className="badge-neutral capitalize">{c.customer_type}</span>
              </div>
              {c.employee_number && <p className="text-xs text-slate-400 mt-2">Employee #: {c.employee_number}</p>}
            </button>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Customer" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Full name</label>
            <input type="text" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} className="input" placeholder="Jane Doe" />
          </div>
          <div>
            <label className="label">Phone number</label>
            <input type="tel" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} className="input" placeholder="07XXXXXXXX" />
          </div>
          <div>
            <label className="label">Employee number (optional)</label>
            <input type="text" value={newCustomer.employee_number} onChange={(e) => setNewCustomer({ ...newCustomer, employee_number: e.target.value })} className="input" placeholder="EMP-001" />
          </div>
          <div>
            <label className="label">Customer type</label>
            <select value={newCustomer.customer_type} onChange={(e) => setNewCustomer({ ...newCustomer, customer_type: e.target.value as 'staff' | 'visitor' | 'student' })} className="input">
              <option value="staff">Staff</option>
              <option value="visitor">Visitor</option>
              <option value="student">Student</option>
            </select>
          </div>
          <button onClick={addCustomer} disabled={!newCustomer.name || !newCustomer.phone} className="btn-primary w-full">Add Customer</button>
        </div>
      </Modal>

      <Modal open={!!selectedCustomer} onClose={() => setSelectedCustomer(null)} title={selectedCustomer?.name ?? ''} size="md">
        {selectedCustomer && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Phone:</span> <span className="font-medium">{selectedCustomer.phone}</span></div>
              <div><span className="text-slate-500">Type:</span> <span className="font-medium capitalize">{selectedCustomer.customer_type}</span></div>
              {selectedCustomer.employee_number && <div><span className="text-slate-500">Employee #:</span> <span className="font-medium">{selectedCustomer.employee_number}</span></div>}
              <div><span className="text-slate-500">Joined:</span> <span className="font-medium">{formatDate(selectedCustomer.created_at)}</span></div>
            </div>
            <div className="border-t border-slate-200 pt-4">
              <h4 className="font-semibold text-slate-900 mb-3">Purchase History</h4>
              {customerSales.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No purchases yet.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
                  {customerSales.map((s) => (
                    <div key={s.id} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium">{s.receipt_number}</p>
                        <p className="text-xs text-slate-500">{formatDate(s.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(Number(s.total))}</p>
                        <span className={`text-xs ${s.payment_status === 'success' ? 'text-emerald-600' : 'text-amber-600'}`}>{s.payment_status}</span>
                      </div>
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
