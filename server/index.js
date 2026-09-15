'use strict';
/* Lahmetna backend — zero-dependency (node:http + node:sqlite).
   Multi-vendor marketplace: customer/vendor/admin auth, applications,
   products, cart/checkout, PayTabs (Egypt) with a mock fallback. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { q } = require('./db.js');
const auth = require('./auth.js');
const paytabs = require('./paytabs.js');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 4173;
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

/* seo-runtime (@omary98/seo-runtime-core) — hub health/sync/pages/pending-approve proxy plus
   article ingest, wired directly against core's exports rather than pulling in the express
   package: this backend is deliberately zero-dependency and core has no Express coupling.
   ESM-only package, this file is CommonJS, so it's loaded once at startup (see initSeo()
   near the bottom, awaited before .listen()) rather than per request. */
let seo = null;
async function initSeo() {
  const core = await import('@omary98/seo-runtime-core');
  const store = new core.JsonFileStore(path.join(ROOT, 'data', 'seo-runtime.json'));
  seo = { core, store, version: core.RUNTIME_VERSION };
  core.startSync(store, { version: seo.version });
}

/* ---- helpers ---- */
function json(res, code, obj, headers) {
  res.writeHead(code, Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, headers || {}));
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = '', size = 0;
    req.on('data', (c) => { size += c.length; if (size > 1e6) { reject(new Error('too large')); req.destroy(); } d += c; });
    req.on('end', () => {
      if (!d) return resolve({});
      try { return resolve(JSON.parse(d)); } catch (e) { /* try form */ }
      try { const o = {}; new URLSearchParams(d).forEach((v, k) => { o[k] = v; }); resolve(o); } catch (e2) { reject(new Error('bad body')); }
    });
    req.on('error', reject);
  });
}
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max || 500) : '');
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
function baseUrl(req) { return (req.headers['x-forwarded-proto'] || 'http') + '://' + (req.headers.host || ('localhost:' + PORT)); }
function currentUser(req) { return q.sessionUser(auth.parseCookies(req.headers.cookie)[auth.SESSION_COOKIE]); }
function publicUser(u) {
  if (!u) return null;
  const o = { id: u.id, role: u.role, name: u.name, email: u.email, phone: u.phone, vendor_id: u.vendor_id, suspended: !!u.suspended };
  if (u.role === 'customer') { const s = q.subscription('customer', u.id); o.plan = (s && (s.status === 'active' || s.status === 'cancelled') && new Date(s.renews) > new Date()) ? 'one' : null; o.plan_status = s ? s.status : null; o.plan_renews = s ? s.renews : null; }
  if (u.vendor_id) {
    const v = q.vendor(u.vendor_id); if (v) { o.vendor_slug = v.slug; o.vendor_name = v.name; o.vendor_status = v.status; o.featured = !!v.featured; }
    const s = q.subscription('vendor', u.vendor_id); o.plan = (s && (s.status === 'active' || s.status === 'cancelled') && new Date(s.renews) > new Date()) ? 'awal' : null; o.plan_status = s ? s.status : null; o.plan_renews = s ? s.renews : null;
  }
  return o;
}
function slugify(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'item'; }
function priceOf(p) { return p.type === 'livestock' ? p.price : p.price; } // both stored in `price`
function addrBody(b) { return { label: str(b.label, 40), name: str(b.name, 80), phone: str(b.phone, 30), line1: str(b.line1, 200), line2: str(b.line2, 200), city: str(b.city, 80), governorate: str(b.governorate, 80), notes: str(b.notes, 300) }; }

