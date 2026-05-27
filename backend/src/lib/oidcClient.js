/**
 * OpenID Connect client for Authentik SSO.
 * Uses openid-client v5 with manual endpoint configuration
 * (matching the Socialite Authentik provider endpoint structure).
 *
 * Authentik endpoints (from socialiteproviders/authentik Provider.php):
 *   Authorize: {base_url}/application/o/authorize/
 *   Token:     {base_url}/application/o/token/
 *   UserInfo:  {base_url}/application/o/userinfo/
 *
 * First tries OIDC discovery, then falls back to manual config.
 */
import { Issuer, generators } from 'openid-client';

let oidcClient = null;

export async function initOidcClient() {
  const baseUrl = (process.env.AUTHENTIK_BASE_URL || 'https://auth.surveye.it/').replace(/\/$/, '');

  // Try discovery first (requires knowing the application slug)
  // Authentik discovery URL: {base_url}/application/o/{slug}/.well-known/openid-configuration
  const discoveryUrls = [
    `${baseUrl}/application/o/ssm/`,          // confirmed slug
    `${baseUrl}/application/o/socketsia/`,    // legacy fallbacks
    `${baseUrl}/application/o/socketsia-v2/`,
    `${baseUrl}/application/o/tecnologici/`,
    `${baseUrl}/.well-known/openid-configuration`,
  ];

  for (const discoveryUrl of discoveryUrls) {
    try {
      const issuer = await Issuer.discover(discoveryUrl);
      oidcClient = new issuer.Client({
        client_id: process.env.AUTHENTIK_CLIENT_ID,
        client_secret: process.env.AUTHENTIK_CLIENT_SECRET,
        redirect_uris: [process.env.AUTHENTIK_REDIRECT_URI],
        response_types: ['code'],
      });
      console.log(`[OIDC] Authentik discovered at: ${discoveryUrl}`);
      return oidcClient;
    } catch {}
  }

  // Fallback: manual configuration using known endpoint structure
  try {
    const issuer = new Issuer({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/application/o/authorize/`,
      token_endpoint: `${baseUrl}/application/o/token/`,
      userinfo_endpoint: `${baseUrl}/application/o/userinfo/`,
      jwks_uri: `${baseUrl}/application/o/ssm/jwks/`,
    });

    oidcClient = new issuer.Client({
      client_id: process.env.AUTHENTIK_CLIENT_ID,
      client_secret: process.env.AUTHENTIK_CLIENT_SECRET,
      redirect_uris: [process.env.AUTHENTIK_REDIRECT_URI],
      response_types: ['code'],
    });

    console.log(`[OIDC] Authentik client configured manually (no discovery) — base: ${baseUrl}`);
    return oidcClient;
  } catch (err) {
    console.warn(`[OIDC] Failed to configure Authentik: ${err.message} — SSO auth disabled`);
    return null;
  }
}

export function getOidcClient() {
  return oidcClient;
}

// Re-export generators for use in auth controller
export { generators };

