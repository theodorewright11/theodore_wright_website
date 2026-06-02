// POST /api/auth/exchange  { code }
// One-time exchange of an OAuth authorization code (from the browser's
// interactive sign-in popup) for an access token + refresh token. The refresh
// token is sealed into an HttpOnly cookie; only the short-lived access token
// (and email) is returned to the browser.

import {
  env, seal, setSessionCookie, emailFromIdToken, readJsonBody, TOKEN_ENDPOINT,
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

  let code;
  try {
    ({ code } = await readJsonBody(req));
  } catch {
    return res.status(400).json({ error: 'bad_request' });
  }
  if (!code) return res.status(400).json({ error: 'missing_code' });

  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    // 'postmessage' is the redirect URI for the GIS code-client popup flow.
    redirect_uri: 'postmessage',
    grant_type: 'authorization_code',
  });

  const r = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const data = await r.json();
  if (!r.ok) {
    return res.status(400).json({ error: data.error || 'exchange_failed', detail: data.error_description });
  }

  // refresh_token is only present when offline access was granted. The GIS code
  // flow requests it; if it's absent (already granted on a prior consent that
  // didn't return one), the caller should sign in again with prompt=consent.
  if (!data.refresh_token) {
    return res.status(409).json({ error: 'no_refresh_token' });
  }

  const email = emailFromIdToken(data.id_token);
  setSessionCookie(res, seal(JSON.stringify({ rt: data.refresh_token, email }), encKey));

  return res.status(200).json({
    access_token: data.access_token,
    expires_in: data.expires_in,
    email,
  });
}
