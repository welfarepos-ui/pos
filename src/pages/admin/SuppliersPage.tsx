import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Supplier } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import { Loading } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Truck, Plus, Edit, Loader2 } from 'lucide-react';

export function SuppliersPage() {
  const { profile } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', email: '', address: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('suppliers').select('*').order('name');
    setSuppliers((data as Supplier[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm({ name: '', contact_person: '', phone: '', email: '', address: '' }); setShowModal(true); };
  const openEdit = (s: Supplier) => { setEditing(s); setForm({ name: s.name, contact_person: s.contact_person ?? '', phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '' }); setShowModal(true); };

  const save = async () => {
    if (!profile || !form.name) return;
    setSaving(true);
    const payload = { name: form.name, contact_person: form.contact_person || null, phone: form.phone || null, email: form.email || null, address: form.address || null };
    if (editing) {
      const { data, error } = await supabase.from('suppliers').update(payload).eq('id', editing.id).select().single();
      if (!error && data) setSuppliers(suppliers.map((s) => s.id === editing.id ? data as Supplier : s));
    } else {
      const { data, error } = await supabase.from('suppliers').insert(payload).select().single();
      if (!error && data) setSuppliers([...suppliers, data as Supplier]);
    }
    setSaving(false); setShowModal(false);
  };

  if (loading) return <Loading label="Loading suppliers..." />;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-slate-900">Suppliers</h1><p className="text-slate-500 mt-1">Manage your suppliers.</p></div>
        <button onClick={openAdd} className="btn-primary"><Plus size={18} /> Add Supplier</button>
      </div>

      {suppliers.length === 0 ? (
        <EmptyState icon={<Truck size={48} />} title="No suppliers yet" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <div key={s.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-teal-50 rounded-xl text-teal-700"><Truck size={20} /></div>
                  <div>
                    <p className="font-semibold text-slate-900">{s.name}</p>
                    {s.contact_person && <p className="text-xs text-slate-500">{s.contact_person}</p>}
                  </div>
                </div>
                <button onClick={() => openEdit(s)} className="p-1.5 text-slate-400 hover:text-teal-600"><Edit size={16} /></button>
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-600">
                {s.phone && <p>{s.phone}</p>}
                {s.email && <p className="truncate">{s.email}</p>}
                {s.address && <p className="text-xs">{s.address}</p>}
              </div>
              {Number(s.outstanding_balance) > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-amber-600 font-medium">Outstanding: {formatCurrency(Number(s.outstanding_balance))}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Supplier' : 'Add Supplier'} size="md">
        <div className="space-y-4">
          <div><label className="label">Supplier name</label><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" /></div>
          <div><label className="label">Contact person</label><input type="text" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} className="input" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Phone</label><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" /></div>
            <div><label className="label">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" /></div>
          </div>
          <div><label className="label">Address</label><input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input" /></div>
          <button onClick={save} disabled={saving || !form.name} className="btn-primary w-full">{saving ? <Loader2 size={18} className="animate-spin" /> : null}{editing ? 'Save' : 'Add Supplier'}</button>
        </div>
      </Modal>
    </div>
  );
}
