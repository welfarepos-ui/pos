import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Shift, Sale, Profile } from '@/types/database';
import { formatCurrency, formatTime, formatDate } from '@/lib/utils';
import { Loading } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { Clock } from 'lucide-react';

interface ShiftWithCashier extends Shift {
  cashier?: Profile;
}

export function AdminShiftsPage() {
  const [shifts, setShifts] = useState<ShiftWithCashier[]>([]);
  const [loading, setLoading] = useState(true);
  const [shiftStats, setShiftStats] = useState<Record<string, { transactions: number; total: number }>>({});

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('shifts')
        .select('*, cashier:profiles(*)')
        .order('created_at', { ascending: false })
        .limit(100);
      const shiftData = (data as ShiftWithCashier[]) ?? [];
      setShifts(shiftData);

      const statsMap: Record<string, { transactions: number; total: number }> = {};
      for (const s of shiftData) {
        const { data: sales } = await supabase.from('sales')
          .select('total, payment_status')
          .eq('shift_id', s.id)
          .eq('payment_status', 'success');
        const completed = (sales ?? []) as { total: number }[];
        statsMap[s.id] = {
          transactions: completed.length,
          total: completed.reduce((sum, sale) => sum + Number(sale.total), 0),
        };
      }
      setShiftStats(statsMap);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <Loading label="Loading shifts..." />;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Shifts</h1>
        <p className="text-slate-500 mt-1">View all cashier shifts and performance.</p>
      </div>

      {shifts.length === 0 ? (
        <EmptyState icon={<Clock size={48} />} title="No shifts yet" description="Shifts will appear here when cashiers start working." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shifts.map((s) => {
            const stats = shiftStats[s.id] ?? { transactions: 0, total: 0 };
            return (
              <div key={s.id} className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-bold text-lg text-slate-900">Shift #{String(s.shift_number).padStart(4, '0')}</p>
                    <p className="text-sm text-slate-500">{s.cashier?.full_name ?? 'Unknown'}</p>
                  </div>
                  <span className={s.status === 'open' ? 'badge-success' : 'badge-neutral'}>{s.status}</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Opened</span><span className="text-slate-900">{formatTime(s.opening_time)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Closed</span><span className="text-slate-900">{s.closing_time ? formatTime(s.closing_time) : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="text-slate-900">{formatDate(s.opening_time)}</span></div>
                </div>
                <div className="border-t border-slate-100 mt-4 pt-4 grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Transactions</p>
                    <p className="text-lg font-bold text-slate-900">{stats.transactions}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">M-Pesa Sales</p>
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(stats.total)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
