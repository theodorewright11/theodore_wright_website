// POST /api/auth/signout
// Clears the session cookie and best-effort revokes the refresh token at Google.

import {
  env, open, readCookie, clearSessionCookie, REVOKE_ENDPOINT,
} from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const sealed = readCookie(req);
  clearSessionCookie(res);

  if (sealed) {
    try {
      const { encKey } = env();
      const { rt } = JSON.parse(open(sealed, encKey));
      if (rt) {
        await fetch(REVOKE_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: rt }),
        });
      }
    } catch {
      /* best-effort revoke; cookie is already cleared */
    }
  }

  return res.status(200).json({ ok: true });
}
