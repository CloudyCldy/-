const crypto = require('crypto');

async function list(req, res) {
  const database = req.app.locals.database;
  const orgId = req.session.user.organization_id;
  const { category, phase, methodology, project_id, task_id, q } = req.query;

  const filters = ['files.organization_id = ?'];
  const params = [orgId];

  if (category) {
    filters.push('LOWER(files.category) = LOWER(?)');
    params.push(category.trim());
  }
  if (phase) {
    filters.push('LOWER(files.phase) = LOWER(?)');
    params.push(phase.trim());
  }
  if (methodology) {
    filters.push('UPPER(files.methodology) = UPPER(?)');
    params.push(methodology.trim());
  }
  if (project_id) {
    filters.push('(files.project_id = ? OR EXISTS (SELECT 1 FROM project_documents pd WHERE pd.file_id = files.id AND pd.project_id = ?))');
    params.push(Number(project_id), Number(project_id));
  }
  if (task_id) {
    filters.push('(files.task_id = ? OR EXISTS (SELECT 1 FROM task_documents td WHERE td.file_id = files.id AND td.task_id = ?))');
    params.push(Number(task_id), Number(task_id));
  }
  if (q) {
    filters.push('(LOWER(files.original_name) LIKE ? OR LOWER(COALESCE(files.tags, "")) LIKE ? OR LOWER(COALESCE(files.category, "")) LIKE ?)');
    const searchTerm = `%${q.trim().toLowerCase()}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  const query = `
    SELECT files.id, files.original_name, files.mime_type, files.size, files.created_at,
           files.category, files.phase, files.methodology, files.version, files.tags,
           files.project_id, files.task_id,
           users.name AS uploader_name,
           projects.name AS project_name,
           tasks.title AS task_title
    FROM files
    LEFT JOIN users ON users.id = files.uploaded_by
    LEFT JOIN projects ON projects.id = files.project_id
    LEFT JOIN tasks ON tasks.id = files.task_id
    WHERE ${filters.join(' AND ')}
    ORDER BY files.created_at DESC
  `;

  const files = await database.prepare(query).all(...params);
  res.json(files);
}

async function get(req, res) {
  const database = req.app.locals.database;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Identificador no válido.' });

  const file = await database.prepare(`
    SELECT files.id, files.original_name, files.mime_type, files.size, files.created_at,
           files.category, files.phase, files.methodology, files.version, files.tags,
           files.project_id, files.task_id,
           users.name AS uploader_name,
           projects.name AS project_name,
           tasks.title AS task_title
    FROM files
    LEFT JOIN users ON users.id = files.uploaded_by
    LEFT JOIN projects ON projects.id = files.project_id
    LEFT JOIN tasks ON tasks.id = files.task_id
    WHERE files.id = ? AND files.organization_id = ?
  `).get(id, req.session.user.organization_id);

  if (!file) return res.status(404).json({ error: 'El documento no existe.' });

  const [projectDocs, taskDocs] = await Promise.all([
    database.prepare(`SELECT p.id, p.name FROM project_documents pd JOIN projects p ON p.id = pd.project_id WHERE pd.file_id = ? AND pd.organization_id = ?`).all(id, req.session.user.organization_id),
    database.prepare(`SELECT t.id, t.title FROM task_documents td JOIN tasks t ON t.id = td.task_id WHERE td.file_id = ? AND td.organization_id = ?`).all(id, req.session.user.organization_id)
  ]);

  file.associated_projects = projectDocs;
  file.associated_tasks = taskDocs;
  res.json(file);
}

async function upload(req, res) {
  const database = req.app.locals.database;
  if (!req.file) return res.status(400).json({ error: 'Selecciona un archivo para el Knowledge Center.' });

  const { category = 'general', phase = 'execution', methodology = 'AGILE', tags = '', project_id, task_id, version = 1 } = req.body;
  const orgId = req.session.user.organization_id;
  const userId = req.session.user.id;

  const parsedProjectId = project_id ? Number(project_id) : null;
  const parsedTaskId = task_id ? Number(task_id) : null;

  if (parsedProjectId) {
    const proj = await database.prepare('SELECT id FROM projects WHERE id = ? AND organization_id = ?').get(parsedProjectId, orgId);
    if (!proj) return res.status(404).json({ error: 'El proyecto indicado no pertenece a tu organización.' });
  }

  if (parsedTaskId) {
    const task = await database.prepare('SELECT id FROM tasks WHERE id = ? AND organization_id = ?').get(parsedTaskId, orgId);
    if (!task) return res.status(404).json({ error: 'La tarea indicada no pertenece a tu organización.' });
  }

  const result = await database.prepare(`
    INSERT INTO files (filename, original_name, path, mime_type, size, uploaded_by, organization_id, content, category, phase, methodology, tags, project_id, task_id, version)
    VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
  `).run(
    crypto.randomUUID(),
    req.file.originalname,
    req.file.mimetype,
    req.file.size,
    userId,
    orgId,
    req.file.buffer,
    category,
    phase,
    methodology,
    tags,
    parsedProjectId,
    parsedTaskId,
    Number(version) || 1
  );

  const fileId = result.lastInsertRowid;

  if (parsedProjectId) {
    await database.prepare(`INSERT INTO project_documents (project_id, file_id, organization_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`).run(parsedProjectId, fileId, orgId);
  }
  if (parsedTaskId) {
    await database.prepare(`INSERT INTO task_documents (task_id, file_id, organization_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`).run(parsedTaskId, fileId, orgId);
  }
  if (methodology) {
    await database.prepare(`INSERT INTO methodology_documents (methodology, file_id, organization_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`).run(methodology.toUpperCase(), fileId, orgId);
  }

  await database.prepare(`INSERT INTO activities (organization_id, user_id, project_id, action, description) VALUES (?, ?, ?, ?, ?)`).run(
    orgId, userId, parsedProjectId, 'document.uploaded', `Documento subido a Knowledge Center: ${req.file.originalname}`
  );

  res.status(201).json({ id: fileId, original_name: req.file.originalname });
}

async function associate(req, res) {
  const database = req.app.locals.database;
  const fileId = Number(req.params.id);
  const { project_id, task_id, methodology } = req.body;
  const orgId = req.session.user.organization_id;

  if (!Number.isInteger(fileId) || fileId < 1) return res.status(400).json({ error: 'Identificador de archivo no válido.' });
  const file = await database.prepare('SELECT id, original_name FROM files WHERE id = ? AND organization_id = ?').get(fileId, orgId);
  if (!file) return res.status(404).json({ error: 'El archivo no existe en tu organización.' });

  if (project_id) {
    const projId = Number(project_id);
    const proj = await database.prepare('SELECT id FROM projects WHERE id = ? AND organization_id = ?').get(projId, orgId);
    if (!proj) return res.status(404).json({ error: 'El proyecto no existe.' });
    await database.prepare('INSERT INTO project_documents (project_id, file_id, organization_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING').run(projId, fileId, orgId);
  }

  if (task_id) {
    const tId = Number(task_id);
    const task = await database.prepare('SELECT id FROM tasks WHERE id = ? AND organization_id = ?').get(tId, orgId);
    if (!task) return res.status(404).json({ error: 'La tarea no existe.' });
    await database.prepare('INSERT INTO task_documents (task_id, file_id, organization_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING').run(tId, fileId, orgId);
  }

  if (methodology) {
    await database.prepare('INSERT INTO methodology_documents (methodology, file_id, organization_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING').run(String(methodology).toUpperCase(), fileId, orgId);
  }

  res.json({ ok: true, message: 'Documento asociado correctamente.' });
}

async function removeAssociation(req, res) {
  const database = req.app.locals.database;
  const fileId = Number(req.params.id);
  const { project_id, task_id, methodology } = req.body;
  const orgId = req.session.user.organization_id;

  if (project_id) {
    await database.prepare('DELETE FROM project_documents WHERE file_id = ? AND project_id = ? AND organization_id = ?').run(fileId, Number(project_id), orgId);
  }
  if (task_id) {
    await database.prepare('DELETE FROM task_documents WHERE file_id = ? AND task_id = ? AND organization_id = ?').run(fileId, Number(task_id), orgId);
  }
  if (methodology) {
    await database.prepare('DELETE FROM methodology_documents WHERE file_id = ? AND methodology = ? AND organization_id = ?').run(fileId, String(methodology).toUpperCase(), orgId);
  }

  res.json({ ok: true });
}

module.exports = { list, get, upload, associate, removeAssociation };
