const { registry } = require('./methodologyRegistry');

async function listMethodologies(database, orgId) {
  // Obtenemos las metodologías base del registro extensible
  const memoryList = registry.getAll();
  const map = new Map();
  for (const item of memoryList) {
    map.set(item.id.toUpperCase(), item);
  }

  // Complementamos con las metodologías persistidas en la BD para la organización
  if (database) {
    try {
      const dbRows = await database.prepare(`
        SELECT id, name, description, category, principles, practices, is_custom, created_at
        FROM methodologies
        WHERE organization_id = ? OR organization_id IS NULL
        ORDER BY name ASC
      `).all(orgId);

      for (const row of dbRows) {
        const id = row.id.toUpperCase();
        let principles = [];
        let practices = [];
        try {
          principles = typeof row.principles === 'string' ? JSON.parse(row.principles) : (row.principles || []);
        } catch {}
        try {
          practices = typeof row.practices === 'string' ? JSON.parse(row.practices) : (row.practices || []);
        } catch {}

        const item = {
          id,
          name: row.name,
          description: row.description,
          category: row.category,
          principles,
          practices,
          is_custom: Boolean(row.is_custom)
        };
        map.set(id, item);
        // Aseguramos que también esté en memoria en el registro extensible
        if (!registry.has(id)) {
          registry.register(item);
        }
      }
    } catch {}
  }

  return Array.from(map.values());
}

async function getMethodology(database, orgId, id) {
  if (!id) return null;
  const upperId = String(id).trim().toUpperCase();

  // Primero intentamos del registro en memoria
  let item = registry.get(upperId);
  if (item) return item;

  // Si no está en memoria, buscamos en la base de datos
  if (database) {
    try {
      const row = await database.prepare(`
        SELECT id, name, description, category, principles, practices, is_custom
        FROM methodologies
        WHERE UPPER(id) = ? AND (organization_id = ? OR organization_id IS NULL)
      `).get(upperId, orgId);

      if (row) {
        let principles = [];
        let practices = [];
        try {
          principles = typeof row.principles === 'string' ? JSON.parse(row.principles) : (row.principles || []);
        } catch {}
        try {
          practices = typeof row.practices === 'string' ? JSON.parse(row.practices) : (row.practices || []);
        } catch {}

        item = {
          id: row.id.toUpperCase(),
          name: row.name,
          description: row.description,
          category: row.category,
          principles,
          practices,
          is_custom: Boolean(row.is_custom)
        };
        registry.register(item);
        return item;
      }
    } catch {}
  }

  return null;
}

async function createMethodology(database, orgId, userId, data) {
  const name = String(data.name || '').trim();
  if (!name) {
    const error = new Error('El nombre de la metodología es obligatorio.');
    error.status = 400;
    throw error;
  }

  let id = data.id ? String(data.id).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_') : '';
  if (!id) {
    id = name.toUpperCase().replace(/[^A-Z0-9_-]/g, '_').slice(0, 32);
  }

  const description = String(data.description || '').trim();
  if (!description) {
    const error = new Error('La descripción de la metodología es obligatoria.');
    error.status = 400;
    throw error;
  }

  const category = String(data.category || 'agile').trim().toLowerCase();
  const principles = Array.isArray(data.principles) ? data.principles : [];
  const practices = Array.isArray(data.practices) ? data.practices : [];

  // Registrar en el registro extensible en memoria
  const item = registry.register({
    id,
    name,
    description,
    category,
    principles,
    practices,
    is_custom: true
  });

  // Persistir en base de datos PostgreSQL
  if (database) {
    try {
      await database.prepare(`
        INSERT INTO methodologies (id, name, description, category, principles, practices, is_custom, organization_id)
        VALUES (?, ?, ?, ?, ?, ?, true, ?)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          category = EXCLUDED.category,
          principles = EXCLUDED.principles,
          practices = EXCLUDED.practices
      `).run(id, name, description, category, JSON.stringify(principles), JSON.stringify(practices), orgId);

      // Auditoría en activities (RNF17)
      await database.prepare(`
        INSERT INTO activities (organization_id, user_id, action, description)
        VALUES (?, ?, ?, ?)
      `).run(orgId, userId || null, 'methodology.registered', `Nueva metodología registrada en catálogo: ${name} (${id})`);
    } catch (dbErr) {
      console.error('Error al persistir metodología en DB:', dbErr.message);
    }
  }

  return item;
}

async function assignMethodologyToProject(database, orgId, userId, projectId, methodologyId) {
  const parsedProjectId = Number(projectId);
  if (!Number.isInteger(parsedProjectId) || parsedProjectId < 1) {
    const error = new Error('El identificador del proyecto no es válido.');
    error.status = 400;
    throw error;
  }

  const project = await database.prepare(
    'SELECT id, name, methodology_id FROM projects WHERE id = ? AND organization_id = ?'
  ).get(parsedProjectId, orgId);

  if (!project) {
    const error = new Error('El proyecto no existe en tu organización.');
    error.status = 404;
    throw error;
  }

  const rawMethodologyId = String(methodologyId || '').trim();
  if (!rawMethodologyId) {
    const error = new Error('Debes indicar el identificador de la metodología a asignar.');
    error.status = 400;
    throw error;
  }

  const methodology = await getMethodology(database, orgId, rawMethodologyId);
  if (!methodology) {
    const error = new Error(`La metodología "${rawMethodologyId}" no existe en el catálogo.`);
    error.status = 404;
    throw error;
  }

  await database.prepare(`
    UPDATE projects
    SET methodology_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND organization_id = ?
  `).run(methodology.id, parsedProjectId, orgId);

  // Auditoría en activities (RNF17)
  try {
    await database.prepare(`
      INSERT INTO activities (organization_id, user_id, project_id, action, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      orgId, userId || null, parsedProjectId, 'project.methodology_assigned',
      `Metodología asignada: ${methodology.name} (${methodology.id}) al proyecto ${project.name}`
    );
  } catch {}

  return {
    ok: true,
    project_id: parsedProjectId,
    project_name: project.name,
    previous_methodology: project.methodology_id,
    assigned_methodology: methodology
  };
}

module.exports = {
  registry,
  listMethodologies,
  getMethodology,
  createMethodology,
  assignMethodologyToProject
};
