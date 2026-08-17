import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const paymentId = url.searchParams.get('paymentId');
    const saleId = url.searchParams.get('saleId');

    const body = await req.json();
    const callback = body?.Body?.stkCallback;

    if (!callback) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid callback format' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const resultCode = callback.ResultCode;
    const resultDesc = callback.ResultDesc;
    const checkoutRequestId = callback.CheckoutRequestID;
    const merchantRequestId = callback.MerchantRequestID;

    const isSuccess = resultCode === 0;

    // Extract M-Pesa receipt number from callback metadata
    let mpesaReceiptNumber: string | null = null;
    let phone: string | null = null;
    let amount: number | null = null;

    if (isSuccess && callback.CallbackMetadata?.Item) {
      for (const item of callback.CallbackMetadata.Item) {
        if (item.Name === 'MpesaReceiptNumber') mpesaReceiptNumber = item.Value;
        if (item.Name === 'PhoneNumber') phone = String(item.Value);
        if (item.Name === 'Amount') amount = Number(item.Value);
      }
    }

    if (isSuccess) {
      // Idempotency: check if payment is already success
      const { data: existing } = await supabase.from('payments').select('status').eq('id', paymentId).maybeSingle();
      if (existing?.status === 'success') {
        return new Response(JSON.stringify({ success: true, message: 'Already processed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update payment
      await supabase.from('payments').update({
        status: 'success',
        mpesa_receipt_number: mpesaReceiptNumber,
        checkout_request_id: checkoutRequestId,
        merchant_request_id: merchantRequestId,
      }).eq('id', paymentId);

      // Update mpesa transaction
      await supabase.from('mpesa_transactions').update({
        status: 'success',
        result_code: resultCode,
        result_desc: resultDesc,
        mpesa_receipt_number: mpesaReceiptNumber,
        reconciliation_status: 'matched',
        callback_payload: body,
      }).eq('payment_id', paymentId);

      // Update sale
      await supabase.from('sales').update({
        status: 'paid',
        payment_status: 'success',
        mpesa_reference: mpesaReceiptNumber,
      }).eq('id', saleId);

      // Reduce inventory
      const { data: saleItems } = await supabase.from('sale_items').select('product_id, quantity').eq('sale_id', saleId);
      if (saleItems) {
        for (const item of saleItems) {
          const { data: inv } = await supabase.from('inventory')
            .select('id, quantity, store_id').eq('product_id', item.product_id).maybeSingle();
          if (inv) {
            const newQty = Math.max(0, inv.quantity - item.quantity);
            await supabase.from('inventory').update({ quantity: newQty }).eq('id', inv.id);
            await supabase.from('inventory_movements').insert({
              product_id: item.product_id,
              store_id: inv.store_id,
              movement_type: 'sale',
              quantity: -item.quantity,
              previous_quantity: inv.quantity,
              new_quantity: newQty,
              reason: `Sale ${saleId.slice(0, 8)}`,
              user_id: null,
            });
          }
        }
      }
    } else {
      // Payment failed/cancelled
      await supabase.from('payments').update({ status: 'failed' }).eq('id', paymentId);
      await supabase.from('mpesa_transactions').update({
        status: 'failed',
        result_code: resultCode,
        result_desc: resultDesc,
        callback_payload: body,
      }).eq('payment_id', paymentId);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
