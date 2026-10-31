/** Escapes user text so it can sit inside a RegExp as a literal (also caps its length against ReDoS). */
export const escapeRegex = (raw: unknown, max = 100): string =>
  String(raw ?? '').slice(0, max).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Parses ?page= and ?limit= into safe numbers: page >= 1, 1 <= limit <= maxLimit. */
export const pageParams = (query: { page?: unknown; limit?: unknown }, defaultLimit = 20, maxLimit = 50) => {
  const page = Math.max(1, Math.min(10000, parseInt(String(query.page ?? '1'), 10) || 1));
  const limit = Math.max(1, Math.min(maxLimit, parseInt(String(query.limit ?? defaultLimit), 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

export const pick = <T extends Record<string, unknown>>(src: T | undefined, keys: readonly string[]): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (src && src[k] !== undefined) out[k] = src[k];
  return out;
};
