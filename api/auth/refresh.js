// POST /api/auth/refresh
// Mints a fresh access token from the sealed refresh-token cookie. No popup,
// no user interaction — this is what runs ~hourly (and on page load) in place
// of the GIS prompt:'none' silent refresh that COOP broke. 401 means there is
// no valid session and the browser should fall back to interactive sign-in.

import {
  env, open, readCookie, clearSessionCookie, TOKEN_ENDPOINT,
} from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  let clientId, clientSecret, encKey;
  try {
    ({ clientId, clientSecret, encKey } = env());
  } catch (e) {
    return res.status(500).json({ error: 'server_misconfigured', detail: e.message });
  }

  const sealed = readCookie(req);
  if (!sealed) return res.status(401).json({ error: 'no_session' });

  let session;
  try {
    session = JSON.parse(open(sealed, encKey));
  } catch {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'bad_session' });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: session.rt,
    grant_type: 'refresh_token',
  });

  const r = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const data = await r.json();
  if (!r.ok) {
    // invalid_grant = refresh token revoked or expired → session is dead.
    if (data.error === 'invalid_grant') clearSessionCookie(res);
    return res.status(401).json({ error: data.error || 'refresh_failed' });
  }

  return res.status(200).json({
    access_token: data.access_token,
    expires_in: data.expires_in,
    email: session.email,
  });
}