/* ---- API ---- */
async function api(req, res, url) {
  const seg = url.pathname.split('/').filter(Boolean).slice(1); // after 'api'
  const m = req.method;
  const me = currentUser(req);

  /* ---------- seo-runtime (hub integration) ---------- */
  if (seg[0] === 'seo' || (seg[0] === 'articles' && seg.length === 1)) {
    const { bearerOf, timingSafeSecret, readConfig } = seo.core;
    if (seg[0] === 'articles') {
      if (m !== 'POST') return json(res, 404, { error: 'not found' });
      if (!timingSafeSecret(bearerOf(req.headers.authorization), readConfig().secret)) return json(res, 401, { error: 'unauthorized' });
      const body = await readBody(req);
      const settings = (await seo.store.getSettings()) ?? seo.core.EMPTY_SETTINGS;
      const out = await seo.core.ingestArticles(seo.store, body, {
        supported: ['ar', 'en'],
        urlFor: (lang, slug) => seo.core.absoluteUrl(settings, lang, `/${lang}/blog/${slug}`),
      });
      return json(res, out.status, out.body);
    }
    // GET /sitemap.xml and /robots.txt above are this site's own — the runtime's routes are
    // only mounted under /api/seo, so there is no collision to resolve there.
    if (!timingSafeSecret(bearerOf(req.headers.authorization), readConfig().secret)) return json(res, 401, { error: 'unauthorized' });
    if (m === 'GET' && seg[1] === 'health') return json(res, 200, await seo.core.healthPayload(seo.store, seo.version, readConfig().slug));
    if (m === 'POST' && seg[1] === 'sync') {
      const body = await readBody(req);
      const result = await seo.core.applySnapshot(seo.store, body);
      return json(res, result.status === 'invalid' ? 400 : 200, result);
    }
    if (m === 'GET' && seg[1] === 'pages') return json(res, 200, { pages: [] });
    if (m === 'GET' && seg[1] === 'pending') { const out = await seo.core.proxyPending(seo.store); return json(res, out.status, out.body); }
    if (m === 'POST' && ['approve', 'reject', 'publish-now'].includes(seg[1])) {
      const body = await readBody(req);
      const out = await seo.core.proxyApprovalAction(seo.store, seg[1], String(body.jobId || ''), { approvedBy: String(body.approvedBy || ''), note: body.note });
      return json(res, out.status, out.body);
    }
    return json(res, 404, { error: 'not found' });
  }

  /* ---------- auth ---------- */
  if (seg[0] === 'auth') {
    if (m === 'GET' && seg[1] === 'me') return json(res, 200, { user: publicUser(me) });
    if (m === 'POST' && seg[1] === 'logout') {
      const tok = auth.parseCookies(req.headers.cookie)[auth.SESSION_COOKIE]; if (tok) q.deleteSession(tok);
      return json(res, 200, { ok: true }, { 'set-cookie': auth.clearCookie() });
    }
    if (m === 'POST' && seg[1] === 'signup') {
      const b = await readBody(req);
      const name = str(b.name, 80), email = str(b.email, 160).toLowerCase(), phone = str(b.phone, 30), pw = str(b.password, 200);
      if (!name || !isEmail(email) || pw.length < 6) return json(res, 400, { error: 'Name, a valid email and a password of 6+ characters are required' });
      if (q.userByEmail(email)) return json(res, 409, { error: 'An account with that email already exists' });
      const u = q.createUser({ role: 'customer', name, email, phone, pass_hash: auth.hashPassword(pw) });
      const tok = auth.randomToken(); q.createSession(tok, u.id);
      return json(res, 201, { user: publicUser(u) }, { 'set-cookie': auth.sessionCookie(tok) });
    }
    if (m === 'POST' && seg[1] === 'vendor-signup') {
      const b = await readBody(req);
      const email = str(b.email, 160).toLowerCase(), pw = str(b.password, 200), name = str(b.name, 80);
      const app = q.approvedApplicationByEmail(email);
      if (!app) return json(res, 403, { error: 'No approved vendor application found for this email. Apply first and wait for approval.' });
      if (q.userByEmail(email)) return json(res, 409, { error: 'An account with that email already exists — just log in.' });
      if (pw.length < 6) return json(res, 400, { error: 'Password must be at least 6 characters' });
      const u = q.createUser({ role: 'vendor', name: name || app.contact_name, email, phone: app.phone, pass_hash: auth.hashPassword(pw), vendor_id: app.vendor_id });
      const tok = auth.randomToken(); q.createSession(tok, u.id);
      return json(res, 201, { user: publicUser(u) }, { 'set-cookie': auth.sessionCookie(tok) });
    }
    if (m === 'POST' && seg[1] === 'login') {
      const b = await readBody(req);
      const email = str(b.email, 160).toLowerCase(), pw = str(b.password, 200);
      const u = q.userByEmail(email);
      if (!u || !auth.verifyPassword(pw, u.pass_hash)) return json(res, 401, { error: 'Wrong email or password' });
      if (u.suspended) return json(res, 403, { error: 'This account has been suspended. Please contact support.' });
      const tok = auth.randomToken(); q.createSession(tok, u.id);
      return json(res, 200, { user: publicUser(u) }, { 'set-cookie': auth.sessionCookie(tok) });
    }
    return json(res, 404, { error: 'unknown auth route' });
  }

  /* ---------- vendor applications (public create) ---------- */
  if (m === 'POST' && seg[0] === 'applications') {
    const b = await readBody(req);
    const a = { farm_name: str(b.farm_name, 120), contact_name: str(b.contact_name, 80), email: str(b.email, 160), phone: str(b.phone, 30), location: str(b.location, 120), categories: str(b.categories, 200), message: str(b.message, 1000) };
    if (!a.farm_name || !a.contact_name || !isEmail(a.email) || !a.phone) return json(res, 400, { error: 'Farm name, contact name, a valid email and phone are required' });
    q.createApplication(a);
    return json(res, 201, { ok: true });
  }

  /* ---------- products (public) ---------- */
  if (m === 'GET' && seg[0] === 'products' && seg.length === 1)
    return json(res, 200, q.products({ category: url.searchParams.get('category'), vendor: url.searchParams.get('vendor'), type: url.searchParams.get('type'), q: url.searchParams.get('q') }));
  if (m === 'GET' && seg[0] === 'products' && seg[1] && seg.length === 2) {
    const p = q.product(seg[1]); if (!p) return json(res, 404, { error: 'Product not found' });
    return json(res, 200, { product: p, vendor: q.vendor(p.vendor_id), summary: q.productReviewSummary(p.id) });
  }
  if (m === 'GET' && seg[0] === 'products' && seg[2] === 'reviews') {
    const rating = parseInt(url.searchParams.get('rating'), 10);
    return json(res, 200, { summary: q.productReviewSummary(seg[1]), reviews: q.productReviews(seg[1], rating >= 1 && rating <= 5 ? rating : null, url.searchParams.get('sort') || 'recent') });
  }
  if (m === 'POST' && seg[0] === 'products' && seg[2] === 'reviews') {
    if (!q.productExists(seg[1])) return json(res, 404, { error: 'Product not found' });
    const b = await readBody(req); const rating = parseInt(b.rating, 10);
    const r = { product_id: seg[1], user_id: me ? me.id : null, name: str(b.name, 60) || (me && me.name) || 'Anonymous', rating, title: str(b.title, 120), body: str(b.body, 2000) };
    if (!r.title || !r.body || !(rating >= 1 && rating <= 5)) return json(res, 400, { error: 'A title, some text and a 1–5 rating are required' });
    return json(res, 201, q.addReview(r));
  }
  if (m === 'POST' && seg[0] === 'reviews' && seg[2] === 'helpful') {
    const n = q.helpful(parseInt(seg[1], 10)); return n === null ? json(res, 404, { error: 'not found' }) : json(res, 200, { helpful: n });
  }
  if (m === 'GET' && seg[0] === 'reviews') return json(res, 200, q.recentReviews(6));
  if (m === 'GET' && seg[0] === 'faqs') return json(res, 200, q.faqs());
  if (m === 'GET' && seg[0] === 'pages' && seg.length === 1) return json(res, 200, q.pages());
  if (m === 'GET' && seg[0] === 'pages' && seg[1]) { const p = q.page(seg[1]); return p ? json(res, 200, p) : json(res, 404, { error: 'Page not found' }); }
  if (m === 'GET' && seg[0] === 'vendors' && seg.length === 1) return json(res, 200, q.vendors());
  if (m === 'GET' && seg[0] === 'vendors' && seg[1]) {
    const v = q.vendorBySlug(seg[1]); if (!v) return json(res, 404, { error: 'not found' });
    return json(res, 200, { vendor: v, products: q.products({ vendor: v.slug }) });
  }

  /* ---------- vendor dashboard (role: vendor) ---------- */
  if (seg[0] === 'vendor') {
    if (!me || me.role !== 'vendor') return json(res, 403, { error: 'Vendor login required' });
    const vid = me.vendor_id;
    if (m === 'GET' && seg[1] === 'products') return json(res, 200, q.vendorProducts(vid));
    if (m === 'GET' && seg[1] === 'orders') return json(res, 200, q.vendorOrders(vid));
    if (m === 'GET' && seg[1] === 'overview') {
      const e = q.vendorEarnings(vid); const pu = publicUser(me);
      return json(res, 200, { products: q.vendorProducts(vid).length, orders: q.vendorOrders(vid).length, revenue: e.gross, net: e.net, commission: e.commission, pending: e.pending, plan: pu.plan, featured: pu.featured, status: pu.vendor_status });
    }
    if (m === 'GET' && seg[1] === 'earnings') return json(res, 200, { summary: q.vendorEarnings(vid), rows: q.vendorEarningRows(vid) });
    if (m === 'GET' && seg[1] === 'payouts') return json(res, 200, { summary: q.vendorEarnings(vid), payouts: q.payouts(vid), cadence: publicUser(me).plan === 'awal' ? 'Weekly (Awal)' : 'Standard (bi-weekly)' });
    if (m === 'GET' && seg[1] === 'analytics') return json(res, 200, Object.assign(q.vendorAnalytics(vid), { advanced: publicUser(me).plan === 'awal' }));
    if (m === 'GET' && seg[1] === 'profile') return json(res, 200, q.vendor(vid));
    if (m === 'PATCH' && seg[1] === 'profile') { const b = await readBody(req); return json(res, 200, q.updateVendorProfile(vid, { name: str(b.name, 120) || null, bio: str(b.bio, 1000) != null ? str(b.bio, 1000) : null, location: str(b.location, 120) || null })); }
    if (m === 'POST' && seg[1] === 'password') {
      const b = await readBody(req); if (!auth.verifyPassword(str(b.current, 200), me.pass_hash)) return json(res, 400, { error: 'Current password is incorrect' });
      if (str(b.password, 200).length < 6) return json(res, 400, { error: 'New password must be at least 6 characters' });
      q.setPassword(me.id, auth.hashPassword(str(b.password, 200))); return json(res, 200, { ok: true });
    }
    if (m === 'POST' && seg[1] === 'orders' && seg[3] === 'fulfill') {
      const o = q.order(seg[2]); if (!o) return json(res, 404, { error: 'not found' });
      if (!o.items.some((i) => i.vendor_id === vid)) return json(res, 403, { error: 'Not your order' });
      const b = await readBody(req); const allowed = ['confirmed', 'packed', 'shipped', 'delivered'];
      if (!allowed.includes(b.status)) return json(res, 400, { error: 'Invalid status' });
      q.setFulfillment(o.id, b.status, 'Vendor: ' + (me.vendor_name || ''));
      if (o.user_id) q.notify(o.user_id, 'order', 'Order ' + o.id + ' is now ' + b.status, 'account.html#orders');
      return json(res, 200, { ok: true });
    }
    if (m === 'POST' && seg[1] === 'products') {
      const b = await readBody(req); const built = buildProduct(b, vid); if (built.error) return json(res, 400, built);
      let id = slugify(built.name); let n = 1; while (q.productExists(id)) { id = slugify(built.name) + '-' + (++n); }
      built.id = id; return json(res, 201, q.createProduct(built));
    }
    if (m === 'PATCH' && seg[1] === 'products' && seg[2]) {
      const b = await readBody(req); const built = buildProduct(b, vid); if (built.error) return json(res, 400, built);
      const upd = q.updateProduct(seg[2], vid, built); return upd ? json(res, 200, upd) : json(res, 404, { error: 'Product not found' });
    }
    if (m === 'DELETE' && seg[1] === 'products' && seg[2]) { q.deleteProduct(seg[2], vid); return json(res, 200, { ok: true }); }
    return json(res, 404, { error: 'unknown vendor route' });
  }

  /* ---------- admin (role: admin) ---------- */
  if (seg[0] === 'admin') {
    if (!me || me.role !== 'admin') return json(res, 403, { error: 'Admin login required' });
    if (m === 'GET' && seg[1] === 'overview') return json(res, 200, q.counts());
    if (m === 'GET' && seg[1] === 'applications') return json(res, 200, q.applications(url.searchParams.get('status')));
    if (m === 'GET' && seg[1] === 'orders' && seg.length === 2) return json(res, 200, q.adminOrders({ status: url.searchParams.get('status'), fulfillment: url.searchParams.get('fulfillment'), q: url.searchParams.get('q') }));
    if (m === 'GET' && seg[1] === 'orders' && seg[2] && seg.length === 3) { const o = q.adminOrder(seg[2]); return o ? json(res, 200, o) : json(res, 404, { error: 'not found' }); }
    if (m === 'POST' && seg[1] === 'orders' && seg[3] === 'fulfill') { const b = await readBody(req); const o = q.order(seg[2]); if (!o) return json(res, 404, { error: 'not found' }); q.setFulfillment(seg[2], str(b.status, 20), 'Admin'); if (o.user_id) q.notify(o.user_id, 'order', 'Order ' + seg[2] + ' update: ' + str(b.status, 20), 'account.html#orders'); return json(res, 200, q.adminOrder(seg[2])); }
    if (m === 'POST' && seg[1] === 'orders' && seg[3] === 'refund') { const o = q.order(seg[2]); if (!o) return json(res, 404, { error: 'not found' }); q.refundOrder(seg[2], o.total); if (o.user_id) q.notify(o.user_id, 'order', 'Order ' + seg[2] + ' was refunded', 'account.html#orders'); return json(res, 200, q.adminOrder(seg[2])); }
    if (m === 'POST' && seg[1] === 'orders' && seg[3] === 'cancel') { const o = q.order(seg[2]); if (!o) return json(res, 404, { error: 'not found' }); q.setOrderStatus(seg[2], 'cancelled', null, null); q.setFulfillment(seg[2], 'cancelled', 'Admin cancelled'); if (o.user_id) q.notify(o.user_id, 'order', 'Order ' + seg[2] + ' was cancelled', 'account.html#orders'); return json(res, 200, q.adminOrder(seg[2])); }
    if (m === 'GET' && seg[1] === 'customers' && seg.length === 2) return json(res, 200, q.adminCustomers());
    if (m === 'GET' && seg[1] === 'customers' && seg[2]) { const c = q.adminCustomer(parseInt(seg[2], 10)); return c ? json(res, 200, c) : json(res, 404, { error: 'not found' }); }
    if (m === 'PATCH' && seg[1] === 'customers' && seg[2]) { const b = await readBody(req); const c = q.setCustomerAdmin(parseInt(seg[2], 10), b); return c ? json(res, 200, c) : json(res, 404, { error: 'not found' }); }
    if (m === 'GET' && seg[1] === 'vendors' && seg.length === 2) return json(res, 200, q.adminVendors());
    if (m === 'GET' && seg[1] === 'vendors' && seg[2]) { const v = q.adminVendorDetail(parseInt(seg[2], 10)); return v ? json(res, 200, v) : json(res, 404, { error: 'not found' }); }
    if (m === 'PATCH' && seg[1] === 'vendors' && seg[2]) { const b = await readBody(req); const v = q.setVendorAdmin(parseInt(seg[2], 10), b); return v ? json(res, 200, v) : json(res, 404, { error: 'not found' }); }
    if (m === 'GET' && seg[1] === 'catalog') return json(res, 200, q.adminCatalog({ q: url.searchParams.get('q'), vendor: url.searchParams.get('vendor'), status: url.searchParams.get('status') }));
    if (m === 'PATCH' && seg[1] === 'catalog' && seg[2]) { const b = await readBody(req); const p = q.setProductAdmin(seg[2], b); return p ? json(res, 200, p) : json(res, 404, { error: 'not found' }); }
    if (m === 'DELETE' && seg[1] === 'catalog' && seg[2]) { q.adminDeleteProduct(seg[2]); return json(res, 200, { ok: true }); }
    if (m === 'GET' && seg[1] === 'payouts') return json(res, 200, { pending: q.pendingBalances(), history: q.allPayouts() });
    if (m === 'POST' && seg[1] === 'payouts' && seg[2] === 'create') { const b = await readBody(req); const p = q.createPayout(parseInt(b.vendor_id, 10), str(b.note, 200)); return p ? json(res, 200, p) : json(res, 400, { error: 'No pending balance for this vendor' }); }
    if (m === 'POST' && seg[1] === 'payouts' && seg[3] === 'settle') return json(res, 200, q.settlePayout(parseInt(seg[2], 10)));
    if (m === 'GET' && seg[1] === 'subscriptions') return json(res, 200, q.allSubscriptions());
    if (m === 'GET' && seg[1] === 'coupons') return json(res, 200, q.coupons());
    if (m === 'POST' && seg[1] === 'coupons' && seg[2] === 'toggle') { const b = await readBody(req); return json(res, 200, q.setCouponActive(str(b.code, 40), b.active)); }
    if (m === 'POST' && seg[1] === 'coupons' && seg.length === 2) { const b = await readBody(req); if (!str(b.code, 40)) return json(res, 400, { error: 'A code is required' }); return json(res, 201, q.createCoupon({ code: str(b.code, 40), kind: b.kind, value: parseInt(b.value, 10) || 0, min_order: parseInt(b.min_order, 10) || 0, expires: b.expires || null, usage_limit: b.usage_limit ? parseInt(b.usage_limit, 10) : null })); }
    if (m === 'GET' && seg[1] === 'settings') return json(res, 200, q.settingsAll());
    if (m === 'PATCH' && seg[1] === 'settings') { const b = await readBody(req); Object.keys(b).forEach((k) => q.setSetting(k, b[k])); return json(res, 200, q.settingsAll()); }
    if (m === 'GET' && seg[1] === 'pages' && seg.length === 2) return json(res, 200, q.pages());
    if (m === 'GET' && seg[1] === 'pages' && seg[2]) { const p = q.page(seg[2]); return p ? json(res, 200, p) : json(res, 404, { error: 'not found' }); }
    if (m === 'PATCH' && seg[1] === 'pages' && seg[2]) { const b = await readBody(req); const p = q.updatePage(seg[2], { title: b.title != null ? str(b.title, 160) : null, body: typeof b.body === 'string' ? b.body.slice(0, 60000) : null }); return p ? json(res, 200, p) : json(res, 404, { error: 'not found' }); }
    if (m === 'POST' && seg[1] === 'applications' && seg[3] === 'approve') {
      const appn = q.application(parseInt(seg[2], 10)); if (!appn) return json(res, 404, { error: 'not found' });
      if (appn.status === 'approved') return json(res, 200, appn);
      let slug = slugify(appn.farm_name); let n = 1; while (q.vendorBySlug(slug)) { slug = slugify(appn.farm_name) + '-' + (++n); }
      const v = q.createVendor({ slug, name: appn.farm_name, location: appn.location, bio: appn.message });
      return json(res, 200, q.decideApplication(appn.id, 'approved', v.id));
    }
    if (m === 'POST' && seg[1] === 'applications' && seg[3] === 'reject') {
      const appn = q.application(parseInt(seg[2], 10)); if (!appn) return json(res, 404, { error: 'not found' });
      return json(res, 200, q.decideApplication(appn.id, 'rejected', null));
    }
    return json(res, 404, { error: 'unknown admin route' });
  }

  /* ---------- account (role: any logged-in) ---------- */
  if (seg[0] === 'account') {
    if (!me) return json(res, 401, { error: 'Login required' });
    if (m === 'GET' && seg[1] === 'orders' && seg.length === 2) return json(res, 200, q.userOrders(me.id));
    if (m === 'GET' && seg[1] === 'orders' && seg[2] && seg.length === 3) { const o = q.order(seg[2]); if (!o || o.user_id !== me.id) return json(res, 404, { error: 'Order not found' }); return json(res, 200, o); }
    if (m === 'POST' && seg[1] === 'orders' && seg[3] === 'reorder') { const o = q.order(seg[2]); if (!o || o.user_id !== me.id) return json(res, 404, { error: 'Order not found' }); return json(res, 200, { items: o.items.map((i) => ({ id: i.product_id, qty: i.qty })) }); }
    if (m === 'GET' && seg[1] === 'profile') return json(res, 200, publicUser(me));
    if (m === 'PATCH' && seg[1] === 'profile') { const b = await readBody(req); q.updateProfile(me.id, { name: str(b.name, 80) || null, phone: str(b.phone, 30) || null }); return json(res, 200, publicUser(q.userById(me.id))); }
    if (m === 'POST' && seg[1] === 'password') {
      const b = await readBody(req); const cur = str(b.current, 200), nw = str(b.password, 200);
      if (!auth.verifyPassword(cur, me.pass_hash)) return json(res, 400, { error: 'Current password is incorrect' });
      if (nw.length < 6) return json(res, 400, { error: 'New password must be at least 6 characters' });
      q.setPassword(me.id, auth.hashPassword(nw)); return json(res, 200, { ok: true });
    }
    if (seg[1] === 'addresses') {
      if (m === 'GET' && seg.length === 2) return json(res, 200, q.addresses(me.id));
      if (m === 'POST' && seg.length === 2) { const b = await readBody(req); if (!str(b.line1, 200)) return json(res, 400, { error: 'Street address is required' }); return json(res, 201, q.createAddress(me.id, addrBody(b))); }
      const aid = parseInt(seg[2], 10);
      if (m === 'PATCH' && seg[3] === 'default') { const r = q.setDefaultAddress(aid, me.id); return r ? json(res, 200, r) : json(res, 404, { error: 'not found' }); }
      if (m === 'PATCH') { const b = await readBody(req); const r = q.updateAddress(aid, me.id, addrBody(b)); return r ? json(res, 200, r) : json(res, 404, { error: 'not found' }); }
      if (m === 'DELETE') { q.deleteAddress(aid, me.id); return json(res, 200, { ok: true }); }
    }
    if (seg[1] === 'payment-methods') {
      if (m === 'GET' && seg.length === 2) return json(res, 200, q.paymentMethods(me.id));
      if (m === 'POST' && seg.length === 2) {
        const b = await readBody(req);
        const last4 = String(b.last4 || '').replace(/\D/g, '').slice(-4);
        if (last4.length !== 4) return json(res, 400, { error: 'Enter the last 4 digits of your card only' });
        // SECURITY: we never accept or store a full card number (PAN) — only a tokenized reference.
        const token = 'tok_' + crypto.randomBytes(8).toString('hex');
        q.createPaymentMethod(me.id, { brand: str(b.brand, 20) || 'Card', last4, token, exp_month: parseInt(b.exp_month, 10) || null, exp_year: parseInt(b.exp_year, 10) || null });
        return json(res, 201, q.paymentMethods(me.id));
      }
      const pid = parseInt(seg[2], 10);
      if (m === 'PATCH' && seg[3] === 'default') return json(res, 200, q.setDefaultPaymentMethod(pid, me.id));
      if (m === 'DELETE') { q.deletePaymentMethod(pid, me.id); return json(res, 200, { ok: true }); }
    }
    return json(res, 404, { error: 'unknown account route' });
  }

  /* ---------- subscriptions (Lahmetna One / Awal) ---------- */
  if (seg[0] === 'subscriptions') {
    if (!me) return json(res, 401, { error: 'Login required' });
    const type = me.role === 'vendor' ? 'vendor' : 'customer';
    const sid = type === 'vendor' ? me.vendor_id : me.id;
    const plan = type === 'vendor' ? 'awal' : 'one';
    const price = q.settingNum(type === 'vendor' ? 'awal_price' : 'one_price', type === 'vendor' ? 499 : 99);
    if (m === 'GET' && seg.length === 1) { const s = q.subscription(type, sid); return json(res, 200, { plan, price, subscription: s, payments: s ? q.subscriptionPayments(s.id) : [] }); }
    if (m === 'POST' && seg[1] === 'subscribe') {
      if (type === 'vendor' && !me.vendor_id) return json(res, 403, { error: 'Vendor account required' });
      // Simulated monthly billing via PayTabs — in test/mock mode the charge completes instantly.
      const ref = 'SUB-' + crypto.randomBytes(4).toString('hex').toUpperCase();
      const sub = q.startSubscription(type, sid, plan, price, ref);
      q.notify(me.id, 'subscription', (plan === 'awal' ? 'Lahmetna Awal' : 'Lahmetna One') + ' is now active', type === 'vendor' ? 'vendor.html#awal' : 'account.html#one');
      return json(res, 200, { ok: true, subscription: sub });
    }
    if (m === 'POST' && seg[1] === 'cancel') return json(res, 200, { ok: true, subscription: q.cancelSubscription(type, sid) });
    return json(res, 404, { error: 'unknown subscription route' });
  }

  /* ---------- support tickets (customer + vendor + admin) ---------- */
  if (seg[0] === 'tickets') {
    if (!me) return json(res, 401, { error: 'Login required' });
    if (m === 'GET' && seg.length === 1) {
      if (me.role === 'admin') return json(res, 200, q.adminTickets({ status: url.searchParams.get('status'), priority: url.searchParams.get('priority') }));
      return json(res, 200, q.userTickets(me.id));
    }
    if (m === 'POST' && seg.length === 1) {
      const b = await readBody(req); const subject = str(b.subject, 160);
      if (!subject) return json(res, 400, { error: 'A subject is required' });
      const priority = q.activeSubscription('customer', me.id) ? 'high' : 'normal';
      const t = q.createTicket(me.id, me.role, { subject, category: str(b.category, 40), order_id: str(b.order_id, 20) || null, priority, body: str(b.body, 4000) });
      return json(res, 201, t);
    }
    const tid = parseInt(seg[1], 10); const t = q.ticket(tid);
    if (!t) return json(res, 404, { error: 'Ticket not found' });
    if (me.role !== 'admin' && t.user_id !== me.id) return json(res, 403, { error: 'Not your ticket' });
    if (m === 'GET' && seg.length === 2) return json(res, 200, t);
    if (m === 'POST' && seg[2] === 'messages') {
      const b = await readBody(req); const body = str(b.body, 4000); if (!body) return json(res, 400, { error: 'Message cannot be empty' });
      const upd = q.addTicketMessage(tid, me.id, me.role, body);
      if (me.role === 'admin' && t.user_id) q.notify(t.user_id, 'ticket', 'Support replied to "' + t.subject + '"', (t.role === 'vendor' ? 'vendor.html#support' : 'account.html#support'));
      return json(res, 200, upd);
    }
    if (m === 'POST' && seg[2] === 'status' && me.role === 'admin') { const b = await readBody(req); return json(res, 200, q.setTicketStatus(tid, str(b.status, 20) || 'open')); }
    if (m === 'POST' && seg[2] === 'priority' && me.role === 'admin') { const b = await readBody(req); return json(res, 200, q.setTicketPriority(tid, b.priority === 'high' ? 'high' : 'normal')); }
    if (m === 'POST' && seg[2] === 'close') return json(res, 200, q.setTicketStatus(tid, 'closed'));
    return json(res, 404, { error: 'unknown ticket route' });
  }

  /* ---------- notifications ---------- */
  if (seg[0] === 'notifications') {
    if (!me) return json(res, 401, { error: 'Login required' });
    if (m === 'GET') return json(res, 200, { items: q.notifications(me.id), unread: q.unreadCount(me.id) });
    if (m === 'POST' && seg[1] === 'read') { q.markNotificationsRead(me.id); return json(res, 200, { ok: true }); }
    return json(res, 404, { error: 'unknown notifications route' });
  }

  /* ---------- coupon validation (checkout preview) ---------- */
  if (m === 'POST' && seg[0] === 'coupon' && seg[1] === 'validate') {
    const b = await readBody(req); const r = q.validateCoupon(str(b.code, 40), parseInt(b.subtotal, 10) || 0);
    return r.error ? json(res, 400, r) : json(res, 200, r);
  }

  /* ---------- orders / checkout ---------- */
  if (m === 'POST' && seg[0] === 'orders' && seg.length === 1) {
    if (!me) return json(res, 401, { error: 'Please log in to place an order' });
    if (me.suspended) return json(res, 403, { error: 'This account is suspended. Contact support.' });
    const b = await readBody(req);
    if (!Array.isArray(b.items) || !b.items.length) return json(res, 400, { error: 'Your cart is empty' });

    const DELIVERY_FEE = q.settingNum('delivery_fee', 60), FREE_OVER = q.settingNum('free_over', 800), SLAUGHTER_FEE = q.settingNum('slaughter_fee', 150);
    const stdRate = q.settingNum('commission_rate', 0.12), awalRate = q.settingNum('awal_commission_rate', 0.08);

    let subtotal = 0, hasLivestock = false; const items = []; const rateCache = {};
    for (const it of b.items) {
      const p = q.product(str(it.id, 40)); const qty = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 0));
      if (!p) return json(res, 400, { error: 'Unknown product: ' + str(it.id, 40) });
      if (p.type === 'livestock') hasLivestock = true;
      const line = priceOf(p) * qty; subtotal += line;
      if (rateCache[p.vendor_id] == null) {
        const v = q.vendor(p.vendor_id);
        rateCache[p.vendor_id] = (v && v.commission_rate != null) ? v.commission_rate : (q.activeSubscription('vendor', p.vendor_id) ? awalRate : stdRate);
      }
      const cr = rateCache[p.vendor_id], commission = Math.round(line * cr);
      items.push({ product_id: p.id, vendor_id: p.vendor_id, name: p.name, unit_price: priceOf(p), qty, line_total: line, commission_rate: cr, commission, net: line - commission });
    }

    // Lahmetna One member benefits + coupon
    const member = q.activeSubscription('customer', me.id);
    let discount = 0;
    if (member && member.plan === 'one') discount += Math.round(subtotal * q.settingNum('member_discount', 0.07));
    let couponCode = null;
    if (b.coupon) { const c = q.validateCoupon(b.coupon, subtotal); if (c.error) return json(res, 400, { error: c.error }); discount += c.discount; couponCode = c.code; }
    if (discount > subtotal) discount = subtotal;

    const slaughter = hasLivestock && !!b.slaughter;
    const freeThreshold = (member && member.plan === 'one') ? q.settingNum('member_free_delivery_over', 450) : FREE_OVER;
    const delivery = (subtotal - discount) >= freeThreshold ? 0 : DELIVERY_FEE;
    const total = (subtotal - discount) + delivery + (slaughter ? SLAUGHTER_FEE : 0);
    const method = b.method === 'cod' ? 'cod' : 'paytabs';
    const order = { id: 'LH-' + crypto.randomBytes(3).toString('hex').toUpperCase(), user_id: me.id, subtotal, discount, delivery: delivery + (slaughter ? SLAUGHTER_FEE : 0), total, coupon_code: couponCode, name: str(b.name, 80), phone: str(b.phone, 30), address: str(b.address, 300), method, slaughter };
    if (!order.name || !order.phone || !order.address) return json(res, 400, { error: 'Name, phone and delivery address are required' });
    q.createOrder(order, items);
    if (couponCode) q.redeemCoupon(couponCode);
    if (method === 'cod') { q.setOrderStatus(order.id, 'placed', null, 'cod'); return json(res, 201, { orderId: order.id, method: 'cod', total, discount }); }
    return json(res, 201, { orderId: order.id, method: 'paytabs', total, discount });
  }
  if (m === 'POST' && seg[0] === 'checkout' && seg[2] === 'pay') {
    if (!me) return json(res, 401, { error: 'Login required' });
    const order = q.order(seg[1]); if (!order || order.user_id !== me.id) return json(res, 404, { error: 'Order not found' });
    order.email = me.email;
    try { const pay = await paytabs.createPayment(order, baseUrl(req)); if (pay.tran_ref) q.setOrderStatus(order.id, 'pending', pay.tran_ref, 'paytabs'); return json(res, 200, { redirect_url: pay.redirect_url, mock: !!pay.mock }); }
    catch (e) { return json(res, 502, { error: 'Payment gateway error: ' + e.message }); }
  }
  // mock gateway completion
  if (m === 'POST' && seg[0] === 'pay' && seg[1] === 'mock' && seg[2]) {
    const b = await readBody(req); const order = q.order(seg[2]); if (!order) return json(res, 404, { error: 'Order not found' });
    if (b.result === 'success') { q.setOrderStatus(order.id, 'paid', 'MOCK-' + crypto.randomBytes(4).toString('hex'), 'paytabs'); return json(res, 200, { ok: true, redirect: '/order-confirmation.html?order=' + order.id }); }
    q.setOrderStatus(order.id, 'failed', null, 'paytabs'); return json(res, 200, { ok: false, redirect: '/checkout.html?failed=1' });
  }
  // real PayTabs server-to-server callback
  if (m === 'POST' && seg[0] === 'paytabs' && seg[1] === 'callback') {
    const b = await readBody(req);
    try { const v = await paytabs.verify(b.tran_ref); const cartId = b.cart_id || v.cart_id; if (cartId) q.setOrderStatus(cartId, v.paid ? 'paid' : 'failed', b.tran_ref, 'paytabs'); } catch (e) {}
    return json(res, 200, { ok: true });
  }
  if (seg[0] === 'paytabs' && seg[1] === 'return') {
    const b = m === 'POST' ? await readBody(req) : {};
    const tranRef = b.tranRef || b.tran_ref || url.searchParams.get('tranRef') || url.searchParams.get('tran_ref');
    const cartId = b.cartId || b.cart_id || url.searchParams.get('cartId') || url.searchParams.get('cart_id') || '';
    try { const v = await paytabs.verify(tranRef); if (cartId) q.setOrderStatus(cartId, v.paid ? 'paid' : 'failed', tranRef, 'paytabs'); } catch (e) {}
    res.writeHead(302, { location: '/order-confirmation.html?order=' + encodeURIComponent(cartId) }); return res.end();
  }
  if (m === 'GET' && seg[0] === 'orders' && seg[1]) {
    const o = q.order(seg[1]); if (!o) return json(res, 404, { error: 'not found' });
    if (!me || (me.role !== 'admin' && o.user_id !== me.id)) return json(res, 403, { error: 'Not your order' });
    return json(res, 200, o);
  }

  if (m === 'POST' && seg[0] === 'newsletter') {
    const b = await readBody(req); const email = str(b.email, 160).toLowerCase();
    if (!isEmail(email)) return json(res, 400, { error: 'A valid email is required' });
    q.subscribe(email); return json(res, 200, { ok: true });
  }
  if (m === 'GET' && seg[0] === 'config') return json(res, 200, { paytabs: paytabs.configured() ? 'live' : 'test' });

  return json(res, 404, { error: 'unknown endpoint' });
}

