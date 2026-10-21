const riskService = require('../services/riskService');

async function list(req, res, next) {
  try {
    const database = req.app.locals.database;
    const orgId = req.session.user.organization_id;
    const projectId = req.query.project_id || req.params.projectId || null;
    const status = req.query.status || null;

    const risks = await riskService.listRisks(database, orgId, projectId, status);
    res.json(risks);
  } catch (error) {
    next(error);
  }
}

async function get(req, res, next) {
  try {
    const database = req.app.locals.database;
    const orgId = req.session.user.organization_id;
    const id = req.params.id;

    const risk = await riskService.getRiskById(database, orgId, id);
    if (!risk) {
      return res.status(404).json({ error: 'El riesgo no existe.' });
    }
    res.json(risk);
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const database = req.app.locals.database;
    const orgId = req.session.user.organization_id;
    const userId = req.session.user.id;

    const data = {
      ...req.body,
      project_id: req.params.projectId || req.body.project_id
    };

    const risk = await riskService.createRisk(database, orgId, userId, data);
    res.status(201).json(risk);
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const database = req.app.locals.database;
    const orgId = req.session.user.organization_id;
    const userId = req.session.user.id;
    const id = req.params.id;

    const risk = await riskService.updateRisk(database, orgId, userId, id, req.body);
    res.json(risk);
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const database = req.app.locals.database;
    const orgId = req.session.user.organization_id;
    const userId = req.session.user.id;
    const id = req.params.id;

    const result = await riskService.deleteRisk(database, orgId, userId, id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function workload(req, res, next) {
  try {
    const database = req.app.locals.database;
    const orgId = req.session.user.organization_id;
    const projectId = req.query.project_id ? Number(req.query.project_id) : null;

    const data = await riskService.getWorkload(database, orgId, projectId);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function overview(req, res, next) {
  try {
    const database = req.app.locals.database;
    const orgId = req.session.user.organization_id;

    const data = await riskService.getOverview(database, orgId);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  workload,
  overview
};
