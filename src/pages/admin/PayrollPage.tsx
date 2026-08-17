import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Payroll, Profile } from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Loading } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Banknote, Plus, Loader2 } from 'lucide-react';

interface PayrollWithEmployee extends Payroll {
  employee?: Profile;
}

export function PayrollPage() {
  const { profile } = useAuth();
  const [payrolls, setPayrolls] = useState<PayrollWithEmployee[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ employee_id: '', basic_salary: '', allowances: '', deductions: '', pay_period: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from('payroll').select('*, employee:profiles(*)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('status', 'active').order('full_name'),
    ]);
    setPayrolls((p as PayrollWithEmployee[]) ?? []);
    setStaff((s as Profile[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!profile || !form.employee_id || !form.basic_salary || !form.pay_period) return;
    setSaving(true);
    const basic = Number(form.basic_salary);
    const allowances = Number(form.allowances) || 0;
    const deductions = Number(form.deductions) || 0;
    const net = basic + allowances - deductions;
    await supabase.from('payroll').insert({
      employee_id: form.employee_id,
      basic_salary: basic,
      allowances,
      deductions,
      net_salary: net,
      pay_period: form.pay_period,
      payment_status: 'pending',
    });
    await supabase.from('audit_logs').insert({ user_id: profile.id, action: 'payroll_created', entity: 'payroll', new_value: { employee_id: form.employee_id, net } as unknown });
    setSaving(false);
    setShowModal(false);
    setForm({ employee_id: '', basic_salary: '', allowances: '', deductions: '', pay_period: '' });
    load();
  };

  const markPaid = async (id: string) => {
    await supabase.from('payroll').update({ payment_status: 'paid' }).eq('id', id);
    load();
  };

  if (loading) return <Loading label="Loading payroll..." />;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Salaries / Payroll</h1>
          <p className="text-slate-500 mt-1">Manage employee payroll and payments.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={18} /> Add Payroll</button>
      </div>

      {payrolls.length === 0 ? (
        <EmptyState icon={<Banknote size={48} />} title="No payroll records" description="Add payroll entries for your staff." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Employee</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Basic</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Allowances</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Deductions</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Net Salary</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Period</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payrolls.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{p.employee?.full_name ?? 'Unknown'}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(Number(p.basic_salary))}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(Number(p.allowances))}</td>
                  <td className="px-4 py-3 text-right text-red-600">-{formatCurrency(Number(p.deductions))}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(Number(p.net_salary))}</td>
                  <td className="px-4 py-3 text-slate-600">{p.pay_period}</td>
                  <td className="px-4 py-3"><span className={p.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}>{p.payment_status}</span></td>
                  <td className="px-4 py-3 text-right">
                    {p.payment_status === 'pending' && <button onClick={() => markPaid(p.id)} className="btn-secondary text-xs">Mark Paid</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Payroll Entry" size="md">
        <div className="space-y-4">
          <div>
            <label className="label">Employee</label>
            <select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} className="input">
              <option value="">Select employee...</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Basic salary</label><input type="number" value={form.basic_salary} onChange={(e) => setForm({ ...form, basic_salary: e.target.value })} className="input" /></div>
            <div><label className="label">Pay period</label><input type="text" value={form.pay_period} onChange={(e) => setForm({ ...form, pay_period: e.target.value })} className="input" placeholder="Aug 2026" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Allowances</label><input type="number" value={form.allowances} onChange={(e) => setForm({ ...form, allowances: e.target.value })} className="input" /></div>
            <div><label className="label">Deductions</label><input type="number" value={form.deductions} onChange={(e) => setForm({ ...form, deductions: e.target.value })} className="input" /></div>
          </div>
          <button onClick={save} disabled={saving || !form.employee_id || !form.basic_salary || !form.pay_period} className="btn-primary w-full">
            {saving ? <Loader2 size={18} className="animate-spin" /> : null}
            Add Payroll
          </button>
        </div>
      </Modal>
    </div>
  );
}
