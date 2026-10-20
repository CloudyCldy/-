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

app.locals.database = {
  prepare(query) {
    const statement = query.toLowerCase().replace(/\s+/g, ' ');
    return {
      async all() {
        if (statement.includes('from blocked_ips')) return [];
        return [];
      },
      async get() {
        if (statement.includes('from users') && statement.includes('username = ?')) return null;
        return null;
      },
      async run() {
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
