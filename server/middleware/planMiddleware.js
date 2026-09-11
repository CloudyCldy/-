const fs = require('fs');

async function getPlan(req) {
  const organization = await req.app.locals.database.prepare('SELECT plan_id, subscription_status FROM organizations WHERE id = ?').get(req.session.user.organization_id);
  if (!organization) return null;
  if (process.env.SANDBOX_MODE !== 'true' && ['pending', 'past_due'].includes(organization.subscription_status)) return req.app.locals.database.prepare('SELECT * FROM plans WHERE key = ?').get('free');
  return req.app.locals.database.prepare('SELECT * FROM plans WHERE id = ?').get(organization.plan_id);
}

async function checkCount(req, res, next, table, field, message, condition = '1 = 1') {
  try {
    const plan = await getPlan(req);
    if (plan?.[field] == null) return next();
    const count = await req.app.locals.database.prepare(`SELECT COUNT(*)::integer AS count FROM ${table} WHERE organization_id = ? AND ${condition}`).get(req.session.user.organization_id);
    if (count.count >= plan[field]) return res.status(403).json({ error: message });
    next();
  } catch (error) { next(error); }
}

function checkUserLimit(req, res, next) { return checkCount(req, res, next, 'users', 'max_users', 'Alcanzaste el límite de usuarios de tu plan actual. Actualiza tu plan para agregar más integrantes.', 'active = 1'); }
function checkProjectLimit(req, res, next) { return checkCount(req, res, next, 'projects', 'max_projects', 'Alcanzaste el límite de proyectos de tu plan actual. Actualiza tu plan para agregar más proyectos.'); }

async function checkStorageLimit(req, res, next) {
  try {
    const plan = await getPlan(req);
    if (plan?.max_storage_mb == null || !req.file) return next();
    const current = await req.app.locals.database.prepare('SELECT COALESCE(SUM(size), 0)::bigint AS bytes FROM files WHERE organization_id = ?').get(req.session.user.organization_id);
    if (Number(current.bytes) + req.file.size > Number(plan.max_storage_mb) * 1024 * 1024) {
      fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: 'Alcanzaste el límite de almacenamiento de tu plan actual. Actualiza tu plan para subir más archivos.' });
    }
    next();
  } catch (error) { next(error); }
}

function requireFeature(name) {
  return async (req, res, next) => {
    try {
      const plan = await getPlan(req);
      if (!plan?.features?.[name]) return res.status(403).json({ error: 'Esta función no está disponible en tu plan actual.' });
      req.plan = plan;
      next();
    } catch (error) { next(error); }
  };
}

module.exports = { checkUserLimit, checkProjectLimit, checkStorageLimit, requireFeature, getPlan };