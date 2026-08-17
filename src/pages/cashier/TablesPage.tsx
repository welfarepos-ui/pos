import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { TableEntity, Tab, Product, Category, CartItem, Shift, Customer } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  UtensilsCrossed, Plus, Minus, Trash2, Loader2, UserPlus,
  Search, ShoppingCart, ArrowLeft, X,
} from 'lucide-react';

export function TablesPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tables, setTables] = useState<TableEntity[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<Tab | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tabItems, setTabItems] = useState<Record<string, CartItem[]>>({});
  const [showProductModal, setShowProductModal] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [activeShift, setActiveShift] = useState<Shift | null | undefined>(undefined);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const loadData = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: tablesData }, { data: tabsData }, { data: productsData }, { data: categoriesData }, { data: shift }] = await Promise.all([
      supabase.from('tables').select('*').order('table_number'),
      supabase.from('tabs').select('*, table:tables(*), customer:customers(*)').in('status', ['open', 'payment_pending']).order('created_at', { ascending: false }),
      supabase.from('products').select('*, category:categories(*)').eq('is_active', true).order('name'),
      supabase.from('categories').select('*').order('name'),
      supabase.from('shifts').select('*').eq('cashier_id', profile.id).eq('status', 'open').maybeSingle(),
    ]);

    setTables((tablesData as TableEntity[]) ?? []);
    setTabs((tabsData as Tab[]) ?? []);
    setProducts((productsData as Product[]) ?? []);
    setCategories((categoriesData as Category[]) ?? []);
    setActiveShift(shift as Shift | null);

    // Load tab items for each open tab
    const itemsMap: Record<string, CartItem[]> = {};
    for (const tab of (tabsData ?? [])) {
      const { data: items } = await supabase.from('tab_items').select('product_id, quantity, unit_price').eq('tab_id', tab.id);
      const cartItems: CartItem[] = [];
      for (const ti of (items ?? [])) {
        const product = (productsData as Product[])?.find((p) => p.id === ti.product_id);
        if (product) cartItems.push({ product, quantity: ti.quantity });
      }
      itemsMap[tab.id] = cartItems;
    }
    setTabItems(itemsMap);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [profile?.id]);

  const openTable = async (table: TableEntity) => {
    if (!activeShift || !profile) {
      navigate('/cashier/shift');
      return;
    }
    const { data: newTab } = await supabase.from('tabs').insert({
      table_id: table.id,
      cashier_id: profile.id,
      shift_id: activeShift.id,
      status: 'open',
      total: 0,
    }).select('*, table:tables(*), customer:customers(*)').single();
    if (newTab) {
      setTabs([newTab as Tab, ...tabs]);
      setTabItems({ ...tabItems, [(newTab as Tab).id]: [] });
      await supabase.from('tables').update({ status: 'occupied' }).eq('id', table.id);
      await supabase.from('audit_logs').insert({
        user_id: profile.id, action: 'tab_opened', entity: 'tabs', entity_id: newTab.id,
      });
      setSelectedTab(newTab as Tab);
    }
  };

  const getTableStatus = (tableId: string): TableEntity['status'] => {
    const table = tables.find((t) => t.id === tableId);
    return table?.status ?? 'available';
  };

  const getTabForTable = (tableId: string): Tab | null => {
    return tabs.find((t) => t.table_id === tableId) ?? null;
  };

  const addProductToTab = async (product: Product) => {
    if (!selectedTab || !profile) return;
    const currentItems = tabItems[selectedTab.id] ?? [];
    const existing = currentItems.find((i) => i.product.id === product.id);
    let newItems: CartItem[];

    if (existing) {
      newItems = currentItems.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
    } else {
      newItems = [...currentItems, { product, quantity: 1 }];
    }

    setTabItems({ ...tabItems, [selectedTab.id]: newItems });

    // Update DB
    if (existing) {
      await supabase.from('tab_items').update({
        quantity: existing.quantity + 1,
        subtotal: product.selling_price * (existing.quantity + 1),
      }).eq('tab_id', selectedTab.id).eq('product_id', product.id);
    } else {
      await supabase.from('tab_items').insert({
        tab_id: selectedTab.id,
        product_id: product.id,
        quantity: 1,
        unit_price: product.selling_price,
        subtotal: product.selling_price,
      });
    }

    const newTotal = newItems.reduce((sum, i) => sum + i.product.selling_price * i.quantity, 0);
    await supabase.from('tabs').update({ total: newTotal }).eq('id', selectedTab.id);
    setTabs(tabs.map((t) => t.id === selectedTab.id ? { ...t, total: newTotal } : t));
    setSelectedTab({ ...selectedTab, total: newTotal });
  };

  const updateTabItemQty = async (productId: string, delta: number) => {
    if (!selectedTab) return;
    const currentItems = tabItems[selectedTab.id] ?? [];
    const existing = currentItems.find((i) => i.product.id === productId);
    if (!existing) return;
    const newQty = existing.quantity + delta;
    if (newQty <= 0) {
      await supabase.from('tab_items').delete().eq('tab_id', selectedTab.id).eq('product_id', productId);
      const newItems = currentItems.filter((i) => i.product.id !== productId);
      setTabItems({ ...tabItems, [selectedTab.id]: newItems });
      const newTotal = newItems.reduce((sum, i) => sum + i.product.selling_price * i.quantity, 0);
      await supabase.from('tabs').update({ total: newTotal }).eq('id', selectedTab.id);
      setTabs(tabs.map((t) => t.id === selectedTab.id ? { ...t, total: newTotal } : t));
      setSelectedTab({ ...selectedTab, total: newTotal });
    } else {
      await supabase.from('tab_items').update({ quantity: newQty, subtotal: existing.product.selling_price * newQty })
        .eq('tab_id', selectedTab.id).eq('product_id', productId);
      const newItems = currentItems.map((i) => i.product.id === productId ? { ...i, quantity: newQty } : i);
      setTabItems({ ...tabItems, [selectedTab.id]: newItems });
      const newTotal = newItems.reduce((sum, i) => sum + i.product.selling_price * i.quantity, 0);
      await supabase.from('tabs').update({ total: newTotal }).eq('id', selectedTab.id);
      setTabs(tabs.map((t) => t.id === selectedTab.id ? { ...t, total: newTotal } : t));
      setSelectedTab({ ...selectedTab, total: newTotal });
    }
  };

  const payTab = async (tab: Tab) => {
    const items = tabItems[tab.id] ?? [];
    if (items.length === 0) return;
    const cartData = items.map((item) => ({
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: item.quantity,
      unit_price: item.product.selling_price,
      subtotal: item.product.selling_price * item.quantity,
    }));
    navigate('/cashier/checkout', {
      state: {
        cart: cartData,
        shiftId: tab.shift_id,
        customerId: tab.customer_id,
        customerName: tab.customer?.name ?? null,
        tabId: tab.id,
        tableId: tab.table_id,
      },
    });
  };

  const closeTab = async (tab: Tab) => {
    await supabase.from('tab_items').delete().eq('tab_id', tab.id);
    await supabase.from('tabs').delete().eq('id', tab.id);
    if (tab.table_id) await supabase.from('tables').update({ status: 'available' }).eq('id', tab.table_id);
    setTabs(tabs.filter((t) => t.id !== tab.id));
    setSelectedTab(null);
    loadData();
  };

  const searchCustomers = async () => {
    if (!customerSearch.trim()) return;
    const { data } = await supabase.from('customers').select('*')
      .or(`name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%`).limit(10);
    setCustomers((data as Customer[]) ?? []);
  };

  const attachCustomer = async (customer: Customer) => {
    if (!selectedTab) return;
    await supabase.from('tabs').update({ customer_id: customer.id }).eq('id', selectedTab.id);
    setSelectedTab({ ...selectedTab, customer_id: customer.id, customer });
    setShowCustomerModal(false);
    loadData();
  };

  const filteredProducts = products.filter((p) =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  if (loading) {
    return <div className="p-8 text-center text-slate-400"><Loader2 className="animate-spin inline mr-2" size={20} />Loading tables...</div>;
  }

  const statusColors: Record<TableEntity['status'], string> = {
    available: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    occupied: 'bg-amber-50 border-amber-200 text-amber-700',
    payment_pending: 'bg-blue-50 border-blue-200 text-blue-700',
    paid: 'bg-teal-50 border-teal-200 text-teal-700',
    closed: 'bg-slate-100 border-slate-200 text-slate-500',
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Tables & Tabs</h1>
        <p className="text-slate-500 mt-1">Manage dine-in orders by table.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-8">
        {tables.map((table) => {
          const tab = getTabForTable(table.id);
          const items = tab ? (tabItems[tab.id] ?? []) : [];
          return (
            <button
              key={table.id}
              onClick={() => tab ? setSelectedTab(tab) : openTable(table)}
              className={`card p-4 text-center border-2 transition-all hover:shadow-md active:scale-[0.98] ${statusColors[table.status]}`}
            >
              <UtensilsCrossed size={24} className="mx-auto mb-2" />
              <p className="font-bold text-lg">Table {table.table_number}</p>
              <p className="text-xs capitalize mt-1">{table.status.replace('_', ' ')}</p>
              {tab && items.length > 0 && (
                <p className="text-sm font-semibold mt-2">{formatCurrency(tab.total)}</p>
              )}
            </button>
          );
        })}
      </div>

      {tabs.length === 0 && tables.length > 0 && (
        <EmptyState icon={<UtensilsCrossed size={48} />} title="No open tabs" description="Tap a table to open a new tab." />
      )}

      {/* Tab detail modal */}
      <Modal open={!!selectedTab} onClose={() => setSelectedTab(null)} title={selectedTab ? `Table ${selectedTab.table?.table_number ?? ''}` : ''} size="lg">
        {selectedTab && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                {selectedTab.customer ? (
                  <p className="text-sm text-slate-600">Customer: <span className="font-medium">{selectedTab.customer.name}</span></p>
                ) : (
                  <button onClick={() => setShowCustomerModal(true)} className="btn-secondary text-sm">
                    <UserPlus size={16} /> Add Customer
                  </button>
                )}
              </div>
              <button onClick={() => setShowProductModal(true)} className="btn-primary text-sm">
                <Plus size={16} /> Add Products
              </button>
            </div>

            <div className="space-y-2">
              {(tabItems[selectedTab.id] ?? []).length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No items added yet. Tap "Add Products".</p>
              ) : (
                (tabItems[selectedTab.id] ?? []).map((item) => (
                  <div key={item.product.id} className="flex items-center gap-2 bg-slate-50 rounded-xl p-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{item.product.name}</p>
                      <p className="text-xs text-slate-500">{formatCurrency(item.product.selling_price)} each</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => updateTabItemQty(item.product.id, -1)} className="w-7 h-7 rounded-lg bg-white border flex items-center justify-center"><Minus size={14} /></button>
                      <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                      <button onClick={() => updateTabItemQty(item.product.id, 1)} className="w-7 h-7 rounded-lg bg-white border flex items-center justify-center"><Plus size={14} /></button>
                    </div>
                    <span className="text-sm font-semibold w-20 text-right">{formatCurrency(item.product.selling_price * item.quantity)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="flex justify-between mb-4">
                <span className="font-semibold text-slate-900">Total</span>
                <span className="text-2xl font-bold text-slate-900">{formatCurrency(selectedTab.total)}</span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => closeTab(selectedTab)} className="btn-ghost flex-1">Cancel Tab</button>
                <button onClick={() => payTab(selectedTab)} disabled={(tabItems[selectedTab.id] ?? []).length === 0} className="btn-primary flex-1">
                  <ShoppingCart size={18} /> Pay with M-Pesa
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Product picker modal */}
      <Modal open={showProductModal} onClose={() => setShowProductModal(false)} title="Add Products" size="lg">
        <div className="space-y-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Search products..." className="input pl-10" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-96 overflow-y-auto scrollbar-thin">
            {filteredProducts.map((product) => (
              <button key={product.id} onClick={() => addProductToTab(product)} className="card p-3 text-left hover:border-teal-300 hover:shadow-sm transition">
                <p className="text-sm font-medium text-slate-900 line-clamp-1">{product.name}</p>
                <p className="text-xs text-slate-500">{product.category?.name}</p>
                <p className="text-sm font-bold text-teal-700 mt-1">{formatCurrency(product.selling_price)}</p>
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* Customer modal */}
      <Modal open={showCustomerModal} onClose={() => setShowCustomerModal(false)} title="Add Customer to Tab" size="sm">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input type="text" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Search by name or phone..." className="input" onKeyDown={(e) => e.key === 'Enter' && searchCustomers()} />
            <button onClick={searchCustomers} className="btn-secondary">Search</button>
          </div>
          {customers.map((c) => (
            <button key={c.id} onClick={() => attachCustomer(c)} className="w-full text-left p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition">
              <p className="text-sm font-medium">{c.name}</p>
              <p className="text-xs text-slate-500">{c.phone}</p>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
