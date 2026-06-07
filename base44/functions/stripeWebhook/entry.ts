import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@14';

Deno.serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const base44 = createClientFromRequest(req);

    const body = await req.text();
    const sig = req.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response('Webhook Error', { status: 400 });
    }

    const session = event.data.object;
    const userId = session.metadata?.user_id;

    if (event.type === 'checkout.session.completed' && session.payment_status === 'paid') {
      if (userId) {
        await base44.asServiceRole.entities.User.update(userId, {
          is_pro: true,
          stripe_customer_id: session.customer,
          pro_status: 'active',
        });
        console.log('Pro activated for user:', userId);
      } else {
        console.log('No user_id in metadata; customer:', session.customer, 'email:', session.customer_details?.email);
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});