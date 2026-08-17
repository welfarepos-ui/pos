import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Profile, Role } from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Loading } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { UserCog, Plus, Edit, Loader2, Shield } from 'lucide-react';

const ROLES: Role[] = ['super_admin', 'admin', 'cashier', 'storekeeper', 'accountant', 'auditor'];

export function StaffPage() {
  const { profile: currentUser } = useAuth();
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', position: '', role: 'cashier' as Role, salary: '', status: 'active' as 'active' | 'inactive' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    setStaff((data as Profile[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (p: Profile) => {
    setEditing(p);
    setForm({ full_name: p.full_name, email: p.email, phone: p.phone ?? '', position: p.position ?? '', role: p.role, salary: String(p.salary ?? ''), status: p.status });
    setShowModal(true);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ full_name: '', email: '', phone: '', position: '', role: 'cashier', salary: '', status: 'active' });
    setShowModal(true);
  };

  const save = async () => {
    if (!currentUser || !form.full_name || !form.email) return;
    setSaving(true);
    const payload = {
      full_name: form.full_name,
      email: form.email,
      phone: form.phone || null,
      position: form.position || null,
      role: form.role,
      salary: Number(form.salary) || 0,
      status: form.status,
    };
    if (editing) {
      const { data, error } = await supabase.from('profiles').update(payload).eq('id', editing.id).select().single();
      if (!error && data) {
        setStaff(staff.map((s) => s.id === editing.id ? data as Profile : s));
        await supabase.from('audit_logs').insert({ user_id: currentUser.id, action: 'staff_updated', entity: 'profiles', entity_id: editing.id, previous_value: editing as unknown, new_value: payload as unknown });
      }
    }
    setSaving(false);
    setShowModal(false);
  };

  if (loading) return <Loading label="Loading staff..." />;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Staff Management</h1>
          <p className="text-slate-500 mt-1">Manage staff accounts and roles.</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={18} /> Add Staff</button>
      </div>

      {staff.length === 0 ? (
        <EmptyState icon={<UserCog size={48} />} title="No staff found" />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Role</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Position</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Salary</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{s.full_name}</td>
                  <td className="px-4 py-3 text-slate-600">{s.email}</td>
                  <td className="px-4 py-3"><span className="badge-info capitalize">{s.role.replace('_', ' ')}</span></td>
                  <td className="px-4 py-3 text-slate-600">{s.position ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{s.salary ? formatCurrency(Number(s.salary)) : '—'}</td>
                  <td className="px-4 py-3"><span className={s.status === 'active' ? 'badge-success' : 'badge-neutral'}>{s.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(s)} className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg"><Edit size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Staff' : 'Add Staff'} size="md">
        <div className="space-y-4">
          <div><label className="label">Full name</label><input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input" /></div>
          <div><label className="label">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" disabled={!!editing} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Phone</label><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" /></div>
            <div><label className="label">Position</label><input type="text" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="input" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className="input">
                {ROLES.map((r) => <option key={r} value={r} className="capitalize">{r.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div><label className="label">Salary (KSh)</label><input type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} className="input" /></div>
          </div>
          <div>
            <label className="label">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })} className="input">
              <option value="active">Active</option><option value="inactive">Inactive</option>
            </select>
          </div>
          {editing && <p className="text-xs text-slate-500">Note: New staff accounts must be created through the sign-up page. You can edit existing profiles here.</p>}
          <button onClick={save} disabled={saving || !form.full_name || !form.email} className="btn-primary w-full">
            {saving ? <Loader2 size={18} className="animate-spin" /> : null}
            {editing ? 'Save Changes' : 'Add Staff'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
