import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface STKPushRequest {
  phone_number: string;
  amount: number;
  account_reference: string;
  transaction_desc: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_number, amount, account_reference, transaction_desc }: STKPushRequest = await req.json();

    console.log('STK Push request:', { phone_number, amount, account_reference, transaction_desc });

    // Get M-Pesa credentials from environment variables
    const consumerKey = Deno.env.get('MPESA_CONSUMER_KEY');
    const consumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET');
    const shortcode = Deno.env.get('MPESA_SHORTCODE');
    const passkey = Deno.env.get('MPESA_PASSKEY');
    const callbackUrl = Deno.env.get('MPESA_CALLBACK_URL');

    if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackUrl) {
      throw new Error('Missing M-Pesa configuration');
    }

    // Get access token
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const tokenResponse = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      throw new Error('Failed to get M-Pesa access token');
    }

    // Generate timestamp and password
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    // Format phone number (remove leading 0 and add 254)
    let formattedPhone = phone_number.replace(/^0/, '254');
    if (!formattedPhone.startsWith('254')) {
      formattedPhone = '254' + formattedPhone;
    }

    // STK Push request
    const stkPushData = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: account_reference,
      TransactionDesc: transaction_desc,
    };

    console.log('Sending STK Push:', stkPushData);

    const stkResponse = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stkPushData),
    });

    const stkData = await stkResponse.json();
    console.log('STK Push response:', stkData);

    return new Response(
      JSON.stringify({
        success: true,
        data: stkData,
        message: 'STK Push initiated successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('STK Push error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Failed to initiate STK Push'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});