/**
 * SMS delivery hook.
 *
 * No SMS provider is wired up yet, so in development the message is printed to the backend terminal
 * (same as email OTPs), and in production sending fails with a clear error instead of silently
 * pretending to succeed.
 *
 * To go live: pick a provider (MSG91, Twilio, Fast2SMS, ...), add its keys to the root .env, and
 * replace the body of this function with the provider's API call. Nothing else needs to change.
 */
export const sendSms = async (to: string, text: string): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SMS provider is not configured');
  }
  console.log(`[SMS:dev] to ${to}: ${text}`);
};
