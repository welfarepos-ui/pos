import { Loader2 } from 'lucide-react';

export function Loading({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <Loader2 size={32} className="animate-spin mb-2" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
