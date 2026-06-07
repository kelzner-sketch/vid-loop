import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@14';

const PRICE_ID = 'price_1Tfg4OAGYhybVsu2KJOPLH7F';

Deno.serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const base44 = createClientFromRequest(req);

    let userId = null;
    let userEmail = null;
    try {
      const user = await base44.auth.me();
      userId = user?.id;
      userEmail = user?.email;
    } catch {}

    const { returnUrl } = await req.json();
    const origin = returnUrl || req.headers.get('origin') || 'https://app.base44.com';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      success_url: `${origin}?pro=success`,
      cancel_url: `${origin}?pro=cancel`,
      customer_email: userEmail || undefined,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        user_id: userId || '',
      },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});