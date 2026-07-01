/**
 * requireAuth — protects any route that needs a logged-in user.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ success: false, message: 'Unauthorised' });
  }
  res.redirect('/auth/login?next=' + encodeURIComponent(req.originalUrl));
}

/**
 * requireRole — further restricts by role.
 * Usage: requireRole('superadmin') or requireRole(['superadmin','admin'])
 */
function requireRole(...roles) {
  const allowed = roles.flat();
  return (req, res, next) => {
    if (!req.session?.userId) return requireAuth(req, res, next);
    if (!allowed.includes(req.session.role)) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      return res.status(403).send('<h2>403 — Forbidden</h2><p>You do not have permission to access this page.</p>');
    }
    next();
  };
}

/**
 * attachUser — makes session user available in res.locals for views.
 */
function attachUser(req, res, next) {
  res.locals.user = req.session?.userId ? {
    id: req.session.userId,
    name: req.session.userName,
    email: req.session.userEmail,
    role: req.session.role,
  } : null;
  next();
}

module.exports = { requireAuth, requireRole, attachUser };
