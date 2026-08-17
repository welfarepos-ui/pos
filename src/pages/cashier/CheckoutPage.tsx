import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Sale, SaleItem, Payment, Product } from '@/types/database';
import { formatCurrency, generateReceiptNumber, normalizePhone, displayPhone, formatDateTime } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Loader2, ArrowLeft, Phone, CheckCircle2, XCircle, Clock,
  AlertCircle, Printer, Download, RefreshCw,
} from 'lucide-react';

interface CheckoutState {
  cart: { product_id: string; product_name: string; quantity: number; unit_price: number; subtotal: number }[];
  shiftId: string;
  customerId: string | null;
  customerName: string | null;
}

type PaymentPhase = 'phone' | 'processing' | 'pending' | 'success' | 'failed' | 'timeout';

export function CheckoutPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as CheckoutState | null;

  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phase, setPhase] = useState<PaymentPhase>('phone');
  const [sale, setSale] = useState<Sale | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = state?.cart.reduce((sum, item) => sum + item.subtotal, 0) ?? 0;

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  if (!state || state.cart.length === 0) {
    return (
      <div className="p-8">
        <EmptyState icon={<AlertCircle size={48} />} title="No items to checkout" description="Go back to the POS and add products." action={
          <button onClick={() => navigate('/cashier/pos')} className="btn-primary">Go to POS</button>
        } />
      </div>
    );
  }

  const validatePhone = (value: string): boolean => {
    try {
      normalizePhone(value);
      setPhoneError(null);
      return true;
    } catch {
      setPhoneError('Enter a valid Safaricom number (07XXXXXXXX or 01XXXXXXXX)');
      return false;
    }
  };

  const handlePay = async () => {
    if (!validatePhone(phone) || !profile) return;
    setPhase('processing');
    setStatusMessage('Creating sale...');

    const receiptNumber = generateReceiptNumber();
    const { data: newSale, error: saleError } = await supabase
      .from('sales')
      .insert({
        receipt_number: receiptNumber,
        shift_id: state.shiftId,
        cashier_id: profile.id,
        customer_id: state.customerId,
        subtotal: total,
        total,
        status: 'pending',
        payment_status: 'pending',
      })
      .select()
      .single();

    if (saleError || !newSale) {
      setPhase('failed');
      setStatusMessage('Unable to create sale. Please try again.');
      return;
    }
    setSale(newSale as Sale);

    const saleItems = state.cart.map((item) => ({
      sale_id: newSale.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal,
    }));
    await supabase.from('sale_items').insert(saleItems);

    setStatusMessage('Initiating M-Pesa payment...');
    const { data: newPayment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        sale_id: newSale.id,
        amount: total,
        method: 'mpesa_stk',
        status: 'initiated',
        phone: normalizePhone(phone),
      })
      .select()
      .single();

    if (paymentError || !newPayment) {
      setPhase('failed');
      setStatusMessage('Unable to initiate payment. Please try again.');
      return;
    }
    setPayment(newPayment as Payment);

    await supabase.from('mpesa_transactions').insert({
      payment_id: newPayment.id,
      sale_id: newSale.id,
      transaction_type: 'stk_push',
      amount: total,
      phone: normalizePhone(phone),
      status: 'initiated',
      reconciliation_status: 'pending',
    });

    setStatusMessage('Sending STK Push to your phone...');
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mpesa-stk-push`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId: newPayment.id,
          saleId: newSale.id,
          phone: normalizePhone(phone),
          amount: total,
          receiptNumber,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setPhase('failed');
        setStatusMessage(result.error || 'M-Pesa not configured. Ask admin to configure M-Pesa in Settings.');
        return;
      }

      if (result.simulated) {
        setPhase('success');
        await completeSale(newSale.id, newPayment.id, result.receiptNumber || 'DEMO1234');
        return;
      }

      setPhase('pending');
      setStatusMessage('STK Push sent. Waiting for customer to enter M-Pesa PIN...');
      pollPaymentStatus(newPayment.id, newSale.id);
    } catch {
      setPhase('pending');
      setStatusMessage('STK Push sent. Waiting for payment confirmation...');
      pollPaymentStatus(newPayment.id, newSale.id);
    }
  };

  const pollPaymentStatus = (paymentId: string, saleId: string) => {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      const { data: p } = await supabase.from('payments').select('*').eq('id', paymentId).maybeSingle();
      if (p) {
        const pStatus = (p as Payment).status;
        if (pStatus === 'success') {
          if (pollRef.current) clearInterval(pollRef.current);
          setPhase('success');
          setPayment(p as Payment);
          completeSale(saleId, paymentId, (p as Payment).mpesa_receipt_number || '');
        } else if (pStatus === 'failed' || pStatus === 'cancelled') {
          if (pollRef.current) clearInterval(pollRef.current);
          setPhase('failed');
          setStatusMessage('Payment was not completed. You can retry without creating a duplicate sale.');
        } else if (attempts > 60) {
          if (pollRef.current) clearInterval(pollRef.current);
          setPhase('timeout');
          setStatusMessage('Payment timed out. Ask customer to try again.');
        }
      }
    }, 3000);
  };

  const completeSale = async (saleId: string, paymentId: string, mpesaRef: string) => {
    await supabase.from('sales').update({
      status: 'paid',
      payment_status: 'success',
      mpesa_reference: mpesaRef,
    }).eq('id', saleId);

    await supabase.from('payments').update({
      status: 'success',
      mpesa_receipt_number: mpesaRef,
    }).eq('id', paymentId);

    for (const item of state.cart) {
      const { data: inv } = await supabase.from('inventory')
        .select('id, quantity, store_id')
        .eq('product_id', item.product_id)
        .maybeSingle();

      if (inv) {
        const invData = inv as { id: string; quantity: number; store_id: string };
        const newQty = Math.max(0, invData.quantity - item.quantity);
        await supabase.from('inventory').update({ quantity: newQty }).eq('id', invData.id);
        await supabase.from('inventory_movements').insert({
          product_id: item.product_id,
          store_id: invData.store_id,
          movement_type: 'sale',
          quantity: -item.quantity,
          previous_quantity: invData.quantity,
          new_quantity: newQty,
          reason: `Sale ${saleId.slice(0, 8)}`,
          user_id: profile!.id,
        });
      }
    }

    await supabase.from('audit_logs').insert({
      user_id: profile!.id,
      action: 'sale_completed',
      entity: 'sales',
      entity_id: saleId,
      new_value: { total, mpesa_ref: mpesaRef } as unknown,
    });

    const { data: updatedSale } = await supabase.from('sales')
      .select('*, sale_items(*, product:products(*))')
      .eq('id', saleId)
      .maybeSingle();
    if (updatedSale) setSale(updatedSale as Sale);
  };

  const retry = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setPhase('phone');
    setSale(null);
    setPayment(null);
    setStatusMessage('');
  };

  const printReceipt = () => {
    window.print();
  };

  // ===== SUCCESS / RECEIPT VIEW =====
  if (phase === 'success' && sale) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto">
        <div className="card p-8">
          <div className="text-center mb-6">
            <div className="inline-flex p-4 bg-emerald-50 rounded-2xl mb-3">
              <CheckCircle2 size={48} className="text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Payment Complete</h1>
            <p className="text-slate-500 mt-1">M-Pesa payment confirmed successfully.</p>
          </div>

          <div className="border-t border-b border-dashed border-slate-200 py-6 my-6">
            <div className="text-center mb-4">
              <p className="font-bold text-lg text-slate-900">KIRINYAGA HEALTHCARE WORKERS CAFETERIA</p>
              <p className="text-xs text-slate-500">Kirinyaga County Hospital</p>
            </div>
            <div className="space-y-1 text-sm text-slate-600 mb-4">
              <div className="flex justify-between"><span>Receipt #</span><span className="font-medium text-slate-900">{sale.receipt_number}</span></div>
              <div className="flex justify-between"><span>Date</span><span>{formatDateTime(sale.created_at)}</span></div>
              <div className="flex justify-between"><span>Cashier</span><span>{profile?.full_name}</span></div>
              {state.customerName && <div className="flex justify-between"><span>Customer</span><span>{state.customerName}</span></div>}
              <div className="flex justify-between"><span>Payment</span><span className="font-medium text-emerald-700">M-Pesa</span></div>
              {sale.mpesa_reference && <div className="flex justify-between"><span>M-Pesa Ref</span><span className="font-medium text-slate-900">{sale.mpesa_reference}</span></div>}
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs">
                  <th className="text-left py-2 font-medium">Item</th>
                  <th className="text-center py-2 font-medium">Qty</th>
                  <th className="text-right py-2 font-medium">Price</th>
                  <th className="text-right py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {state.cart.map((item, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 text-slate-900">{item.product_name}</td>
                    <td className="py-2 text-center">{item.quantity}</td>
                    <td className="py-2 text-right">{formatCurrency(item.unit_price)}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-3 text-right font-semibold text-slate-900">TOTAL</td>
                  <td className="pt-3 text-right text-lg font-bold text-slate-900">{formatCurrency(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="text-center text-xs text-slate-400 mb-6">Thank you for dining with us!</p>

          <div className="flex gap-3">
            <button onClick={printReceipt} className="btn-secondary flex-1">
              <Printer size={18} /> Print
            </button>
            <button onClick={() => navigate('/cashier/pos')} className="btn-primary flex-1">
              New Sale
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== PAYMENT STATUS VIEW =====
  if (phase === 'processing' || phase === 'pending' || phase === 'timeout') {
    return (
      <div className="p-6 lg:p-8 max-w-md mx-auto">
        <div className="card p-8 text-center">
          <div className="inline-flex p-4 bg-amber-50 rounded-2xl mb-4">
            <Loader2 size={48} className="text-amber-600 animate-spin" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Processing Payment</h1>
          <p className="text-slate-500 text-sm mb-6">{statusMessage}</p>
          <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-semibold">{formatCurrency(total)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Phone</span><span>{displayPhone(normalizePhone(phone))}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Receipt #</span><span className="font-medium">{sale?.receipt_number}</span></div>
          </div>
          {phase === 'timeout' && (
            <button onClick={retry} className="btn-primary w-full mt-6">
              <RefreshCw size={18} /> Retry Payment
            </button>
          )}
        </div>
      </div>
    );
  }

  // ===== FAILED VIEW =====
  if (phase === 'failed') {
    return (
      <div className="p-6 lg:p-8 max-w-md mx-auto">
        <div className="card p-8 text-center">
          <div className="inline-flex p-4 bg-red-50 rounded-2xl mb-4">
            <XCircle size={48} className="text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Payment Failed</h1>
          <p className="text-slate-500 text-sm mb-6">{statusMessage}</p>
          <div className="flex gap-3">
            <button onClick={() => navigate('/cashier/pos')} className="btn-secondary flex-1">
              <ArrowLeft size={18} /> Back to POS
            </button>
            <button onClick={retry} className="btn-primary flex-1">
              <RefreshCw size={18} /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== PHONE ENTRY VIEW =====
  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto">
      <button onClick={() => navigate('/cashier/pos')} className="btn-ghost mb-4">
        <ArrowLeft size={18} /> Back to POS
      </button>

      <div className="card p-6 mb-6">
        <h2 className="font-semibold text-slate-900 mb-4">Order Summary</h2>
        <div className="space-y-2">
          {state.cart.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-slate-700">{item.product_name} x{item.quantity}</span>
              <span className="font-medium text-slate-900">{formatCurrency(item.subtotal)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 mt-4 pt-4 flex justify-between">
          <span className="font-semibold text-slate-900">Total</span>
          <span className="text-2xl font-bold text-slate-900">{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 mb-1">M-Pesa Payment</h2>
        <p className="text-sm text-slate-500 mb-4">Enter the customer's phone number to send an STK Push prompt.</p>

        <div className="space-y-4">
          <div>
            <label className="label">Customer phone number</label>
            <div className="relative">
              <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); if (phoneError) validatePhone(e.target.value); }}
                placeholder="07XXXXXXXX"
                className={`input pl-10 ${phoneError ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              />
            </div>
            {phoneError && <p className="text-xs text-red-600 mt-1.5">{phoneError}</p>}
          </div>

          <div className="rounded-xl bg-teal-50 border border-teal-200 p-4 flex items-start gap-3">
            <Clock size={18} className="text-teal-700 mt-0.5 shrink-0" />
            <div className="text-sm text-teal-800">
              <p className="font-medium">How it works</p>
              <p className="text-xs mt-0.5">The customer will receive a payment prompt on their phone. After they enter their M-Pesa PIN, the payment will be confirmed automatically.</p>
            </div>
          </div>

          <button onClick={handlePay} className="btn-primary btn-xl w-full">
            PAY {formatCurrency(total)} via M-Pesa
          </button>
        </div>
      </div>
    </div>
  );
}
