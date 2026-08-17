import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Expense } from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Loading } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Wallet, Plus, Loader2 } from 'lucide-react';

const CATEGORIES = ['Electricity', 'Water', 'Cleaning', 'Transport', 'Repairs', 'Maintenance', 'Supplies', 'Salaries', 'Other'];

export function ExpensesPage() {
  const { profile } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ category: 'Electricity', description: '', amount: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('expenses').select('*').order('date', { ascending: false });
    setExpenses((data as Expense[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!profile || !form.description || !form.amount) return;
    setSaving(true);
    await supabase.from('expenses').insert({
      category: form.category,
      description: form.description,
      amount: Number(form.amount),
      date: new Date().toISOString().split('T')[0],
      recorded_by: profile.id,
      notes: form.notes || null,
    });
    await supabase.from('audit_logs').insert({ user_id: profile.id, action: 'expense_created', entity: 'expenses', new_value: { category: form.category, amount: form.amount } as unknown });
    setSaving(false); setShowModal(false);
    setForm({ category: 'Electricity', description: '', amount: '', notes: '' });
    load();
  };

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  if (loading) return <Loading label="Loading expenses..." />;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
          <p className="text-slate-500 mt-1">Total expenses: {formatCurrency(total)}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={18} /> Add Expense</button>
      </div>

      {expenses.length === 0 ? (
        <EmptyState icon={<Wallet size={48} />} title="No expenses recorded" />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Description</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{formatDate(e.date)}</td>
                  <td className="px-4 py-3"><span className="badge-neutral">{e.category}</span></td>
                  <td className="px-4 py-3 text-slate-900">{e.description}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">{formatCurrency(Number(e.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Expense" size="md">
        <div className="space-y-4">
          <div>
            <label className="label">Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><label className="label">Description</label><input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" /></div>
          <div><label className="label">Amount (KSh)</label><input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input" /></div>
          <div><label className="label">Notes (optional)</label><input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" /></div>
          <button onClick={save} disabled={saving || !form.description || !form.amount} className="btn-primary w-full">{saving ? <Loader2 size={18} className="animate-spin" /> : null}Add Expense</button>
        </div>
      </Modal>
    </div>
  );
}
