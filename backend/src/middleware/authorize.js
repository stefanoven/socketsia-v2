/**
 * Role-based Authorization Middleware.
 */

/**
 * Require the 'manager' role.
 * Must be used after authenticate middleware.
 */
export function requireManager(req, res, next) {
  if (req.user?.type !== 'manager') {
    return res.status(403).json({ error: 'Accesso negato. Richiesto ruolo manager.' });
  }
  next();
}
