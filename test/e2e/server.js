process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'playwright-isolated-test-secret';
process.env.DATABASE_URL = 'postgresql://playwright:playwright@127.0.0.1:1/haitani_e2e';
process.env.PGHOST = '127.0.0.1';
process.env.PGPORT = '1';
process.env.PGDATABASE = 'haitani_e2e';
process.env.PGUSER = 'playwright';
process.env.PGPASSWORD = 'playwright';
delete process.env.TEST_DATABASE_URL;

const app = require('../../app');
const bcrypt = require('bcryptjs');

const testPasswordHash = bcrypt.hashSync('password123', 4);

app.locals.database = {
  prepare(query) {
    const statement = query.toLowerCase().replace(/\s+/g, ' ');
    return {
      async all(...params) {
        if (statement.includes('from blocked_ips')) return [];
        return [];
      },
      async get(...params) {
        if (statement.includes('from users') && statement.includes('where (username = ? or email = ?)')) {
          const val = params[0];
          if (val === 'pending-user@empresa.com') {
            return {
              id: 991,
              username: 'pending-user',
              email: 'pending-user@empresa.com',
              password: testPasswordHash,
              role: 'admin',
              organization_id: 881,
              active: 1
            };
          }
          if (val === 'suspended-user@empresa.com') {
            return {
              id: 992,
              username: 'suspended-user',
              email: 'suspended-user@empresa.com',
              password: testPasswordHash,
              role: 'admin',
              organization_id: 882,
              active: 1
            };
          }
          return null;
        }
        if (statement.includes('from organizations where id = ?')) {
          const orgId = params[0];
          if (orgId === 881) return { id: 881, status: 'pending', name: 'Pending Enterprise Inc.' };
          if (orgId === 882) return { id: 882, status: 'suspended', name: 'Suspended Corp.' };
          return { id: orgId, status: 'approved', name: 'Approved Org' };
        }
        if (statement.includes('from users') && statement.includes('username = ?')) return null;
        return null;
      },
      async run(...params) {
        return { changes: 1 };
      }
    };
  }
};

const port = Number(process.env.PLAYWRIGHT_PORT || 4173);
app.server.listen(port, '127.0.0.1', () => {
  console.log(`Playwright test server listening on http://127.0.0.1:${port}`);
});

app.server.on('error', error => {
  console.error('Playwright test server failed to start:', error);
  process.exitCode = 1;
});
