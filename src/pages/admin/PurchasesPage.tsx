import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Purchase, Supplier, Product, PurchaseItem } from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Loading } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { ShoppingCart, Plus, Trash2, Loader2 } from 'lucide-react';

interface PurchaseWithRelations extends Purchase {
  supplier?: Supplier;
  purchase_items?: (PurchaseItem & { product?: Product })[];
}

export function PurchasesPage() {
  const { profile } = useAuth();
  const [purchases, setPurchases] = useState<PurchaseWithRelations[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ supplier_id: '', invoice_number: '', notes: '' });
  const [items, setItems] = useState<{ product_id: string; quantity: string; buying_price: string }[]>([]);

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: s }, { data: prod }] = await Promise.all([
      supabase.from('purchases').select('*, supplier:suppliers(*), purchase_items(*, product:products(*))').order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('products').select('*').order('name'),
    ]);
    setPurchases((p as PurchaseWithRelations[]) ?? []);
    setSuppliers((s as Supplier[]) ?? []);
    setProducts((prod as Product[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addItem = () => setItems([...items, { product_id: '', quantity: '1', buying_price: '' }]);
  const updateItem = (i: number, field: string, value: string) => setItems(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const total = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.buying_price) || 0), 0);

  const save = async () => {
    if (!profile || !form.supplier_id || items.length === 0) return;
    setSaving(true);
    const { data: purchase, error } = await supabase.from('purchases').insert({
      supplier_id: form.supplier_id,
      invoice_number: form.invoice_number || null,
      purchase_date: new Date().toISOString().split('T')[0],
      total,
      payment_status: 'unpaid',
      amount_paid: 0,
      balance: total,
      received_by: profile.id,
      notes: form.notes || null,
    }).select().single();

    if (!error && purchase) {
      const purchaseItems = items.filter((i) => i.product_id && i.quantity).map((item) => ({
        purchase_id: purchase.id,
        product_id: item.product_id,
        quantity: Number(item.quantity),
        buying_price: Number(item.buying_price),
        subtotal: Number(item.quantity) * Number(item.buying_price),
      }));
      await supabase.from('purchase_items').insert(purchaseItems);

      for (const item of purchaseItems) {
        const { data: inv } = await supabase.from('inventory').select('id, quantity, store_id').eq('product_id', item.product_id).maybeSingle();
        if (inv) {
          const newQty = (inv as { quantity: number; id: string; store_id: string }).quantity + item.quantity;
          await supabase.from('inventory').update({ quantity: newQty }).eq('id', (inv as { id: string }).id);
          await supabase.from('inventory_movements').insert({
            product_id: item.product_id,
            store_id: (inv as { store_id: string }).store_id,
            movement_type: 'purchase',
            quantity: item.quantity,
            previous_quantity: (inv as { quantity: number }).quantity,
            new_quantity: newQty,
            reason: `Purchase ${purchase.id.slice(0, 8)}`,
            user_id: profile.id,
          });
        }
      }

      await supabase.from('audit_logs').insert({ user_id: profile.id, action: 'purchase_created', entity: 'purchases', entity_id: purchase.id, new_value: { total } as unknown });
    }

    setSaving(false); setShowModal(false);
    setForm({ supplier_id: '', invoice_number: '', notes: '' });
    setItems([]);
    load();
  };

  if (loading) return <Loading label="Loading purchases..." />;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-slate-900">Purchases</h1><p className="text-slate-500 mt-1">Record stock purchases from suppliers.</p></div>
        <button onClick={() => { setForm({ supplier_id: '', invoice_number: '', notes: '' }); setItems([]); setShowModal(true); }} className="btn-primary"><Plus size={18} /> New Purchase</button>
      </div>

      {purchases.length === 0 ? (
        <EmptyState icon={<ShoppingCart size={48} />} title="No purchases yet" description="Create a purchase to increase inventory." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Supplier</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Invoice #</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchases.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{formatDate(p.purchase_date)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{p.supplier?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{p.invoice_number ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(p.total))}</td>
                  <td className="px-4 py-3"><span className={p.payment_status === 'paid' ? 'badge-success' : p.payment_status === 'partial' ? 'badge-warning' : 'badge-danger'}>{p.payment_status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Purchase" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Supplier</label>
              <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className="input">
                <option value="">Select supplier...</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className="label">Invoice # (optional)</label><input type="text" value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} className="input" /></div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Items</label>
              <button onClick={addItem} className="btn-secondary text-xs"><Plus size={14} /> Add Item</button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select value={item.product_id} onChange={(e) => updateItem(i, 'product_id', e.target.value)} className="input flex-1">
                    <option value="">Select product...</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="number" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} className="input w-20" placeholder="Qty" />
                  <input type="number" value={item.buying_price} onChange={(e) => updateItem(i, 'buying_price', e.target.value)} className="input w-28" placeholder="Buy price" />
                  <button onClick={() => removeItem(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                </div>
              ))}
              {items.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No items added. Click "Add Item".</p>}
            </div>
          </div>

          <div><label className="label">Notes (optional)</label><input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" /></div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
            <span className="font-semibold text-slate-900">Total</span>
            <span className="text-2xl font-bold text-slate-900">{formatCurrency(total)}</span>
          </div>

          <button onClick={save} disabled={saving || !form.supplier_id || items.length === 0} className="btn-primary w-full">
            {saving ? <Loader2 size={18} className="animate-spin" /> : null}
            Create Purchase & Update Inventory
          </button>
        </div>
      </Modal>
    </div>
  );
}
