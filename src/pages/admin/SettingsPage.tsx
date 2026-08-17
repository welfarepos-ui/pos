import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Setting } from '@/types/database';
import { Loading } from '@/components/ui/Loading';
import { Settings as SettingsIcon, Save, Loader2 } from 'lucide-react';

const GENERAL_KEYS = [
  { key: 'business_name', label: 'Business Name' },
  { key: 'business_address', label: 'Business Address' },
  { key: 'business_phone', label: 'Business Phone' },
  { key: 'currency_symbol', label: 'Currency Symbol' },
];

export function SettingsPage() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('settings').select('*').eq('category', 'general');
      const map: Record<string, string> = {};
      (data as Setting[] ?? []).forEach((s) => { map[s.key] = s.value; });
      setSettings(map);
      setLoading(false);
    };
    load();
  }, []);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    for (const [key, value] of Object.entries(settings)) {
      await supabase.from('settings').upsert({ key, value, category: 'general' }, { onConflict: 'key' });
    }
    await supabase.from('audit_logs').insert({ user_id: profile.id, action: 'settings_updated', entity: 'settings', new_value: { keys: Object.keys(settings) } as unknown });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) return <Loading label="Loading settings..." />;

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">General business configuration.</p>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><SettingsIcon size={20} /> Business Information</h2>
        <div className="space-y-4">
          {GENERAL_KEYS.map((field) => (
            <div key={field.key}>
              <label className="label">{field.label}</label>
              <input type="text" value={settings[field.key] ?? ''} onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })} className="input" />
            </div>
          ))}
        </div>
        <button onClick={save} disabled={saving} className="btn-primary mt-6">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      <div className="card p-6 mt-6">
        <h2 className="font-semibold text-slate-900 mb-2">Payment Policy</h2>
        <div className="rounded-xl bg-teal-50 border border-teal-200 p-4">
          <p className="text-sm text-teal-800 font-medium">M-Pesa is the only accepted payment method.</p>
          <p className="text-xs text-teal-700 mt-1">Cash payment is not available in the POS. This setting cannot be changed.</p>
        </div>
      </div>
    </div>
  );
}
