import { getStore } from '@netlify/blobs';

const SHOP_TOTAL = 50;

export default async (): Promise<Response> => {
  const store = getStore('KEY_SHOP');
  const counter = (await store.get('counter', { type: 'json' })) as { sold?: number } | null;
  const sold = typeof counter?.sold === 'number' ? counter.sold : 0;

  return new Response(
    JSON.stringify({
      open: process.env.SHOP_ENABLED === 'true',
      total: SHOP_TOTAL,
      sold,
      spots_left: Math.max(0, SHOP_TOTAL - sold),
    }),
    {
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    },
  );
};