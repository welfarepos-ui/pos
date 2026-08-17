/*
# Seed Demo Data

## Overview
Populates the database with realistic demo data for development and testing.
All data is clearly labeled as demo/seed and can be removed before production.

## Data Inserted
1. Default store (Main Cafeteria)
2. Categories (Beverages, Food, Snacks, Bakery)
3. Products (10 items with realistic Kenyan cafeteria pricing)
4. Inventory (stock levels for each product)
5. Dining tables (8 tables)
6. Default settings (business name, M-Pesa config placeholder)
7. Sample customers (5 customers)
8. Sample supplier

## Important Notes
1. This is DEMO DATA — remove before production deployment.
2. M-Pesa settings are placeholders — real credentials must be configured via admin UI.
3. No sales/payments/shifts are seeded — those are created by the app at runtime.
*/

-- Default store
INSERT INTO stores (name, type, location, is_active)
VALUES ('Main Cafeteria', 'cafeteria', 'Kirinyaga County Hospital', true)
ON CONFLICT DO NOTHING;

-- Categories
INSERT INTO categories (name, description) VALUES
  ('Beverages', 'Tea, coffee, juice, sodas'),
  ('Food', 'Main meals and sides'),
  ('Snacks', 'Quick bites and pastries'),
  ('Bakery', 'Fresh baked items')
ON CONFLICT DO NOTHING;

-- Products (Kenyan cafeteria items)
INSERT INTO products (name, sku, barcode, category_id, buying_price, selling_price, unit, description, is_active, allow_negative_stock) VALUES
  ('Tea', 'BEV-001', '60010001', (SELECT id FROM categories WHERE name='Beverages'), 15, 30, 'cup', 'Hot masala tea', true, false),
  ('Coffee', 'BEV-002', '60010002', (SELECT id FROM categories WHERE name='Beverages'), 25, 50, 'cup', 'Freshly brewed coffee', true, false),
  ('Chapati', 'FOOD-001', '60010003', (SELECT id FROM categories WHERE name='Food'), 15, 40, 'each', 'Whole wheat chapati', true, false),
  ('Githeri', 'FOOD-002', '60010004', (SELECT id FROM categories WHERE name='Food'), 60, 120, 'plate', 'Maize and beans mix', true, false),
  ('Beef Stew', 'FOOD-003', '60010005', (SELECT id FROM categories WHERE name='Food'), 120, 250, 'plate', 'Beef stew with ugali', true, false),
  ('Pilau', 'FOOD-004', '60010006', (SELECT id FROM categories WHERE name='Food'), 100, 200, 'plate', 'Spiced rice with meat', true, false),
  ('Mandazi', 'SNK-001', '60010007', (SELECT id FROM categories WHERE name='Snacks'), 10, 25, 'each', 'Fried pastry snack', true, false),
  ('Samosa', 'SNK-002', '60010008', (SELECT id FROM categories WHERE name='Snacks'), 20, 40, 'each', 'Meat or veg samosa', true, false),
  ('Bread', 'BKR-001', '60010009', (SELECT id FROM categories WHERE name='Bakery'), 45, 80, 'loaf', 'Fresh white bread', true, false),
  ('Cake Slice', 'BKR-002', '60010010', (SELECT id FROM categories WHERE name='Bakery'), 40, 80, 'slice', 'Vanilla cake slice', true, false)
ON CONFLICT (sku) DO NOTHING;

-- Inventory for each product at main store
INSERT INTO inventory (product_id, store_id, quantity, minimum_stock)
SELECT p.id, s.id, 
  CASE p.name
    WHEN 'Tea' THEN 200
    WHEN 'Coffee' THEN 150
    WHEN 'Chapati' THEN 100
    WHEN 'Githeri' THEN 50
    WHEN 'Beef Stew' THEN 30
    WHEN 'Pilau' THEN 40
    WHEN 'Mandazi' THEN 80
    WHEN 'Samosa' THEN 60
    WHEN 'Bread' THEN 20
    WHEN 'Cake Slice' THEN 25
    ELSE 50
  END,
  10
FROM products p
CROSS JOIN stores s
WHERE s.name = 'Main Cafeteria'
AND NOT EXISTS (SELECT 1 FROM inventory i WHERE i.product_id = p.id AND i.store_id = s.id);

-- Dining tables
INSERT INTO tables (table_number, status, store_id)
SELECT t, 'available', s.id
FROM (VALUES ('01'), ('02'), ('03'), ('04'), ('05'), ('06'), ('07'), ('08')) AS v(t)
CROSS JOIN stores s
WHERE s.name = 'Main Cafeteria'
AND NOT EXISTS (SELECT 1 FROM tables WHERE table_number = t AND store_id = s.id);

-- Default settings
INSERT INTO settings (key, value, category) VALUES
  ('business_name', 'Kirinyaga Healthcare Workers Cafeteria', 'general'),
  ('business_address', 'Kirinyaga County Hospital', 'general'),
  ('business_phone', '0712345678', 'general'),
  ('mpesa_environment', 'sandbox', 'mpesa'),
  ('mpesa_consumer_key', '', 'mpesa'),
  ('mpesa_consumer_secret', '', 'mpesa'),
  ('mpesa_shortcode', '', 'mpesa'),
  ('mpesa_passkey', '', 'mpesa'),
  ('mpesa_paybill_number', '', 'mpesa'),
  ('mpesa_callback_url', '', 'mpesa'),
  ('mpesa_validation_url', '', 'mpesa'),
  ('mpesa_confirmation_url', '', 'mpesa'),
  ('mpesa_account_reference', 'CAFETERIA', 'mpesa'),
  ('currency_symbol', 'KSh', 'general')
ON CONFLICT (key) DO NOTHING;

-- Sample customers
INSERT INTO customers (name, phone, employee_number, customer_type) VALUES
  ('John Mwangi', '0712345678', 'EMP-001', 'staff'),
  ('Mary Wanjiru', '0722334455', 'EMP-002', 'staff'),
  ('Peter Kamau', '0733445566', 'EMP-003', 'staff'),
  ('Grace Njeri', '0744556677', 'EMP-004', 'staff'),
  ('Walk-in Customer', '0755667788', NULL, 'visitor')
ON CONFLICT DO NOTHING;

-- Sample supplier
INSERT INTO suppliers (name, contact_person, phone, email, address, outstanding_balance) VALUES
  ('Nairobi Wholesale Foods', 'James Kariuki', '0799887766', 'orders@nairobiwholesale.co.ke', 'Industrial Area, Nairobi', 0)
ON CONFLICT DO NOTHING;
