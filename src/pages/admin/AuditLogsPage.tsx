import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { AuditLog } from '@/types/database';
import { formatDateTime } from '@/lib/utils';
import { Loading } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScrollText, Search } from 'lucide-react';

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('audit_logs').select('*, user:profiles(*)').order('created_at', { ascending: false }).limit(200);
      setLogs((data as AuditLog[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = logs.filter((l) =>
    !search || l.action.toLowerCase().includes(search.toLowerCase()) || l.entity.toLowerCase().includes(search.toLowerCase()) || (l.user?.full_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Loading label="Loading audit logs..." />;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
        <p className="text-slate-500 mt-1">Immutable record of all sensitive operations.</p>
      </div>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by action, entity, or user..." className="input pl-10" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ScrollText size={48} />} title="No audit logs" description="Sensitive actions will be logged here." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">User</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Entity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                    <td className="px-4 py-3 text-slate-900">{l.user?.full_name ?? 'System'}</td>
                    <td className="px-4 py-3"><span className="badge-info">{l.action}</span></td>
                    <td className="px-4 py-3 text-slate-600">{l.entity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
