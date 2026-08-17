import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { StatCard } from '@/components/ui/StatCard';
import { formatCurrency } from '@/lib/utils';
import {
  ShoppingCart, CheckCircle2, Clock, XCircle, UtensilsCrossed,
  Loader2, ArrowRight, Zap,
} from 'lucide-react';

export function CashierDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hasShift, setHasShift] = useState(false);
  const [stats, setStats] = useState({
    todaySales: 0,
    shiftSales: 0,
    transactions: 0,
    completed: 0,
    pending: 0,
    failed: 0,
    openTabs: 0,
  });

  useEffect(() => {
    const load = async () => {
      if (!profile) return;
      setLoading(true);

      const { data: shift } = await supabase
        .from('shifts')
        .select('id')
        .eq('cashier_id', profile.id)
        .eq('status', 'open')
        .maybeSingle();

      setHasShift(!!shift);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const { data: todaySalesData } = await supabase
        .from('sales')
        .select('total, payment_status')
        .gte('created_at', todayISO);

      const allSales = todaySalesData ?? [];
      const completed = allSales.filter((s) => s.payment_status === 'success');
      const pending = allSales.filter((s) => s.payment_status === 'pending');
      const failed = allSales.filter((s) => s.payment_status === 'failed');

      let shiftSales = 0;
      if (shift) {
        const { data: ss } = await supabase
          .from('sales')
          .select('total, payment_status')
          .eq('shift_id', shift.id);
        shiftSales = (ss ?? []).filter((s) => s.payment_status === 'success').reduce((sum, s) => sum + Number(s.total), 0);
      }

      const { count: openTabs } = await supabase
        .from('tabs')
        .select('id', { count: 'exact', head: true })
        .in('status', ['open', 'payment_pending']);

      setStats({
        todaySales: completed.reduce((sum, s) => sum + Number(s.total), 0),
        shiftSales,
        transactions: allSales.length,
        completed: completed.length,
        pending: pending.length,
        failed: failed.length,
        openTabs: openTabs ?? 0,
      });
      setLoading(false);
    };
    load();
  }, [profile?.id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-400"><Loader2 className="animate-spin inline mr-2" size={20} />Loading dashboard...</div>;
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {profile?.full_name.split(' ')[0]}</h1>
        <p className="text-slate-500 mt-1">Here's your shift overview.</p>
      </div>

      {!hasShift && (
        <div className="card p-6 mb-6 bg-gradient-to-r from-teal-50 to-emerald-50 border-teal-200">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-semibold text-slate-900">No active shift</h3>
              <p className="text-sm text-slate-600 mt-0.5">Open a shift to start making sales.</p>
            </div>
            <button onClick={() => navigate('/cashier/shift')} className="btn-primary">
              Open Shift <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Today's Sales" value={formatCurrency(stats.todaySales)} icon={<ShoppingCart size={20} />} accent="teal" />
        <StatCard label="Shift Sales" value={formatCurrency(stats.shiftSales)} icon={<CheckCircle2 size={20} />} accent="emerald" />
        <StatCard label="Transactions" value={stats.transactions} icon={<ShoppingCart size={20} />} accent="blue" />
        <StatCard label="Open Tabs" value={stats.openTabs} icon={<UtensilsCrossed size={20} />} accent="violet" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="M-Pesa Completed" value={stats.completed} icon={<CheckCircle2 size={20} />} accent="emerald" />
        <StatCard label="Pending Payments" value={stats.pending} icon={<Clock size={20} />} accent="amber" />
        <StatCard label="Failed Payments" value={stats.failed} icon={<XCircle size={20} />} accent="rose" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/cashier/pos')}
          className="card p-6 text-left card-hover group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-teal-50 rounded-xl text-teal-700">
              <ShoppingCart size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Start Selling</h3>
              <p className="text-sm text-slate-500">Open the POS to make a sale</p>
            </div>
            <ArrowRight size={20} className="ml-auto text-slate-300 group-hover:text-teal-600 transition" />
          </div>
        </button>

        <button
          onClick={() => navigate('/cashier/quick-sale')}
          className="card p-6 text-left card-hover group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
              <Zap size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Quick Sale</h3>
              <p className="text-sm text-slate-500">Fast checkout in a few taps</p>
            </div>
            <ArrowRight size={20} className="ml-auto text-slate-300 group-hover:text-amber-600 transition" />
          </div>
        </button>
      </div>
    </div>
  );
}
