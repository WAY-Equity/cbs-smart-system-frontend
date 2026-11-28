// Public SPA identifiers, safe to include in the browser bundle. Never add a client secret.
export const authConfig = {
  domain: 'dev-m4cnup0ujpc2l7wn.us.auth0.com',
  clientId: 'hJYhsluI7zSN0JvevTtUODyMvInFN036',
  logo: 'https://db8os8tanj5pj.cloudfront.net/assets/logo/cbs-logo.png',
};

export function safeReturnTo(value: unknown, origin: string): string {
  if (typeof value !== 'string') return '/';
  try {
    const target = new URL(value, origin);
    if (target.origin !== origin) return '/';
    for (const key of ['code', 'state', 'error', 'error_description', 'error_uri', 'iss']) target.searchParams.delete(key);
    return target.pathname + target.search + target.hash;
  } catch { return '/'; }
}
