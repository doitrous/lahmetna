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

    // A hub-pushed redirect must actually redirect, not just get accepted by /api/seo/sync.
    const sync = await fetch(base + '/api/seo/sync', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + SEO_SECRET, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: 1, siteSlug: 'lahmetna', settings: {}, pages: [],
        redirects: [{ source: '/old-path', destination: '/new-path', type: 301, active: true }],
      }),
    });
    assert.strictEqual(sync.status, 200, '/api/seo/sync must accept a well-formed snapshot');
    assert.strictEqual((await sync.json()).status, 'applied');

    const health2 = await fetch(base + '/api/seo/health', { headers: { Authorization: 'Bearer ' + SEO_SECRET } }).then((r) => r.json());
    assert.strictEqual(health2.counts.redirects, 1, 'health must count the synced redirect');

    const redirect = await fetch(base + '/old-path', { redirect: 'manual' });
    assert.strictEqual(redirect.status, 301, 'GET /old-path must 301, not fall through to a 404');
    assert.strictEqual(redirect.headers.get('location'), '/new-path');

    // Regression: a hub page record with NO real seoTitle (empty/whitespace-only) must leave the
    // static page's own <title> completely untouched — composeSeo/resolveSeo's `title` is never
    // really empty (it templates page.title, or falls back to the org name), so a fix that
    // replaces the tag whenever resolveSeo's title is non-empty ends up rewriting every page's
    // title once a snapshot syncs, even with no admin override at all.
    const syncBlank = await fetch(base + '/api/seo/sync', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + SEO_SECRET, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: 2, siteSlug: 'lahmetna', settings: {}, redirects: [],
        pages: [{ path: '/', lang: 'en', seo: { seoTitle: '   ', metaDescription: '' } }],
      }),
    });
    assert.strictEqual((await syncBlank.json()).status, 'applied', 'sync with a blank seoTitle must be accepted');
    const homeAfterBlank = await fetch(base + '/').then((r) => r.text());
    assert.strictEqual(homeAfterBlank, home, 'a blank hub seoTitle must not change the served HTML at all');

    // A real, explicit seoTitle must win over the page's own static <title>.
    const syncReal = await fetch(base + '/api/seo/sync', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + SEO_SECRET, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: 3, siteSlug: 'lahmetna', settings: {}, redirects: [],
        pages: [{ path: '/', lang: 'en', seo: { seoTitle: 'Custom Home Title', metaDescription: '' } }],
      }),
    });
    assert.strictEqual((await syncReal.json()).status, 'applied', 'sync with a real seoTitle must be accepted');
    const homeAfterReal = await fetch(base + '/').then((r) => r.text());
    assert.ok(homeAfterReal.includes('<title>Custom Home Title</title>'), 'an explicit hub seoTitle must replace the static <title>');

    // V2-PHASE-8 Workstream D: /help, /help/[slug], /editorial-guidelines + the share block.
    assert.ok(home.includes('class="seo-share"'), 'homepage must carry the share block');

    const product = await fetch(base + '/product.html?id=ribeye').then((r) => r.text());
    assert.ok(product.includes('class="seo-share"'), 'a product page must carry the share block');
    assert.ok(product.includes('data-title="Dry-Aged Ribeye'), 'product share block title must reflect the actual product, not a generic fallback');

    const help = await fetch(base + '/help').then((r) => r.text());
    assert.strictEqual((await fetch(base + '/help')).status, 200, '/help must render 200 even with no hub help entries synced');
    assert.ok(help.includes('<h1>Help</h1>'), '/help must render the runtime\'s empty-state body');
    assert.ok(help.includes('class="seo-share"'), '/help must carry the share block');

    const helpArabic = await fetch(base + '/help?lang=ar').then((r) => r.text());
    assert.ok(helpArabic.includes('dir="rtl"'), '/help?lang=ar must render rtl');

    const helpMissing = await fetch(base + '/help/no-such-slug');
    assert.strictEqual(helpMissing.status, 404, 'an unknown /help/[slug] must 404, not render an empty page as if it existed');

    const editorial = await fetch(base + '/editorial-guidelines');
    assert.strictEqual(editorial.status, 200, '/editorial-guidelines must render 200 even with no hub editorial content synced');
    const editorialBody = await editorial.text();
    assert.ok(editorialBody.includes('Editorial guidelines'), '/editorial-guidelines must render the runtime\'s empty-state body');
    assert.ok(editorialBody.includes('class="seo-share"'), '/editorial-guidelines must carry the share block');

    const healthShare = await fetch(base + '/api/seo/health', { headers: { Authorization: 'Bearer ' + SEO_SECRET } }).then((r) => r.json());
    assert.strictEqual(healthShare.share, true, '/api/seo/health must report share: true now that the share block is wired in');

    console.log('smoke test passed');
  } finally {
    server.kill();
  }
})().catch((e) => { console.error(e); server.kill(); process.exit(1); });