/* build+validate a product payload from vendor input */
function buildProduct(b, vendorId) {
  const name = str(b.name, 120), cat = str(b.cat, 40), type = b.type === 'livestock' ? 'livestock' : 'packaged';
  const stock = Math.max(0, parseInt(b.stock, 10) || 0);
  if (!name || !cat) return { error: 'Name and category are required' };
  const o = { vendor_id: vendorId, name, cat, type, unit: str(b.unit, 20) || 'each', badge: str(b.badge, 30), stock, description: str(b.description, 1000), active: b.active === false ? 0 : 1 };
  if (type === 'livestock') {
    const ppk = parseInt(b.price_per_kg, 10), wk = parseFloat(b.weight_kg);
    if (!(ppk > 0) || !(wk > 0)) return { error: 'Livestock needs a price per kg and an estimated weight' };
    o.price_per_kg = ppk; o.weight_kg = wk; o.price = Math.round(ppk * wk); o.unit = 'kg';
  } else {
    const price = parseInt(b.price, 10);
    if (!(price > 0)) return { error: 'A valid price is required' };
    o.price = price; o.price_per_kg = null; o.weight_kg = null;
  }
  return o;
}

/* ---- SEO: sitemap.xml + robots.txt ---- */
const xmlEsc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
function sitemapXml(req) {
  const base = baseUrl(req);
  const today = new Date().toISOString().slice(0, 10);
  const urls = [{ loc: base + '/', lastmod: today, priority: '1.0' }, { loc: base + '/apply.html', lastmod: today, priority: '0.5' }];
  q.vendors().filter((v) => v.status === 'active').forEach((v) => urls.push({ loc: base + '/vendor.html?slug=' + encodeURIComponent(v.slug), lastmod: (v.created || today).slice(0, 10), priority: '0.6' }));
  q.products({}).forEach((p) => urls.push({ loc: base + '/product.html?id=' + encodeURIComponent(p.id), lastmod: (p.created || today).slice(0, 10), priority: '0.7' }));
  const body = urls.map((u) => '  <url><loc>' + xmlEsc(u.loc) + '</loc><lastmod>' + u.lastmod + '</lastmod><priority>' + u.priority + '</priority></url>').join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + '\n</urlset>\n';
}
function robotsTxt(req) {
  return [
    'User-agent: *', 'Allow: /', '',
    'User-agent: GPTBot', 'Allow: /', '',
    'User-agent: ClaudeBot', 'Allow: /', '',
    'User-agent: CCBot', 'Disallow: /', '',
    'User-agent: Bytespider', 'Disallow: /', '',
    'User-agent: meta-externalagent', 'Disallow: /', '',
    'User-agent: Amazonbot', 'Disallow: /', '',
    'Sitemap: ' + baseUrl(req) + '/sitemap.xml', '',
  ].join('\n');
}

