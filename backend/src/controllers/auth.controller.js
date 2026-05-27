/**
 * Auth Controller
 * Handles Authentik SSO OIDC flow and JWT issuance.
 *
 * PKCE state (codeVerifier + state + frontendOrigin) is stored in a short-lived
 * httpOnly cookie instead of Express session, so it survives backend restarts.
 *
 * REDIRECT_URI must point to the *frontend* port (5173 in dev, production domain)
 * so that Vite proxies the callback, keeping all cookies on the same origin.
 */
import { generators } from 'openid-client';
import { getOidcClient } from '../lib/oidcClient.js';
import { signJwt } from '../middleware/authenticate.js';
import prisma from '../lib/prisma.js';

const JWT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 8 * 60 * 60 * 1000, // 8 hours
};

const PKCE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 10 * 60 * 1000, // 10 minutes — only for OIDC flow
};

/**
 * Determine the frontend base URL to use for redirects after the OIDC callback.
 *
 * Priority:
 *  1. `?origin=` query param — explicit value set by the frontend link
 *  2. FRONTEND_ORIGIN env var — explicit config (set to http://localhost:5173 in dev)
 *  3. Referer / Origin headers — fallback (may be altered by proxies)
 *  4. Request's own host — last resort
 */
function parseFrontendOrigin(req) {
  // 1. Query param (most explicit — set by Login.jsx link in future)
  if (req.query.origin) {
    try {
      const u = new URL(req.query.origin);
      const origin = `${u.protocol}//${u.host}`;
      const allowed = [
        'http://localhost:5173',
        'http://localhost:3000',
        process.env.FRONTEND_ORIGIN,
      ].filter(Boolean);
      if (allowed.includes(origin) || u.protocol === 'https:') return origin;
    } catch {}
  }

  // 2. FRONTEND_ORIGIN env var (primary source in development)
  if (process.env.FRONTEND_ORIGIN) return process.env.FRONTEND_ORIGIN;

  // 3. Referer / Origin header (useful in production behind reverse proxy)
  const raw = req.get('referer') || req.get('origin') || '';
  if (raw) {
    try { return new URL(raw).origin; } catch {}
  }

  // 4. Fall back to the backend's own host (should never reach this in normal use)
  return `${req.protocol}://${req.get('host')}`;
}

/**
 * GET /api/auth/authentik/redirect
 * Initiates the Authentik OIDC authorization flow.
 */
export async function redirect(req, res) {
  const client = getOidcClient();
  const frontendOrigin = parseFrontendOrigin(req);

  if (!client) {
    return res.redirect(`${frontendOrigin}/login?error=oidc_unavailable`);
  }

  const codeVerifier  = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);
  const state         = generators.state();

  // Persist PKCE state in a short-lived httpOnly cookie.
  // Using a cookie (instead of express-session) means the state survives
  // backend restarts and doesn't require a session store.
  res.cookie(
    'oidc_pkce',
    JSON.stringify({ codeVerifier, state, frontendOrigin }),
    PKCE_COOKIE_OPTIONS
  );

  const authorizationUrl = client.authorizationUrl({
    scope: 'openid email profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });

  res.redirect(authorizationUrl);
}

/**
 * GET /api/auth/authentik/callback
 * Handles the Authentik callback, exchanges code for tokens, issues JWT.
 */
export async function callback(req, res) {
  // --- Debug logging (remove after verifying the login flow works) ---
  console.log('[Auth] Callback invoked — host:', req.get('host'));
  console.log('[Auth] oidc_pkce cookie:', req.cookies.oidc_pkce ? 'PRESENT' : 'MISSING');

  // Read and immediately clear the PKCE state cookie
  let pkce = {};
  try {
    pkce = JSON.parse(req.cookies.oidc_pkce || '{}');
  } catch {}
  res.clearCookie('oidc_pkce');

  const { codeVerifier, state: savedState, frontendOrigin } = pkce;

  // Determine where to send the user on success/failure
  const frontendUrl = frontendOrigin
    || process.env.FRONTEND_ORIGIN
    || `${req.protocol}://${req.get('host')}`;

  console.log('[Auth] frontendUrl (post-callback redirect):', frontendUrl);

  const client = getOidcClient();
  if (!client) {
    return res.redirect(`${frontendUrl}/login?error=oidc_unavailable`);
  }

  // If PKCE state is missing (cookie expired or not sent), restart the flow
  if (!codeVerifier) {
    console.warn('[Auth] PKCE cookie missing or expired — redirecting to login');
    return res.redirect(`${frontendUrl}/login?error=callback_failed`);
  }

  try {
    const params = client.callbackParams(req);

    const tokenSet = await client.callback(
      process.env.AUTHENTIK_REDIRECT_URI,
      params,
      {
        code_verifier: codeVerifier,
        state: savedState,
      }
    );

    const claims = tokenSet.claims();
    const email  = claims.email;
    console.log('[Auth] Authentik email from token:', email);

    if (!email) {
      return res.redirect(`${frontendUrl}/login?error=no_email`);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    console.log('[Auth] DB user found:', !!user, user ? `(${user.type})` : '');

    if (!user) {
      return res.redirect(`${frontendUrl}/login?error=unauthorized`);
    }

    // Issue JWT as httpOnly cookie
    const token = signJwt(user);
    res.cookie('token', token, JWT_COOKIE_OPTIONS);

    console.log('[Auth] JWT issued — redirecting to:', `${frontendUrl}/dashboard`);
    res.redirect(`${frontendUrl}/dashboard`);
  } catch (err) {
    console.error('[Auth] Callback error:', err.message);
    res.redirect(`${frontendUrl}/login?error=callback_failed`);
  }
}

/**
 * GET /api/auth/me
 * Returns current user info from JWT.
 */
export function me(req, res) {
  res.json({
    id:    req.user.id,
    email: req.user.email,
    name:  req.user.name,
    type:  req.user.type,
  });
}

/**
 * POST /api/auth/logout
 * Clears the JWT cookie.
 */
export function logout(req, res) {
  res.clearCookie('token');
  res.json({ message: 'Logout effettuato' });
}
