import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try {
      user = await base44.auth.me();
    } catch {}

    if (!user) {
      return Response.json({ is_pro: false });
    }

    return Response.json({ is_pro: !!user.is_pro, pro_status: user.pro_status || null });
  } catch (error) {
    console.error('getProStatus error:', error.message);
    return Response.json({ is_pro: false });
  }
});