/* ---- static (allowlisted, traversal-safe) ---- */
function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  if (rel.includes('/.') || rel.includes('..')) { res.writeHead(404); return res.end('Not found'); }
  const rootFile = /^\/[\w-]+\.(html|css|js|ico|webmanifest|png|jpg|jpeg|svg|webp)$/i.test(rel);
  if (!rootFile && !rel.startsWith('/assets/')) { res.writeHead(404); return res.end('Not found'); }
  const filePath = path.join(ROOT, rel);
  if (!filePath.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, async (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
    const ext = path.extname(filePath).toLowerCase();
    const cache = /\.(html|css|js|webmanifest)$/.test(ext) ? 'no-cache' : 'public, max-age=3600';
    // inject the request origin so social/SEO tags carry absolute URLs wherever deployed
    if (ext === '.html' && buf.includes('%%ORIGIN%%')) {
      buf = Buffer.from(String(buf).replaceAll('%%ORIGIN%%', baseUrl(req)));
    }
    if (ext === '.html') buf = await applyHubSeo(buf, url.pathname);
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': cache });
    res.end(buf);
  });
}

/* Hub SEO overrides (@omary98/seo-runtime-core): a non-empty hub title/description must win
   over this page's own static <title>/<meta description> — the site's own tag is only the
   fallback for when the hub has none. Applied to every static HTML response so admin overrides
   and title experiments actually take effect, not just to hand-picked pages. Canonical/OG/
   hreflang are untouched here — out of scope, and resolveSeo's own precedence already covers
   them elsewhere. */
