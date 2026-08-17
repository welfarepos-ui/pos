import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Category } from '@/types/database';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { Tags, Plus, Edit, Trash2, Loader2 } from 'lucide-react';

export function CategoriesPage() {
  const { profile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('categories').select('*').order('name');
    setCategories((data as Category[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!profile || !name) return;
    setSaving(true);
    if (editing) {
      const { data, error } = await supabase.from('categories').update({ name, description: description || null }).eq('id', editing.id).select().single();
      if (!error && data) {
        setCategories(categories.map((c) => c.id === editing.id ? data as Category : c));
        await supabase.from('audit_logs').insert({ user_id: profile.id, action: 'category_updated', entity: 'categories', entity_id: editing.id });
      }
    } else {
      const { data, error } = await supabase.from('categories').insert({ name, description: description || null }).select().single();
      if (!error && data) {
        setCategories([...categories, data as Category]);
        await supabase.from('audit_logs').insert({ user_id: profile.id, action: 'category_created', entity: 'categories', entity_id: (data as Category).id });
      }
    }
    setSaving(false);
    setShowModal(false);
    setName(''); setDescription('');
  };

  const remove = async (c: Category) => {
    if (!confirm(`Delete "${c.name}"? Products in this category will become uncategorized.`)) return;
    await supabase.from('categories').delete().eq('id', c.id);
    setCategories(categories.filter((x) => x.id !== c.id));
    await supabase.from('audit_logs').insert({ user_id: profile!.id, action: 'category_deleted', entity: 'categories', entity_id: c.id });
  };

  if (loading) return <Loading label="Loading categories..." />;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
          <p className="text-slate-500 mt-1">Organize products into categories.</p>
        </div>
        <button onClick={() => { setEditing(null); setName(''); setDescription(''); setShowModal(true); }} className="btn-primary"><Plus size={18} /> Add Category</button>
      </div>

      {categories.length === 0 ? (
        <EmptyState icon={<Tags size={48} />} title="No categories yet" description="Add categories to organize your products." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-teal-50 rounded-xl text-teal-700"><Tags size={20} /></div>
                  <div>
                    <p className="font-semibold text-slate-900">{c.name}</p>
                    {c.description && <p className="text-xs text-slate-500 mt-0.5">{c.description}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditing(c); setName(c.name); setDescription(c.description ?? ''); setShowModal(true); }} className="p-1.5 text-slate-400 hover:text-teal-600"><Edit size={16} /></button>
                  <button onClick={() => remove(c)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Category' : 'Add Category'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Category name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Beverages" />
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="input" placeholder="Tea, coffee, juice, sodas" />
          </div>
          <button onClick={save} disabled={saving || !name} className="btn-primary w-full">
            {saving ? <Loader2 size={18} className="animate-spin" /> : null}
            {editing ? 'Save Changes' : 'Add Category'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
