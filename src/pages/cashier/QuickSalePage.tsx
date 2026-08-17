import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Product, Category, CartItem, Shift } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { Search, ShoppingCart, Loader2, Zap, Plus, ArrowRight } from 'lucide-react';

export function QuickSalePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null | undefined>(undefined);

  useEffect(() => {
    const load = async () => {
      if (!profile) return;
      const [{ data: productsData }, { data: categoriesData }, { data: shift }] = await Promise.all([
        supabase.from('products').select('*, category:categories(*)').eq('is_active', true).order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('shifts').select('*').eq('cashier_id', profile.id).eq('status', 'open').maybeSingle(),
      ]);
      setProducts((productsData as Product[]) ?? []);
      setCategories((categoriesData as Category[]) ?? []);
      setActiveShift(shift as Shift | null);
      setLoading(false);
    };
    load();
  }, [profile?.id]);

  const filtered = useMemo(() =>
    products.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())),
    [products, search]
  );

  const addToCart = (product: Product) => {
    const existing = cart.find((i) => i.product.id === product.id);
    if (existing) {
      setCart(cart.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const total = cart.reduce((sum, i) => sum + i.product.selling_price * i.quantity, 0);

  const checkout = () => {
    if (!activeShift) { navigate('/cashier/shift'); return; }
    if (cart.length === 0) return;
    const cartData = cart.map((i) => ({
      product_id: i.product.id, product_name: i.product.name,
      quantity: i.quantity, unit_price: i.product.selling_price,
      subtotal: i.product.selling_price * i.quantity,
    }));
    navigate('/cashier/checkout', { state: { cart: cartData, shiftId: activeShift.id, customerId: null, customerName: null } });
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400"><Loader2 className="animate-spin inline mr-2" size={20} />Loading...</div>;
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
          <Zap size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quick Sale</h1>
          <p className="text-slate-500 mt-1">Fast checkout — tap products and pay.</p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="input pl-10" autoFocus />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Search size={48} />} title="No products found" />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          {filtered.map((p) => {
            const inCart = cart.find((i) => i.product.id === p.id);
            return (
              <button key={p.id} onClick={() => addToCart(p)} className={`card p-4 text-left transition-all hover:shadow-md active:scale-[0.98] ${inCart ? 'border-teal-400 ring-2 ring-teal-400/20' : ''}`}>
                <h3 className="text-sm font-semibold text-slate-900 line-clamp-1">{p.name}</h3>
                <p className="text-xs text-slate-500">{p.category?.name}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-base font-bold text-teal-700">{formatCurrency(p.selling_price)}</span>
                  {inCart && <span className="badge-info">{inCart.quantity}x</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {cart.length > 0 && (
        <div className="card p-4 sticky bottom-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900">{cart.length} item(s)</h3>
            <span className="text-2xl font-bold text-slate-900">{formatCurrency(total)}</span>
          </div>
          <div className="flex gap-2 flex-wrap mb-3">
            {cart.map((i) => (
              <span key={i.product.id} className="badge-neutral">
                {i.product.name} x{i.quantity}
              </span>
            ))}
          </div>
          <button onClick={checkout} className="btn-primary btn-lg w-full">
            <ShoppingCart size={18} /> Pay {formatCurrency(total)} via M-Pesa <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
