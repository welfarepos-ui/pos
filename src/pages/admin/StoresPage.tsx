import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Store } from '@/types/database';
import { Loading } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Store as StoreIcon, Plus, Loader2 } from 'lucide-react';

export function StoresPage() {
  const { profile } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'cafeteria' as Store['type'], location: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('stores').select('*').order('name');
    setStores((data as Store[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!profile || !form.name) return;
    setSaving(true);
    await supabase.from('stores').insert({ name: form.name, type: form.type, location: form.location || null, is_active: true });
    await supabase.from('audit_logs').insert({ user_id: profile.id, action: 'store_created', entity: 'stores', new_value: { name: form.name } as unknown });
    setSaving(false); setShowModal(false);
    setForm({ name: '', type: 'cafeteria', location: '' });
    load();
  };

  if (loading) return <Loading label="Loading stores..." />;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-slate-900">Stores / Locations</h1><p className="text-slate-500 mt-1">Manage your business locations.</p></div>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={18} /> Add Store</button>
      </div>

      {stores.length === 0 ? (
        <EmptyState icon={<StoreIcon size={48} />} title="No stores found" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map((s) => (
            <div key={s.id} className="card p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-teal-50 rounded-xl text-teal-700"><StoreIcon size={20} /></div>
                <div>
                  <p className="font-semibold text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-500 capitalize">{s.type.replace('_', ' ')}</p>
                </div>
              </div>
              {s.location && <p className="text-sm text-slate-600 mt-3">{s.location}</p>}
              <div className="mt-3"><span className={s.is_active ? 'badge-success' : 'badge-neutral'}>{s.is_active ? 'Active' : 'Inactive'}</span></div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Store" size="sm">
        <div className="space-y-4">
          <div><label className="label">Store name</label><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Cafeteria Branch 2" /></div>
          <div>
            <label className="label">Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Store['type'] })} className="input">
              <option value="main_store">Main Store</option><option value="cafeteria">Cafeteria</option><option value="kitchen">Kitchen</option><option value="branch">Branch</option>
            </select>
          </div>
          <div><label className="label">Location (optional)</label><input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="input" /></div>
          <button onClick={save} disabled={saving || !form.name} className="btn-primary w-full">{saving ? <Loader2 size={18} className="animate-spin" /> : null}Add Store</button>
        </div>
      </Modal>
    </div>
  );
}
