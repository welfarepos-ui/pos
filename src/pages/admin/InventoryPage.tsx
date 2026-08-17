import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Inventory, InventoryMovement, Product, Store } from '@/types/database';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { Boxes, Search, Edit, ArrowLeftRight, AlertTriangle, Loader2 } from 'lucide-react';

export function InventoryPage() {
  const { profile } = useAuth();
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustItem, setAdjustItem] = useState<Inventory | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustType, setAdjustType] = useState<'add' | 'remove' | 'set'>('add');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('inventory')
      .select('*, product:products(*), store:stores(*)')
      .order('created_at', { ascending: false });
    setInventory((data as Inventory[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdjust = (item: Inventory) => {
    setAdjustItem(item);
    setAdjustQty('');
    setAdjustReason('');
    setAdjustType('add');
    setShowAdjust(true);
  };

  const saveAdjust = async () => {
    if (!profile || !adjustItem || !adjustQty) return;
    setSaving(true);
    const qty = parseInt(adjustQty);
    const prevQty = adjustItem.quantity;
    let newQty: number;
    let movementQty: number;

    if (adjustType === 'add') { newQty = prevQty + qty; movementQty = qty; }
    else if (adjustType === 'remove') { newQty = Math.max(0, prevQty - qty); movementQty = -qty; }
    else { newQty = qty; movementQty = qty - prevQty; }

    await supabase.from('inventory').update({ quantity: newQty }).eq('id', adjustItem.id);
    await supabase.from('inventory_movements').insert({
      product_id: adjustItem.product_id,
      store_id: adjustItem.store_id,
      movement_type: 'adjustment',
      quantity: movementQty,
      previous_quantity: prevQty,
      new_quantity: newQty,
      reason: adjustReason || 'Manual adjustment',
      user_id: profile.id,
    });
    await supabase.from('audit_logs').insert({
      user_id: profile.id, action: 'inventory_adjusted', entity: 'inventory', entity_id: adjustItem.id,
      previous_value: { quantity: prevQty } as unknown, new_value: { quantity: newQty, reason: adjustReason } as unknown,
    });

    setSaving(false);
    setShowAdjust(false);
    load();
  };

  const filtered = inventory.filter((i) =>
    !search || (i.product?.name ?? '').toLowerCase().includes(search.toLowerCase()) || (i.product?.sku ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Loading label="Loading inventory..." />;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
        <p className="text-slate-500 mt-1">Manage stock levels across stores.</p>
      </div>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by product name or SKU..." className="input pl-10" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Boxes size={48} />} title="No inventory found" description="Inventory will appear when products are added to stores." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Product</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">SKU</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Store</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">In Stock</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Min Stock</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((i) => {
                  const lowStock = i.quantity <= i.minimum_stock;
                  const outOfStock = i.quantity <= 0;
                  return (
                    <tr key={i.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{i.product?.name ?? 'Unknown'}</td>
                      <td className="px-4 py-3 text-slate-600">{i.product?.sku ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{i.store?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold">{i.quantity}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{i.minimum_stock}</td>
                      <td className="px-4 py-3">
                        {outOfStock ? <span className="badge-danger"><AlertTriangle size={12} /> Out of stock</span> :
                         lowStock ? <span className="badge-warning"><AlertTriangle size={12} /> Low stock</span> :
                         <span className="badge-success">In stock</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openAdjust(i)} className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"><Edit size={16} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={showAdjust} onClose={() => setShowAdjust(false)} title="Adjust Stock" size="sm">
        {adjustItem && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="font-medium text-slate-900">{adjustItem.product?.name}</p>
              <p className="text-sm text-slate-500">Current stock: {adjustItem.quantity} {adjustItem.product?.unit}</p>
            </div>
            <div>
              <label className="label">Adjustment type</label>
              <select value={adjustType} onChange={(e) => setAdjustType(e.target.value as 'add' | 'remove' | 'set')} className="input">
                <option value="add">Add stock</option>
                <option value="remove">Remove stock</option>
                <option value="set">Set to exact value</option>
              </select>
            </div>
            <div>
              <label className="label">Quantity</label>
              <input type="number" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} className="input" placeholder="10" />
            </div>
            <div>
              <label className="label">Reason</label>
              <input type="text" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} className="input" placeholder="Damaged, expired, recount, etc." />
            </div>
            <button onClick={saveAdjust} disabled={saving || !adjustQty} className="btn-primary w-full">
              {saving ? <Loader2 size={18} className="animate-spin" /> : null}
              Save Adjustment
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function StockMovementsPage() {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('inventory_movements')
        .select('*, product:products(name, sku)')
        .order('created_at', { ascending: false })
        .limit(100);
      setMovements((data as InventoryMovement[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <Loading label="Loading stock movements..." />;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Stock Movements</h1>
        <p className="text-slate-500 mt-1">Traceable history of all stock changes.</p>
      </div>

      {movements.length === 0 ? (
        <EmptyState icon={<ArrowLeftRight size={48} />} title="No stock movements yet" description="Movements will appear when inventory is adjusted." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Product</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Change</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Previous</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">New</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(m.created_at)}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{m.product?.name ?? 'Unknown'}</td>
                    <td className="px-4 py-3"><span className="badge-neutral capitalize">{m.movement_type}</span></td>
                    <td className={`px-4 py-3 text-right font-semibold ${m.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{m.quantity > 0 ? '+' : ''}{m.quantity}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{m.previous_quantity}</td>
                    <td className="px-4 py-3 text-right text-slate-900 font-medium">{m.new_quantity}</td>
                    <td className="px-4 py-3 text-slate-500">{m.reason ?? '—'}</td>
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
