async function list(req, res) {
  const plans = await req.app.locals.database.prepare(`
    SELECT id, key, name, price_cents, currency, max_users,
           max_projects, max_storage_mb, features, created_at
    FROM plans
    ORDER BY id
  `).all();
  res.json(plans);
}

module.exports = { list };