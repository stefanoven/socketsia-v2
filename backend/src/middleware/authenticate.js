/**
 * JWT Authentication Middleware.
 * Verifies JWT from Authorization header (Bearer token) or httpOnly cookie.
 */
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

/**
 * Middleware: require a valid JWT.
 * Populates req.user with the decoded payload.
 */
export function authenticate(req, res, next) {
  let token;

  // Check Authorization header first (Bearer token for API clients)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // Fallback: check httpOnly cookie (for browser SPA)
  if (!token && req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Non autenticato. Effettuare il login.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token non valido o scaduto. Effettuare nuovamente il login.' });
  }
}

/**
 * Generate a JWT for a user.
 * @param {object} user - User record from DB
 * @returns {string} Signed JWT
 */
export function signJwt(user) {
  return jwt.sign(
    {
      sub: user.id,
      id: user.id,
      email: user.email,
      name: user.name,
      type: user.type,
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}
