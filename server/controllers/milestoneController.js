const milestoneService = require('../services/milestoneService');

async function list(req, res, next) {
  try {
    const database = req.app.locals.database;
    const orgId = req.session.user.organization_id;
    const projectId = req.query.project_id || req.params.projectId || null;
    const status = req.query.status || null;

    const milestones = await milestoneService.listMilestones(database, orgId, projectId, status);
    res.json(milestones);
  } catch (error) {
    next(error);
  }
}

async function get(req, res, next) {
  try {
    const database = req.app.locals.database;
    const orgId = req.session.user.organization_id;
    const id = req.params.id;

    const milestone = await milestoneService.getMilestoneById(database, orgId, id);
    if (!milestone) {
      return res.status(404).json({ error: 'El hito no existe.' });
    }
    res.json(milestone);
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

    const milestone = await milestoneService.createMilestone(database, orgId, userId, data);
    res.status(201).json(milestone);
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

    const milestone = await milestoneService.updateMilestone(database, orgId, userId, id, req.body);
    res.json(milestone);
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

    const result = await milestoneService.deleteMilestone(database, orgId, userId, id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  get,
  create,
  update,
  remove
};
