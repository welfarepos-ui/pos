export type Role =
  | 'super_admin'
  | 'admin'
  | 'cashier'
  | 'storekeeper'
  | 'accountant'
  | 'auditor';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  employee_id: string;
  phone: string | null;
  position: string | null;
  role: Role;
  salary: number | null;
  status: 'active' | 'inactive';
  date_joined: string;
  created_at: string;
}

export interface Store {
  id: string;
  name: string;
  type: 'main_store' | 'cafeteria' | 'kitchen' | 'branch';
  location: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category_id: string | null;
  buying_price: number;
  selling_price: number;
  unit: string;
  image_url: string | null;
  description: string | null;
  is_active: boolean;
  allow_negative_stock: boolean;
  created_at: string;
  category?: Category;
}

export interface Inventory {
  id: string;
  product_id: string;
  store_id: string;
  quantity: number;
  minimum_stock: number;
  product?: Product;
  store?: Store;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  store_id: string;
  movement_type:
    | 'purchase'
    | 'sale'
    | 'adjustment'
    | 'damage'
    | 'expiry'
    | 'transfer'
    | 'return';
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reason: string | null;
  user_id: string;
  created_at: string;
  product?: Product;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  employee_number: string | null;
  customer_type: 'staff' | 'visitor' | 'student';
  created_at: string;
}

export interface TableEntity {
  id: string;
  table_number: string;
  status: 'available' | 'occupied' | 'payment_pending' | 'paid' | 'closed';
  store_id: string;
  created_at: string;
}

export interface Tab {
  id: string;
  table_id: string | null;
  customer_id: string | null;
  cashier_id: string;
  shift_id: string;
  status: 'open' | 'payment_pending' | 'paid' | 'closed';
  total: number;
  created_at: string;
  updated_at: string;
  table?: TableEntity;
  customer?: Customer;
}

export interface TabItem {
  id: string;
  tab_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  product?: Product;
}

export interface Shift {
  id: string;
  cashier_id: string;
  shift_number: number;
  opening_time: string;
  closing_time: string | null;
  status: 'open' | 'closed';
  opening_cash: number;
  device_info: string | null;
  cashier?: Profile;
}

export interface Sale {
  id: string;
  receipt_number: string;
  shift_id: string;
  cashier_id: string;
  customer_id: string | null;
  table_id: string | null;
  tab_id: string | null;
  subtotal: number;
  total: number;
  status: 'pending' | 'paid' | 'void' | 'refunded';
  payment_status: 'pending' | 'success' | 'failed' | 'cancelled' | 'timeout';
  mpesa_reference: string | null;
  created_at: string;
  updated_at: string;
  cashier?: Profile;
  customer?: Customer;
  table?: TableEntity;
  shift?: Shift;
  sale_items?: SaleItem[];
  payment?: Payment;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  product?: Product;
}

export interface Payment {
  id: string;
  sale_id: string;
  amount: number;
  method: 'mpesa_stk' | 'mpesa_paybill';
  status: 'initiated' | 'pending' | 'success' | 'failed' | 'cancelled' | 'timeout' | 'refunded';
  phone: string | null;
  mpesa_receipt_number: string | null;
  checkout_request_id: string | null;
  merchant_request_id: string | null;
  account_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface MpesaTransaction {
  id: string;
  payment_id: string | null;
  sale_id: string | null;
  transaction_type: 'stk_push' | 'paybill';
  amount: number;
  phone: string | null;
  mpesa_receipt_number: string | null;
  checkout_request_id: string | null;
  merchant_request_id: string | null;
  result_code: number | null;
  result_desc: string | null;
  status: 'initiated' | 'pending' | 'success' | 'failed' | 'cancelled' | 'timeout';
  reconciliation_status: 'matched' | 'unmatched' | 'pending' | 'failed' | 'review';
  callback_payload: unknown;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  outstanding_balance: number;
  created_at: string;
}

export interface Purchase {
  id: string;
  supplier_id: string;
  invoice_number: string;
  purchase_date: string;
  total: number;
  payment_status: 'paid' | 'partial' | 'unpaid';
  amount_paid: number;
  balance: number;
  received_by: string;
  notes: string | null;
  created_at: string;
  supplier?: Supplier;
  purchase_items?: PurchaseItem[];
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  buying_price: number;
  subtotal: number;
  product?: Product;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  recorded_by: string;
  attachment_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface Payroll {
  id: string;
  employee_id: string;
  basic_salary: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  pay_period: string;
  payment_status: 'paid' | 'pending';
  created_at: string;
  employee?: Profile;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  previous_value: unknown;
  new_value: unknown;
  metadata: unknown;
  created_at: string;
  user?: Profile;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  category: string;
  updated_at: string;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  user_id: string | null;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
