import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Product, Category, CartItem, Shift, Customer } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, X, Loader2,
  UtensilsCrossed, UserPlus, AlertCircle,
} from 'lucide-react';

export function POSPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null | undefined>(undefined);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [{ data: productsData }, { data: categoriesData }, { data: inventoryData }, { data: shift }] = await Promise.all([
        supabase.from('products').select('*, category:categories(*)').eq('is_active', true).order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('inventory').select('product_id, quantity, store_id'),
        profile ? supabase.from('shifts').select('*').eq('cashier_id', profile.id).eq('status', 'open').maybeSingle() : Promise.resolve({ data: null }),
      ]);

      setProducts((productsData as Product[]) ?? []);
      setCategories((categoriesData as Category[]) ?? []);
      const invMap: Record<string, number> = {};
      (inventoryData ?? []).forEach((i: { product_id: string; quantity: number }) => {
        invMap[i.product_id] = (invMap[i.product_id] ?? 0) + i.quantity;
      });
      setInventory(invMap);
      setActiveShift(shift as Shift | null);
      setLoading(false);
    };
    loadData();
  }, [profile?.id]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = activeCategory === 'all' || p.category_id === activeCategory;
      const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategory, search]);

  const cartTotal = cart.reduce((sum, item) => sum + item.product.selling_price * item.quantity, 0);

  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.product.id === product.id);
    const stock = inventory[product.id] ?? 0;
    if (!product.allow_negative_stock && existing && existing.quantity >= stock && stock > 0) {
      return;
    }
    if (existing) {
      setCart(cart.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => prev.map((item) => {
      if (item.product.id !== productId) return item;
      const newQty = item.quantity + delta;
      if (newQty <= 0) return null;
      return { ...item, quantity: newQty };
    }).filter(Boolean) as CartItem[]);
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const checkout = () => {
    if (cart.length === 0) return;
    if (!activeShift) {
      navigate('/cashier/shift');
      return;
    }
    const cartData = cart.map((item) => ({
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: item.quantity,
      unit_price: item.product.selling_price,
      subtotal: item.product.selling_price * item.quantity,
    }));
    navigate('/cashier/checkout', {
      state: {
        cart: cartData,
        shiftId: activeShift.id,
        customerId: selectedCustomer?.id ?? null,
        customerName: selectedCustomer?.name ?? null,
      },
    });
  };

  const searchCustomers = async () => {
    if (!customerSearch.trim()) return;
    const { data } = await supabase
      .from('customers')
      .select('*')
      .or(`name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%,employee_number.ilike.%${customerSearch}%`)
      .limit(10);
    setCustomers((data as Customer[]) ?? []);
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400"><Loader2 className="animate-spin inline mr-2" size={20} />Loading products...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search + Categories */}
      <div className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 space-y-3">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by name or SKU..."
            className="input pl-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${activeCategory === 'all' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${activeCategory === cat.id ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Products grid */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 lg:p-6">
          {filteredProducts.length === 0 ? (
            <EmptyState icon={<UtensilsCrossed size={48} />} title="No products found" description="Try a different search or category." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredProducts.map((product) => {
                const stock = inventory[product.id] ?? 0;
                const outOfStock = stock <= 0 && !product.allow_negative_stock;
                return (
                  <button
                    key={product.id}
                    onClick={() => !outOfStock && addToCart(product)}
                    disabled={outOfStock}
                    className={`card p-4 text-left transition-all ${outOfStock ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md hover:border-teal-300 active:scale-[0.98] cursor-pointer'}`}
                  >
                    <div className="aspect-square rounded-xl bg-slate-100 mb-3 flex items-center justify-center overflow-hidden">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <UtensilsCrossed size={32} className="text-slate-300" />
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 line-clamp-1">{product.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{product.category?.name ?? 'Uncategorized'}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-base font-bold text-teal-700">{formatCurrency(product.selling_price)}</span>
                      <span className={`text-xs ${stock <= 5 ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
                        {stock} in stock
                      </span>
                    </div>
                    {outOfStock && (
                      <p className="text-xs text-red-600 font-medium mt-1">Out of stock</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart sidebar */}
        <div className="w-full max-w-sm bg-white border-l border-slate-200 flex flex-col hidden md:flex">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <ShoppingCart size={18} /> Cart
              {cart.length > 0 && <span className="badge-info">{cart.length}</span>}
            </h2>
            {selectedCustomer && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <UserPlus size={14} />
                <span className="truncate max-w-24">{selectedCustomer.name}</span>
                <button onClick={() => setSelectedCustomer(null)}><X size={14} className="text-slate-400" /></button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-2">
            {cart.length === 0 ? (
              <EmptyState icon={<ShoppingCart size={40} />} title="Cart is empty" description="Tap products to add them." />
            ) : (
              cart.map((item) => (
                <div key={item.product.id} className="flex items-center gap-2 bg-slate-50 rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{item.product.name}</p>
                    <p className="text-xs text-slate-500">{formatCurrency(item.product.selling_price)} each</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateQty(item.product.id, -1)} className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100">
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                    <button onClick={() => updateQty(item.product.id, 1)} className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100">
                      <Plus size={14} />
                    </button>
                    <button onClick={() => removeFromCart(item.product.id)} className="w-7 h-7 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center ml-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-slate-200 p-4 space-y-3">
            <button onClick={() => setShowCustomerModal(true)} className="btn-secondary w-full text-sm">
              <UserPlus size={16} /> {selectedCustomer ? 'Change Customer' : 'Add Customer (optional)'}
            </button>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Total</span>
              <span className="text-2xl font-bold text-slate-900">{formatCurrency(cartTotal)}</span>
            </div>
            <button
              onClick={checkout}
              disabled={cart.length === 0}
              className="btn-primary btn-lg w-full"
            >
              {activeShift ? 'Checkout' : 'Open Shift First'}
              <ShoppingCart size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile cart button */}
      {cart.length > 0 && (
        <div className="md:hidden fixed bottom-4 right-4 z-30">
          <button
            onClick={checkout}
            className="btn-primary btn-lg rounded-full shadow-lg flex items-center gap-2"
          >
            <ShoppingCart size={20} />
            {formatCurrency(cartTotal)} ({cart.length})
          </button>
        </div>
      )}

      <Modal open={showCustomerModal} onClose={() => setShowCustomerModal(false)} title="Add Customer" size="sm">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Search by name, phone, or employee number..."
              className="input"
              onKeyDown={(e) => e.key === 'Enter' && searchCustomers()}
            />
            <button onClick={searchCustomers} className="btn-secondary">Search</button>
          </div>
          {customers.length > 0 && (
            <div className="space-y-2">
              {customers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCustomer(c); setShowCustomerModal(false); }}
                  className="w-full text-left p-3 rounded-xl hover:bg-slate-50 border border-slate-200 transition"
                >
                  <p className="text-sm font-medium text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.phone} {c.employee_number && `• ${c.employee_number}`}</p>
                </button>
              ))}
            </div>
          )}
          {!activeShift && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
              <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">You need an active shift to checkout.</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
