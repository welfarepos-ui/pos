import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Shift, Sale } from '@/types/database';
import { formatDateTime, formatTime, formatCurrency } from '@/lib/utils';
import { Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export function ShiftPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [activeShift, setActiveShift] = useState<Shift | null | undefined>(undefined);
  const [shiftSales, setShiftSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const fetchShift = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('shifts')
      .select('*')
      .eq('cashier_id', profile.id)
      .eq('status', 'open')
      .maybeSingle();
    setActiveShift(data as Shift | null);

    if (data) {
      const { data: sales } = await supabase
        .from('sales')
        .select('*')
        .eq('shift_id', data.id)
        .order('created_at', { ascending: false });
      setShiftSales((sales as Sale[]) ?? []);
    }
  };

  useEffect(() => {
    fetchShift();
  }, [profile?.id]);

  const openShift = async () => {
    if (!profile) return;
    setLoading(true);
    const { data: lastShift } = await supabase
      .from('shifts')
      .select('shift_number')
      .eq('cashier_id', profile.id)
      .order('shift_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextNumber = ((lastShift as { shift_number: number } | null)?.shift_number ?? 0) + 1;

    const { data: newShift, error } = await supabase
      .from('shifts')
      .insert({
        cashier_id: profile.id,
        shift_number: nextNumber,
        opening_time: new Date().toISOString(),
        status: 'open',
        opening_cash: 0,
        device_info: navigator.userAgent,
      })
      .select()
      .single();

    setLoading(false);
    if (!error && newShift) {
      await supabase.from('audit_logs').insert({
        user_id: profile.id,
        action: 'shift_opened',
        entity: 'shifts',
        entity_id: newShift.id,
        new_value: { shift_number: nextNumber } as unknown,
      });
      setActiveShift(newShift as Shift);
      navigate('/cashier');
    }
  };

  const closeShift = async () => {
    if (!activeShift || !profile) return;
    setLoading(true);
    await supabase
      .from('shifts')
      .update({ status: 'closed', closing_time: new Date().toISOString() })
      .eq('id', activeShift.id);

    await supabase.from('audit_logs').insert({
      user_id: profile.id,
      action: 'shift_closed',
      entity: 'shifts',
      entity_id: activeShift.id,
      new_value: { closing_time: new Date().toISOString() } as unknown,
    });

    setLoading(false);
    setConfirmClose(false);
    setActiveShift(null);
    setShiftSales([]);
  };

  if (activeShift === undefined) {
    return <div className="p-8 text-center text-slate-400"><Loader2 className="animate-spin inline mr-2" size={20} />Loading shift...</div>;
  }

  if (!activeShift) {
    return (
      <div className="max-w-2xl mx-auto p-6 lg:p-8">
        <div className="card p-8 text-center">
          <div className="inline-flex p-4 bg-teal-50 rounded-2xl mb-4">
            <Clock size={40} className="text-teal-700" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Open Shift</h1>
          <p className="text-slate-500 mb-8">You need an active shift to start making sales.</p>

          <div className="bg-slate-50 rounded-xl p-6 text-left mb-8 space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Cashier</span>
              <span className="text-sm font-medium text-slate-900">{profile?.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Date</span>
              <span className="text-sm font-medium text-slate-900">{formatDateTime(new Date())}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Payment method</span>
              <span className="text-sm font-medium text-slate-900">M-Pesa only</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Opening cash</span>
              <span className="text-sm font-medium text-slate-900">KSh 0</span>
            </div>
          </div>

          <button onClick={openShift} disabled={loading} className="btn-primary btn-xl w-full">
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Clock size={20} />}
            {loading ? 'Opening...' : 'OPEN SHIFT'}
          </button>
        </div>
      </div>
    );
  }

  const completed = shiftSales.filter((s) => s.payment_status === 'success');
  const pending = shiftSales.filter((s) => s.payment_status === 'pending');
  const failed = shiftSales.filter((s) => s.payment_status === 'failed');
  const totalSales = completed.reduce((sum, s) => sum + Number(s.total), 0);

  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-8">
      <div className="card p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-emerald-50 rounded-xl">
            <CheckCircle2 size={28} className="text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Shift #{String(activeShift.shift_number).padStart(4, '0')}</h1>
            <p className="text-sm text-slate-500">Opened {formatTime(activeShift.opening_time)}</p>
          </div>
          <span className="badge-success ml-auto">OPEN</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs text-slate-500">Transactions</p>
            <p className="text-xl font-bold text-slate-900">{shiftSales.length}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs text-slate-500">M-Pesa Sales</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(totalSales)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs text-slate-500">Pending</p>
            <p className="text-xl font-bold text-amber-600">{pending.length}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs text-slate-500">Failed</p>
            <p className="text-xl font-bold text-red-600">{failed.length}</p>
          </div>
        </div>

        {!confirmClose ? (
          <button onClick={() => setConfirmClose(true)} className="btn-danger btn-lg w-full">
            CLOSE SHIFT
          </button>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Are you sure you want to close this shift?</p>
                <p className="text-xs text-amber-700 mt-1">You will not be able to make sales until you open a new shift.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmClose(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={closeShift} disabled={loading} className="btn-danger flex-1">
                {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                {loading ? 'Closing...' : 'Confirm Close'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
