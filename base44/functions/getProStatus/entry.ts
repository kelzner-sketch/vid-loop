import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@14';

Deno.serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const base44 = createClientFromRequest(req);

    let user = null;
    try { user = await base44.auth.me(); } catch {}

    // If user has is_pro flag set, trust it
    if (user?.is_pro) {
      return Response.json({ is_pro: true, pro_status: user.pro_status || 'active' });
    }

    // If user has a stripe_customer_id, verify with Stripe directly
    if (user?.stripe_customer_id) {
      const sessions = await stripe.checkout.sessions.list({
        customer: user.stripe_customer_id,
        limit: 10,
      });
      const paid = sessions.data.some(s => s.payment_status === 'paid');
      if (paid) {
        // Backfill the flag in case the webhook missed it
        await base44.asServiceRole.entities.User.update(user.id, { is_pro: true, pro_status: 'active' });
        return Response.json({ is_pro: true, pro_status: 'active' });
      }
    }

    // If user has an email, check Stripe for any paid session with that email
    if (user?.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 5 });
      for (const customer of customers.data) {
        const sessions = await stripe.checkout.sessions.list({ customer: customer.id, limit: 10 });
        const paid = sessions.data.some(s => s.payment_status === 'paid');
        if (paid) {
          // Backfill
          await base44.asServiceRole.entities.User.update(user.id, {
            is_pro: true,
            stripe_customer_id: customer.id,
            pro_status: 'active',
          });
          return Response.json({ is_pro: true, pro_status: 'active' });
        }
      }
    }

    return Response.json({ is_pro: false });
  } catch (error) {
    console.error('getProStatus error:', error.message);
    return Response.json({ is_pro: false });
  }
});