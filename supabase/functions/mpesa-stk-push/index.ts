import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface STKRequest {
  paymentId: string;
  saleId: string;
  phone: string;
  amount: number;
  receiptNumber: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { paymentId, saleId, phone, amount, receiptNumber } = await req.json() as STKRequest;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Load M-Pesa config from settings
    const { data: settingsRows } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', [
        'mpesa_environment', 'mpesa_consumer_key', 'mpesa_consumer_secret',
        'mpesa_shortcode', 'mpesa_passkey', 'mpesa_callback_url', 'mpesa_account_reference',
      ]);

    const settings: Record<string, string> = {};
    (settingsRows ?? []).forEach((r: { key: string; value: string }) => { settings[r.key] = r.value; });

    const consumerKey = settings['mpesa_consumer_key'];
    const consumerSecret = settings['mpesa_consumer_secret'];
    const shortcode = settings['mpesa_shortcode'];
    const passkey = settings['mpesa_passkey'];
    const callbackUrl = settings['mpesa_callback_url'];
    const accountRef = settings['mpesa_account_reference'] || 'CAFETERIA';

    // If not configured, simulate for demo
    if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackUrl) {
      // Demo mode: simulate a successful payment after a short delay
      const demoReceipt = `DEMO${Math.floor(Math.random() * 900000 + 100000)}`;

      // Update payment to success
      await supabase.from('payments').update({
        status: 'success',
        mpesa_receipt_number: demoReceipt,
        checkout_request_id: `ws_demo_${paymentId}`,
        merchant_request_id: `demo_${paymentId}`,
      }).eq('id', paymentId);

      // Update mpesa transaction
      await supabase.from('mpesa_transactions').update({
        status: 'success',
        result_code: 0,
        result_desc: 'Demo success',
        mpesa_receipt_number: demoReceipt,
        reconciliation_status: 'matched',
      }).eq('payment_id', paymentId);

      // Update sale
      await supabase.from('sales').update({
        status: 'paid',
        payment_status: 'success',
        mpesa_reference: demoReceipt,
      }).eq('id', saleId);

      return new Response(JSON.stringify({
        success: true,
        simulated: true,
        receiptNumber: demoReceipt,
        message: 'M-Pesa not configured. Payment simulated for demo purposes.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Production: get OAuth token from Daraja
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const baseUrl = settings['mpesa_environment'] === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';

    const tokenRes = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { 'Authorization': `Basic ${auth}` },
    });

    if (!tokenRes.ok) {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', paymentId);
      return new Response(JSON.stringify({ error: 'Failed to authenticate with M-Pesa' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Generate password
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    // Send STK Push
    const stkRes = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: `${callbackUrl}?paymentId=${paymentId}&saleId=${saleId}`,
        AccountReference: accountRef,
        TransactionDesc: `Payment for ${receiptNumber}`,
      }),
    });

    const stkData = await stkRes.json();

    if (!stkRes.ok || stkData.ResponseCode !== '0') {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', paymentId);
      await supabase.from('mpesa_transactions').update({
        status: 'failed',
        result_desc: stkData.errorMessage || stkData.ResponseDescription,
      }).eq('payment_id', paymentId);

      return new Response(JSON.stringify({ error: stkData.errorMessage || 'STK Push failed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update payment with checkout request ID
    await supabase.from('payments').update({
      status: 'pending',
      checkout_request_id: stkData.CheckoutRequestID,
      merchant_request_id: stkData.MerchantRequestID,
    }).eq('id', paymentId);

    await supabase.from('mpesa_transactions').update({
      status: 'pending',
      checkout_request_id: stkData.CheckoutRequestID,
      merchant_request_id: stkData.MerchantRequestID,
    }).eq('payment_id', paymentId);

    return new Response(JSON.stringify({
      success: true,
      simulated: false,
      checkoutRequestId: stkData.CheckoutRequestID,
      message: 'STK Push sent successfully',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
