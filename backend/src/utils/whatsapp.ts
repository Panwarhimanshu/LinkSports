/**
 * WhatsApp delivery through our self-hosted OpenWA gateway (https://openwa.voldebug.com).
 *
 * Env (root .env):
 *   OPENWA_URL         gateway base URL, e.g. https://openwa.voldebug.com (or http://127.0.0.1:2785 on the same VPS)
 *   OPENWA_API_KEY     API key sent as X-API-Key (prefer a key scoped to one session, not the master key)
 *   OPENWA_SESSION_ID  id of the connected WhatsApp session that sends the codes
 */

const TIMEOUT_MS = 8000;

export const isWhatsAppConfigured = (): boolean =>
  Boolean(process.env.OPENWA_URL && process.env.OPENWA_API_KEY && process.env.OPENWA_SESSION_ID);

/** `digits` is the full number with country code and no "+", e.g. 919876543210. */
export const sendWhatsApp = async (digits: string, text: string): Promise<void> => {
  if (!isWhatsAppConfigured()) throw new Error('WhatsApp gateway is not configured');
  if (!/^\d{10,15}$/.test(digits)) throw new Error('Invalid WhatsApp number');

  const base = process.env.OPENWA_URL!.replace(/\/+$/, '');
  const sessionId = encodeURIComponent(process.env.OPENWA_SESSION_ID!);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/api/sessions/${sessionId}/messages/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.OPENWA_API_KEY! },
      body: JSON.stringify({ chatId: `${digits}@c.us`, text }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`OpenWA responded ${res.status}`); // never log the body: it may echo the message
  } finally {
    clearTimeout(timer);
  }
};
