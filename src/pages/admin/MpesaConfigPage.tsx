import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Setting, MpesaTransaction } from '@/types/database';
import { formatDateTime, formatCurrency } from '@/lib/utils';
import { Loading } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { Smartphone, Save, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const MPESA_KEYS = [
  { key: 'mpesa_environment', label: 'Environment', type: 'select', options: ['sandbox', 'production'] },
  { key: 'mpesa_consumer_key', label: 'Consumer Key', type: 'password' },
  { key: 'mpesa_consumer_secret', label: 'Consumer Secret', type: 'password' },
  { key: 'mpesa_shortcode', label: 'Shortcode / Business Number', type: 'text' },
  { key: 'mpesa_passkey', label: 'Passkey', type: 'password' },
  { key: 'mpesa_paybill_number', label: 'PayBill Number', type: 'text' },
  { key: 'mpesa_callback_url', label: 'Callback URL', type: 'text' },
  { key: 'mpesa_validation_url', label: 'Validation URL', type: 'text' },
  { key: 'mpesa_confirmation_url', label: 'Confirmation URL', type: 'text' },
  { key: 'mpesa_account_reference', label: 'Account Reference', type: 'text' },
];

export function MpesaConfigPage() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [transactions, setTransactions] = useState<MpesaTransaction[]>([]);
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('settings').select('*').eq('category', 'mpesa');
    const map: Record<string, string> = {};
    (data as Setting[] ?? []).forEach((s) => { map[s.key] = s.value; });
    setSettings(map);

    if (map['mpesa_consumer_key'] && map['mpesa_consumer_secret'] && map['mpesa_shortcode'] && map['mpesa_passkey'] && map['mpesa_callback_url']) {
      setStatus('connected');
    } else {
      setStatus('disconnected');
    }

    const { data: txns } = await supabase.from('mpesa_transactions').select('*').order('created_at', { ascending: false }).limit(50);
    setTransactions((txns as MpesaTransaction[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    for (const [key, value] of Object.entries(settings)) {
      await supabase.from('settings').upsert({ key, value, category: 'mpesa' }, { onConflict: 'key' });
    }
    await supabase.from('audit_logs').insert({ user_id: profile.id, action: 'mpesa_config_updated', entity: 'settings', new_value: { keys: Object.keys(settings) } as unknown });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    load();
  };

  if (loading) return <Loading label="Loading M-Pesa configuration..." />;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">M-Pesa Configuration</h1>
          <p className="text-slate-500 mt-1">Configure Safaricom Daraja API integration.</p>
        </div>
        <div className="flex items-center gap-2">
          {status === 'connected' ? (
            <span className="badge-success"><CheckCircle2 size={14} /> Connected</span>
          ) : status === 'error' ? (
            <span className="badge-danger"><XCircle size={14} /> Error</span>
          ) : (
            <span className="badge-warning"><AlertCircle size={14} /> Not Configured</span>
          )}
        </div>
      </div>

      {status === 'disconnected' && (
        <div className="card p-4 mb-6 bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">M-Pesa is not configured</p>
              <p className="text-xs text-amber-700 mt-1">Payments will be simulated for demo purposes until you configure your Daraja API credentials. The system will never store credentials in frontend code — all secrets are kept server-side.</p>
            </div>
          </div>
        </div>
      )}

      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2"><Smartphone size={20} /> Daraja API Settings</h2>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showSecrets} onChange={(e) => setShowSecrets(e.target.checked)} className="rounded" />
            Show secrets
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MPESA_KEYS.map((field) => (
            <div key={field.key}>
              <label className="label">{field.label}</label>
              {field.type === 'select' ? (
                <select value={settings[field.key] ?? ''} onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })} className="input">
                  {field.options!.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={field.type === 'password' && !showSecrets ? 'password' : 'text'}
                  value={settings[field.key] ?? ''}
                  onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                  className="input"
                  placeholder={field.type === 'password' ? '••••••••' : ''}
                />
              )}
            </div>
          ))}
        </div>

        <button onClick={save} disabled={saving} className="btn-primary mt-6">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saved ? 'Saved!' : 'Save Configuration'}
        </button>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 mb-4">M-Pesa Transactions</h2>
        {transactions.length === 0 ? (
          <EmptyState icon={<Smartphone size={40} />} title="No M-Pesa transactions yet" />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Phone</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">M-Pesa Ref</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Reconciliation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(t.created_at)}</td>
                    <td className="px-4 py-3"><span className="badge-neutral">{t.transaction_type}</span></td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(t.amount))}</td>
                    <td className="px-4 py-3 text-slate-600">{t.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{t.mpesa_receipt_number ?? '—'}</td>
                    <td className="px-4 py-3"><span className={t.status === 'success' ? 'badge-success' : t.status === 'pending' ? 'badge-warning' : 'badge-danger'}>{t.status}</span></td>
                    <td className="px-4 py-3"><span className={t.reconciliation_status === 'matched' ? 'badge-success' : t.reconciliation_status === 'pending' ? 'badge-warning' : 'badge-danger'}>{t.reconciliation_status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
