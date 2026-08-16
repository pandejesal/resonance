import { getStore } from '@netlify/blobs';
import { createHmac, randomBytes } from 'node:crypto';

const SHOP_TOTAL = 50;

const TIERS: Record<string, string> = { pro: 'RES-PRO', lifetime: 'RES-LIF', enterprise: 'RES-ENT' };

const ack = (status = 200) => new Response(status === 200 ? 'OK' : 'ERROR', { status });

export default async (req: Request): Promise<Response> => {
  const secret = process.env.DODO_WEBHOOK_SECRET;
  if (!secret) return ack(500);

  const raw = await req.text();
  const signature = req.headers.get('dodo-signature') || '';
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  if (signature !== expected) return ack(400);

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return ack(400);
  }
  if (event?.type !== 'payment.succeeded') return ack(200);

  const payment = event?.data;
  const metadata = payment?.metadata || {};
  const tier = String(metadata.tier || '');
  const email = String(metadata.email || '').trim().toLowerCase();
  const name = String(metadata.name || '').trim();
  const founder = metadata.founder === '1';
  const founderPublic = metadata.founder_public === '1';
  const paymentId = String(payment?.payment_id || '');

  if (!TIERS[tier] || !email || !paymentId) return ack(400);

  const store = getStore('KEY_SHOP');

  const existing = await store.get(paymentId, { type: 'json' });
  if (existing) return ack(200);

  const key = `${TIERS[tier]}-${randomBytes(8).toString('hex').toUpperCase()}`;

  const counter = (await store.get('counter', { type: 'json' })) as { sold?: number } | null;
  const soldBefore = typeof counter?.sold === 'number' ? counter.sold : 0;
  const isFounder = founder && soldBefore < SHOP_TOTAL;

  await store.setJSON('counter', { sold: soldBefore + 1 });
  await store.setJSON(paymentId, {
    key,
    email,
    name,
    tier,
    founder: isFounder,
    founderPublic,
    at: new Date().toISOString(),
  });

  if (isFounder && founderPublic) {
    const founders = (await store.get('founders', { type: 'json' })) as { list?: unknown[] } | null;
    const list = Array.isArray(founders?.list) ? founders.list : [];
    await store.setJSON('founders', { list: [...list, { name, tier, at: new Date().toISOString() }] });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const from = process.env.EMAIL_FROM || 'Resonance <keys@resonance.app>';
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Your Resonance license key',
        html: emailHtml({ name, key, tier, isFounder }),
      }),
    }).catch(() => null);
  }

  return ack(200);
};

function emailHtml({ name, key, tier, isFounder }: { name: string; key: string; tier: string; isFounder: boolean }): string {
  const tierLabel = tier === 'lifetime' ? 'Lifetime' : 'Pro';
  return `
<div style="font-family: Inter, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #e8f5ec; background: #07110a; border-radius: 12px;">
  <h1 style="margin: 0 0 16px; font-size: 20px;">Hi ${escapeHtml(name)},</h1>
  <p style="font-size: 15px; line-height: 1.6; color: #b9cbbd;">Thanks for buying Resonance ${tierLabel}. Here is your license key:</p>
  <p style="padding: 14px 18px; background: #0d1f14; border: 1px solid #1db954; border-radius: 8px; font-family: monospace; font-size: 16px; letter-spacing: 1px; color: #1db954; word-break: break-all;">${key}</p>
  <h2 style="margin: 24px 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; color: #7fd19a;">How to activate</h2>
  <ol style="font-size: 14px; line-height: 1.7; color: #b9cbbd; margin: 0; padding-left: 20px;">
    <li>Download the app for your platform at resonance.app/download</li>
    <li>Start your server and open the app</li>
    <li>Go to Settings → Upgrade → <strong>Activate License</strong> and paste the key</li>
  </ol>
  <p style="font-size: 14px; line-height: 1.6; color: #b9cbbd; margin-top: 20px;">
    The key unlocks ${tierLabel} features on up to 3 of your devices.${tier === 'lifetime' ? ' It never expires.' : ' It renews in a year.'}
  </p>
  ${isFounder ? '<p style="font-size: 14px; line-height: 1.6; color: #7fd19a;">You are one of the founding 50 — thank you. If you opted in, your name appears in our changelog. For priority support, just reply to this email.</p>' : ''}
  <p style="font-size: 12px; color: #6d8a72; margin-top: 24px;">If you didn\'t buy this, no problem — forward this email to hello@resonance.app and we\'ll sort it out.</p>
</div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}