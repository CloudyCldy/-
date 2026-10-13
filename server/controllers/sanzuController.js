const sanzuService = require('../services/sanzuService');

function maskApiKey(key) {
  if (!key) return '';
  const str = String(key).trim();
  if (str.length <= 8) return '••••••••';
  return `${str.slice(0, 4)}...${str.slice(-4)}`;
}

async function status(req, res) {
  try {
    const database = req.app.locals.database;
    const orgId = req.session.user.organization_id;
    const creds = await sanzuService.resolveOrganizationCredentials(database, orgId);

    const hasKey = Boolean(creds.apiKey);
    const masked = hasKey ? maskApiKey(creds.apiKey) : '';

    res.json({
      configured: hasKey,
      sanzu_api_url: creds.apiUrl || 'https://sanzu.onrender.com',
      sanzu_project_id: creds.projectId || '',
      masked_key: masked,
      connected: creds.connected,
      has_key: hasKey
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al consultar estado de Sanzu.' });
  }
}

async function configure(req, res) {
  try {
    const database = req.app.locals.database;
    const orgId = req.session.user.organization_id;
    const { sanzu_api_key, sanzu_api_url, sanzu_project_id } = req.body;

    const currentCreds = await sanzuService.resolveOrganizationCredentials(database, orgId);
    const cleanKey = sanzu_api_key !== undefined ? String(sanzu_api_key).trim() : currentCreds.apiKey;
    const cleanUrl = sanzu_api_url ? String(sanzu_api_url).trim().replace(/\/$/, '') : (currentCreds.apiUrl || 'https://sanzu.onrender.com');
    const cleanProjectId = sanzu_project_id !== undefined ? String(sanzu_project_id).trim() : (currentCreds.projectId || null);

    if (!cleanKey) {
      return res.status(400).json({ error: 'La Sanzu API Key es obligatoria para conectar con Sanzu.' });
    }

    // Probar conexión con Sanzu
    let testResult = { ok: false };
    try {
      testResult = await sanzuService.testConnection(cleanKey, cleanUrl);
    } catch (testErr) {
      testResult = { ok: false, error: testErr.message };
    }

    await database.prepare(`
      UPDATE organizations
      SET sanzu_api_key = ?,
          sanzu_token = ?,
          sanzu_api_url = ?,
          sanzu_project_id = ?,
          sanzu_connected = ?,
          sanzu_last_tested_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(cleanKey, cleanKey, cleanUrl, cleanProjectId, testResult.ok, orgId);

    res.json({
      ok: true,
      connected: testResult.ok,
      message: testResult.ok
        ? 'Sanzu API Key guardada y conexión verificada correctamente.'
        : `Sanzu API Key guardada. Nota de conexión: ${testResult.error || 'Sanzu no respondió satisfactoriamente.'}`
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'No fue posible guardar la configuración de Sanzu.' });
  }
}

async function test(req, res) {
  try {
    const database = req.app.locals.database;
    const orgId = req.session.user.organization_id;
    const creds = await sanzuService.resolveOrganizationCredentials(database, orgId);

    if (!creds.apiKey) {
      return res.status(400).json({
        configured: false,
        error: 'No hay ninguna Sanzu API Key configurada. Ingrésala manualmente primero.'
      });
    }

    try {
      const result = await sanzuService.testConnection(creds.apiKey, creds.apiUrl);
      await database.prepare(`
        UPDATE organizations
        SET sanzu_connected = true, sanzu_last_tested_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(orgId);

      res.json({ ok: true, connected: true, message: result.message });
    } catch (testErr) {
      await database.prepare(`
        UPDATE organizations
        SET sanzu_connected = false, sanzu_last_tested_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(orgId);

      res.status(502).json({
        ok: false,
        connected: false,
        error: `Fallo al verificar con Sanzu: ${testErr.message}`
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al probar conexión con Sanzu.' });
  }
}

module.exports = {
  status,
  configure,
  test
};
