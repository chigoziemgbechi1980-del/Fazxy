const bcrypt = require('bcryptjs');
const { addAuditLog } = require('./db');

function verifyPassword(password, hash) {
  return bcrypt.compareSync(String(password || ''), hash);
}

function requireAdmin(req, res, next) {
  if (!req.session?.isAdmin || !req.session.userId) {
    return res.status(401).json({ error: 'Admin authentication required.' });
  }

  next();
}

function logAction(req, action, targetType, targetId, details = {}) {
  if (!req.session?.userId) return;

  addAuditLog({
    adminId: req.session.userId,
    action,
    targetType,
    targetId,
    details
  });
}

module.exports = { verifyPassword, requireAdmin, logAction };