async function applyHubSeo(buf, pathname) {
  let resolved;
  try { resolved = await seo.core.resolveSeo(seo.store, pathname, 'en'); } catch (e) { return buf; }
  if (!resolved.title && !resolved.description) return buf;
  let html = String(buf);
  if (resolved.title) html = html.replace(/<title>[\s\S]*?<\/title>/, '<title>' + xmlEsc(resolved.title) + '</title>');
  if (resolved.description) {
    const desc = '<meta name="description" content="' + xmlEsc(resolved.description) + '">';
    html = /<meta name="description"[^>]*>/.test(html) ? html.replace(/<meta name="description"[^>]*>/, desc) : html.replace('</title>', '</title>\n' + desc);
  }
  // Bridge for pages whose own JS computes a title after data loads (e.g. product.js) — let
  // them prefer the hub value too instead of unconditionally clobbering it back.
  const bridge = JSON.stringify({ title: resolved.title || '', description: resolved.description || '' }).replace(/</g, '\\u003c');
  html = html.replace('</head>', '<script>window.__HUB_SEO__=' + bridge + ';</script>\n</head>');
  return Buffer.from(html);
}

initSeo().then(() => {
  http.createServer(async (req, res) => {
    const url = new URL(req.url, baseUrl(req));
    try {
      // Hub-pushed redirects, ahead of any other dispatch — mirrors
      // packages/express/src/index.ts's redirect middleware. redirectFor itself unions /api and
      // /admin into whatever reservedPrefixes it's given, so calling it unconditionally here
      // (even for /api/* requests) is safe: it always returns null for those.
      const snapshot = await seo.store.getSnapshot().catch(() => null);
      const hit = await seo.core.redirectFor(seo.store, url.pathname, snapshot?.settings.reservedPrefixes);
      if (hit) { res.writeHead(hit.status, { location: hit.destination }); return res.end(); }

      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' });
      if (url.pathname === '/sitemap.xml') { res.writeHead(200, { 'content-type': 'application/xml; charset=utf-8' }); return res.end(sitemapXml(req)); }
      if (url.pathname === '/robots.txt') { res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }); return res.end(robotsTxt(req)); }
      serveStatic(req, res, url);
    } catch (e) {
      json(res, /bad body|too large/.test(e.message) ? 400 : 500, { error: e.message || 'server error' });
    }
  }).listen(PORT, () => console.log('Lahmetna running → http://localhost:' + PORT + '  (PayTabs: ' + (paytabs.configured() ? 'LIVE' : 'test/mock') + ')'));
}).catch((err) => {
  // A store that can't even initialize (e.g. an unwritable JsonFileStore path) means every
  // seo-runtime route would silently 500 forever; fail the whole process at boot instead of
  // limping along without the hub integration.
  console.error('[seo-runtime] failed to initialize:', err);
  process.exit(1);
});
