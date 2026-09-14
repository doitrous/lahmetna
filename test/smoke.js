// SEO hygiene smoke test. No deps: boots the real server on an ephemeral port,
// fetches /, /sitemap.xml, /robots.txt, then shuts it down.
// Run: node test/smoke.js
const { spawn } = require('node:child_process');
const path = require('node:path');
const assert = require('node:assert');

const PORT = 4571;
const SEO_SECRET = 'test-secret';
const base = 'http://localhost:' + PORT;
const server = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
  env: Object.assign({}, process.env, { PORT: String(PORT), SEO_HUB_SECRET: SEO_SECRET, SEO_SITE_SLUG: 'lahmetna' }),
  stdio: ['ignore', 'pipe', 'inherit'],
});

async function waitForServer(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { await fetch(base + '/'); return; } catch (_) { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('server did not start in time');
}

(async () => {
  try {
    await waitForServer(10000);

    const sitemap = await fetch(base + '/sitemap.xml').then((r) => r.text());
    assert.ok((sitemap.match(/<loc>/g) || []).length >= 1, 'sitemap.xml must have >=1 <loc> entry');

    const robots = await fetch(base + '/robots.txt').then((r) => r.text());
    assert.ok(robots.includes('Sitemap:'), 'robots.txt must reference a Sitemap:');

    const home = await fetch(base + '/').then((r) => r.text());
    assert.ok(/<h1/.test(home), 'homepage must contain an <h1');
    assert.ok(home.includes('rel="canonical"'), 'homepage must contain rel="canonical"');

    const unauthed = await fetch(base + '/api/seo/health');
    assert.strictEqual(unauthed.status, 401, '/api/seo/health must be 401 without a bearer');
    const authed = await fetch(base + '/api/seo/health', { headers: { Authorization: 'Bearer ' + SEO_SECRET } });
    assert.strictEqual(authed.status, 200, '/api/seo/health must be 200 with the right bearer');
    const health = await authed.json();
    assert.strictEqual(health.siteSlug, 'lahmetna', '/api/seo/health must report siteSlug');

    console.log('smoke test passed');
  } finally {
    server.kill();
  }
})().catch((e) => { console.error(e); server.kill(); process.exit(1); });
