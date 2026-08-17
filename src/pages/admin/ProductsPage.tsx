import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Product, Category } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { Package, Plus, Search, Edit, Trash2, Loader2, UtensilsCrossed } from 'lucide-react';

export function ProductsPage() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', sku: '', barcode: '', category_id: '', buying_price: '', selling_price: '', unit: 'each', image_url: '', description: '', is_active: true, allow_negative_stock: false,
  });

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from('products').select('*, category:categories(*)').order('name'),
      supabase.from('categories').select('*').order('name'),
    ]);
    setProducts((p as Product[]) ?? []);
    setCategories((c as Category[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', sku: '', barcode: '', category_id: '', buying_price: '', selling_price: '', unit: 'each', image_url: '', description: '', is_active: true, allow_negative_stock: false });
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name, sku: p.sku, barcode: p.barcode ?? '', category_id: p.category_id ?? '',
      buying_price: String(p.buying_price), selling_price: String(p.selling_price),
      unit: p.unit, image_url: p.image_url ?? '', description: p.description ?? '',
      is_active: p.is_active, allow_negative_stock: p.allow_negative_stock,
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!profile || !form.name || !form.sku) return;
    setSaving(true);
    const payload = {
      name: form.name,
      sku: form.sku,
      barcode: form.barcode || null,
      category_id: form.category_id || null,
      buying_price: Number(form.buying_price) || 0,
      selling_price: Number(form.selling_price) || 0,
      unit: form.unit,
      image_url: form.image_url || null,
      description: form.description || null,
      is_active: form.is_active,
      allow_negative_stock: form.allow_negative_stock,
    };

    if (editing) {
      const { data, error } = await supabase.from('products').update(payload).eq('id', editing.id).select('*, category:categories(*)').single();
      if (!error && data) {
        setProducts(products.map((p) => p.id === editing.id ? data as Product : p));
        await supabase.from('audit_logs').insert({ user_id: profile.id, action: 'product_updated', entity: 'products', entity_id: editing.id, previous_value: editing as unknown, new_value: payload as unknown });
      }
    } else {
      const { data, error } = await supabase.from('products').insert(payload).select('*, category:categories(*)').single();
      if (!error && data) {
        setProducts([...products, data as Product]);
        await supabase.from('audit_logs').insert({ user_id: profile.id, action: 'product_created', entity: 'products', entity_id: (data as Product).id, new_value: payload as unknown });
      }
    }
    setSaving(false);
    setShowModal(false);
  };

  const remove = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    await supabase.from('products').delete().eq('id', p.id);
    setProducts(products.filter((x) => x.id !== p.id));
    await supabase.from('audit_logs').insert({ user_id: profile!.id, action: 'product_deleted', entity: 'products', entity_id: p.id, previous_value: p as unknown });
  };

  const filtered = products.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()) || (p.barcode ?? '').includes(search)
  );

  if (loading) return <Loading label="Loading products..." />;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-slate-500 mt-1">Manage your cafeteria menu items.</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={18} /> Add Product</button>
      </div>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, SKU, or barcode..." className="input pl-10" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Package size={48} />} title="No products found" description="Add your first product to get started." action={<button onClick={openAdd} className="btn-primary"><Plus size={18} /> Add Product</button>} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Product</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">SKU</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Category</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Buy Price</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Sell Price</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                          {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover rounded-lg" /> : <UtensilsCrossed size={16} className="text-slate-400" />}
                        </div>
                        <span className="font-medium text-slate-900">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.sku}</td>
                    <td className="px-4 py-3 text-slate-600">{p.category?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(p.buying_price)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(p.selling_price)}</td>
                    <td className="px-4 py-3">
                      <span className={p.is_active ? 'badge-success' : 'badge-neutral'}>{p.is_active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(p)} className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"><Edit size={16} /></button>
                        <button onClick={() => remove(p)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Product' : 'Add Product'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Product name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Tea" />
            </div>
            <div>
              <label className="label">SKU</label>
              <input type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="input" placeholder="BEV-001" />
            </div>
            <div>
              <label className="label">Barcode (optional)</label>
              <input type="text" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="input" placeholder="60010001" />
            </div>
            <div>
              <label className="label">Category</label>
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="input">
                <option value="">Uncategorized</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Buying price (KSh)</label>
              <input type="number" value={form.buying_price} onChange={(e) => setForm({ ...form, buying_price: e.target.value })} className="input" placeholder="15" />
            </div>
            <div>
              <label className="label">Selling price (KSh)</label>
              <input type="number" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} className="input" placeholder="30" />
            </div>
            <div>
              <label className="label">Unit</label>
              <input type="text" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input" placeholder="cup, plate, each" />
            </div>
            <div>
              <label className="label">Image URL (optional)</label>
              <input type="text" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="input" placeholder="https://..." />
            </div>
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" rows={2} placeholder="Hot masala tea" />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.allow_negative_stock} onChange={(e) => setForm({ ...form, allow_negative_stock: e.target.checked })} className="rounded" />
              Allow negative stock
            </label>
          </div>
          <button onClick={save} disabled={saving || !form.name || !form.sku} className="btn-primary w-full">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            {editing ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
