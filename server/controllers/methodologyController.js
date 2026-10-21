const methodologyService = require('../services/methodologyService');

async function list(req, res) {
  try {
    const orgId = req.session.user.organization_id;
    const methodologies = await methodologyService.listMethodologies(req.app.locals.database, orgId);
    res.json(methodologies);
  } catch (err) {
    console.error('Error listMethodologies:', err);
    res.status(500).json({ error: 'Error al obtener el catálogo de metodologías.' });
  }
}

async function get(req, res) {
  try {
    const orgId = req.session.user.organization_id;
    const { id } = req.params;
    const methodology = await methodologyService.getMethodology(req.app.locals.database, orgId, id);
    if (!methodology) {
      return res.status(404).json({ error: 'Metodología no encontrada en el catálogo.' });
    }
    res.json(methodology);
  } catch (err) {
    console.error('Error getMethodology:', err);
    res.status(500).json({ error: 'Error al consultar la metodología.' });
  }
}

async function create(req, res) {
  try {
    const orgId = req.session.user.organization_id;
    const userId = req.session.user.id;
    const result = await methodologyService.createMethodology(req.app.locals.database, orgId, userId, req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || 'Error al registrar la metodología.' });
  }
}

async function assignToProject(req, res) {
  try {
    const orgId = req.session.user.organization_id;
    const userId = req.session.user.id;
    const projectId = req.params.projectId || req.params.id || req.body.project_id;
    const methodologyId = req.body.methodology_id || req.body.methodologyId || (req.body.id);

    const result = await methodologyService.assignMethodologyToProject(
      req.app.locals.database,
      orgId,
      userId,
      projectId,
      methodologyId
    );
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || 'Error al asignar la metodología al proyecto.' });
  }
}

module.exports = {
  list,
  get,
  create,
  assignToProject
};
