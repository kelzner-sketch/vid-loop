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

    if (event.type === 'checkout.session.completed') {
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      if (userId) {
        await base44.asServiceRole.entities.User.update(userId, {
          is_pro: true,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          pro_status: 'active',
        });
      }
      console.log('Pro activated for user:', userId);
    }

    if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
      const sub = event.data.object;
      const isActive = sub.status === 'active' || sub.status === 'trialing';
      // Find user by stripe customer id
      const users = await base44.asServiceRole.entities.User.filter({ stripe_customer_id: sub.customer });
      if (users.length > 0) {
        await base44.asServiceRole.entities.User.update(users[0].id, {
          is_pro: isActive,
          pro_status: sub.status,
        });
        console.log('Pro status updated:', sub.status, 'for user:', users[0].id);
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});