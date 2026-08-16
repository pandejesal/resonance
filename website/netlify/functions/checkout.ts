import { getStore } from '@netlify/blobs';

const SHOP_TOTAL = 50;

const TIERS: Record<string, { productEnv: string; prefix: string }> = {
  pro: { productEnv: 'DODO_PRODUCT_PRO', prefix: 'RES-PRO' },
  lifetime: { productEnv: 'DODO_PRODUCT_LIFETIME', prefix: 'RES-LIF' },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
  });

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
    });
  }
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  if (process.env.SHOP_ENABLED !== 'true') {
    return json({ error: 'not_open', message: 'The shop opens at launch.' }, 403);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const tier = body?.tier;
  const name = String(body?.name || '').trim();
  const email = String(body?.email || '').trim().toLowerCase();

  if (!TIERS[tier]) return json({ error: 'invalid_tier' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'invalid_email' }, 400);
  if (!name || name.length > 80) return json({ error: 'invalid_name' }, 400);
  const founderPublic = body?.founder_public === true;

  const store = getStore('KEY_SHOP');
  const counter = (await store.get('counter', { type: 'json' })) as { sold?: number } | null;
  const sold = typeof counter?.sold === 'number' ? counter.sold : 0;
  const founderEligible = sold < SHOP_TOTAL;

  const apiKey = process.env.DODO_API_KEY;
  const productId = process.env[TIERS[tier].productEnv];
  if (!apiKey || !productId) return json({ error: 'not_configured' }, 500);

  const siteUrl = process.env.SITE_URL || 'https://resonance.app';

  const payment = await fetch('https://api.dodopayments.com/payments', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      billing: { city: '', country: 'IN', state: '', street: '', zipcode: '' },
      customer: { email, name },
      product_cart: [{ product_id: productId, quantity: 1 }],
      return_url: `${siteUrl}/pricing?success=1&tier=${tier}`,
      metadata: {
        tier,
        name,
        email,
        founder: founderEligible ? '1' : '0',
        founder_public: founderPublic ? '1' : '0',
      },
    }),
  });

  const data = await payment.json().catch(() => null);
  if (!payment.ok) {
    return json({ error: 'dodo_error', message: 'Payment provider rejected the request. Try again.' }, 502);
  }

  return json({
    url: data?.payment_link,
    founder_eligible: founderEligible,
    spots_left: Math.max(0, SHOP_TOTAL - sold),
    total: SHOP_TOTAL,
  });
};