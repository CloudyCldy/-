const issueService = require('../services/issueService');

async function list(req, res, next) {
  try {
    const database = req.app.locals.database;
    const orgId = req.session.user.organization_id;

    const filters = {
      projectId: req.params.projectId || req.params.id || req.query.project_id || null,
      status: req.query.status || null,
      priority: req.query.priority || null,
      assignedTo: req.query.assigned_to || null
    };

    const issues = await issueService.listIssues(database, orgId, filters);
    res.json(issues);
  } catch (error) {
    next(error);
  }
}

async function get(req, res, next) {
  try {
    const database = req.app.locals.database;
    const orgId = req.session.user.organization_id;
    const id = req.params.id;

    const issue = await issueService.getIssueById(database, orgId, id);
    if (!issue) {
      return res.status(404).json({ error: 'La incidencia no existe.' });
    }
    res.json(issue);
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
      project_id: req.params.projectId || req.params.id || req.body.project_id
    };

    const issue = await issueService.createIssue(database, orgId, userId, data);
    res.status(201).json(issue);
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

    const issue = await issueService.updateIssue(database, orgId, userId, id, req.body);
    res.json(issue);
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

    const result = await issueService.deleteIssue(database, orgId, userId, id);
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
