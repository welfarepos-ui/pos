import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: { value: string; positive: boolean };
  accent?: 'teal' | 'amber' | 'blue' | 'rose' | 'violet' | 'emerald' | 'slate';
}

const accentClasses = {
  teal: 'bg-teal-50 text-teal-700',
  amber: 'bg-amber-50 text-amber-700',
  blue: 'bg-blue-50 text-blue-700',
  rose: 'bg-rose-50 text-rose-700',
  violet: 'bg-violet-50 text-violet-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  slate: 'bg-slate-100 text-slate-700',
};

export function StatCard({ label, value, icon, trend, accent = 'teal' }: StatCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`p-2.5 rounded-xl ${accentClasses[accent]}`}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          <span className={trend.positive ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
            {trend.value}
          </span>
          <span className="text-slate-400">vs last period</span>
        </div>
      )}
    </div>
  );
}
