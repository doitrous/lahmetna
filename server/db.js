'use strict';
/* SQLite (node:sqlite) — schema, seeding, and all query helpers. */
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const seed = require('../data.js');
const { hashPassword } = require('./auth.js');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'lahmetna.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE, name TEXT, location TEXT, bio TEXT,
    status TEXT DEFAULT 'active', created TEXT
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT, name TEXT, email TEXT UNIQUE, phone TEXT,
    pass_hash TEXT, vendor_id INTEGER, created TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY, user_id INTEGER, created TEXT, expires TEXT
  );
  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT, farm_name TEXT, contact_name TEXT, email TEXT, phone TEXT,
    location TEXT, categories TEXT, message TEXT, status TEXT DEFAULT 'pending',
    vendor_id INTEGER, created TEXT, decided TEXT
  );
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY, vendor_id INTEGER, cat TEXT, type TEXT, name TEXT, unit TEXT,
    price INTEGER, price_per_kg INTEGER, weight_kg REAL, rating REAL DEFAULT 0, reviews INTEGER DEFAULT 0,
    badge TEXT, stock INTEGER DEFAULT 0, description TEXT, active INTEGER DEFAULT 1, sort INTEGER, created TEXT
  );
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT, product_id TEXT, user_id INTEGER, name TEXT, rating INTEGER,
    date TEXT, title TEXT, body TEXT, helpful INTEGER DEFAULT 0, verified INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, user_id INTEGER, created TEXT, status TEXT DEFAULT 'pending',
    subtotal INTEGER, delivery INTEGER, total INTEGER, name TEXT, phone TEXT, address TEXT,
    method TEXT, payment_ref TEXT, slaughter INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT, product_id TEXT, vendor_id INTEGER,
    name TEXT, unit_price INTEGER, qty INTEGER, line_total INTEGER
  );
  CREATE TABLE IF NOT EXISTS newsletter (email TEXT PRIMARY KEY, created TEXT);
  CREATE TABLE IF NOT EXISTS faqs (id INTEGER PRIMARY KEY AUTOINCREMENT, q TEXT, a TEXT, sort INTEGER);
`);

/* ---- extended schema: accounts, subscriptions, support, payouts, marketing, settings ---- */
db.exec(`
  CREATE TABLE IF NOT EXISTS addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, label TEXT, name TEXT, phone TEXT,
    line1 TEXT, line2 TEXT, city TEXT, governorate TEXT, notes TEXT, is_default INTEGER DEFAULT 0, created TEXT
  );
  CREATE TABLE IF NOT EXISTS payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, brand TEXT, last4 TEXT, token TEXT,
    exp_month INTEGER, exp_year INTEGER, is_default INTEGER DEFAULT 0, created TEXT
  );
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, subscriber_type TEXT, subscriber_id INTEGER, plan TEXT,
    status TEXT DEFAULT 'active', price INTEGER, started TEXT, renews TEXT, cancelled_at TEXT, payment_ref TEXT, created TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_subscriber ON subscriptions (subscriber_type, subscriber_id);
  CREATE TABLE IF NOT EXISTS subscription_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, subscription_id INTEGER, plan TEXT, amount INTEGER, ref TEXT, created TEXT
  );
  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, role TEXT, order_id TEXT, subject TEXT,
    category TEXT, status TEXT DEFAULT 'open', priority TEXT DEFAULT 'normal', created TEXT, updated TEXT
  );
  CREATE TABLE IF NOT EXISTS ticket_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER, author_id INTEGER, author_role TEXT, body TEXT, created TEXT
  );
  CREATE TABLE IF NOT EXISTS payouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, vendor_id INTEGER, amount INTEGER, status TEXT DEFAULT 'pending',
    period_start TEXT, period_end TEXT, note TEXT, created TEXT, paid_at TEXT
  );
  CREATE TABLE IF NOT EXISTS coupons (
    code TEXT PRIMARY KEY, kind TEXT, value INTEGER, min_order INTEGER DEFAULT 0, expires TEXT,
    usage_limit INTEGER, used INTEGER DEFAULT 0, active INTEGER DEFAULT 1, created TEXT
  );
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, type TEXT, body TEXT, link TEXT, read INTEGER DEFAULT 0, created TEXT
  );
  CREATE TABLE IF NOT EXISTS pages (
    slug TEXT PRIMARY KEY, title TEXT, body TEXT, sort INTEGER DEFAULT 0, updated TEXT
  );
`);

/* idempotent column migrations for tables that predate this build (ALTER throws if the column exists → ignore) */
function addCol(table, col, def) { try { db.exec('ALTER TABLE ' + table + ' ADD COLUMN ' + col + ' ' + def); } catch (e) { /* column already present */ } }
addCol('users', 'plan', 'TEXT');
addCol('users', 'plan_status', 'TEXT');
addCol('users', 'plan_renews', 'TEXT');
addCol('users', 'suspended', 'INTEGER DEFAULT 0');
addCol('users', 'default_address_id', 'INTEGER');
addCol('vendors', 'plan', 'TEXT');
addCol('vendors', 'plan_status', 'TEXT');
addCol('vendors', 'plan_renews', 'TEXT');
addCol('vendors', 'commission_rate', 'REAL');
addCol('vendors', 'featured', 'INTEGER DEFAULT 0');
addCol('vendors', 'logo', 'TEXT');
addCol('vendors', 'payout_cadence', 'TEXT');
addCol('orders', 'fulfillment', "TEXT DEFAULT 'processing'");
addCol('orders', 'discount', 'INTEGER DEFAULT 0');
addCol('orders', 'refund', 'INTEGER DEFAULT 0');
addCol('orders', 'coupon_code', 'TEXT');
addCol('orders', 'timeline', 'TEXT');
addCol('order_items', 'commission_rate', 'REAL');
addCol('order_items', 'commission', 'INTEGER');
addCol('order_items', 'net', 'INTEGER');
addCol('order_items', 'payout_id', 'INTEGER');

/* default platform settings (only inserted if missing) */
const DEFAULT_SETTINGS = {
  commission_rate: '0.12', awal_commission_rate: '0.08',
  one_price: '99', awal_price: '499', member_discount: '0.07',
  delivery_fee: '60', free_over: '800', member_free_delivery_over: '450', slaughter_fee: '150'
};
{
  const put = db.prepare('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)');
  Object.keys(DEFAULT_SETTINGS).forEach((k) => put.run(k, DEFAULT_SETTINGS[k]));
}

/* backfill commission/net on legacy order_items so vendor payouts are realistic */
{
  const rate = 0.12;
  const rows = db.prepare('SELECT id, line_total FROM order_items WHERE net IS NULL').all();
  const upd = db.prepare('UPDATE order_items SET commission_rate=?, commission=?, net=? WHERE id=?');
  rows.forEach((r) => { const c = Math.round(r.line_total * rate); upd.run(rate, c, r.line_total - c, r.id); });
}

/* ---------------- one-time seed ---------------- */
if (db.prepare('SELECT COUNT(*) n FROM products').get().n === 0) {
  const now = new Date().toISOString();
  const vslug = {};
  const iv = db.prepare('INSERT INTO vendors (slug,name,location,bio,status,created) VALUES (?,?,?,?,\'active\',?)');
  seed.vendors.forEach((v) => { const info = iv.run(v.slug, v.name, v.location, v.bio, now); vslug[v.slug] = info.lastInsertRowid; });

  const ip = db.prepare('INSERT INTO products (id,vendor_id,cat,type,name,unit,price,price_per_kg,weight_kg,rating,reviews,badge,stock,description,active,sort,created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)');
  seed.products.forEach((p, i) => ip.run(p.id, vslug[p.vendor], p.cat, p.type, p.name, p.unit, p.price, p.pricePerKg, p.weightKg, p.rating, p.reviews, p.badge || '', p.stock, p.desc, i, now));

  const ir = db.prepare('INSERT INTO reviews (product_id,user_id,name,rating,date,title,body,helpful,verified) VALUES (?,NULL,?,?,?,?,?,?,1)');
  seed.reviews.forEach((r) => ir.run(r.product, r.name, r.rating, r.date, r.title, r.body, r.helpful || 0));

  const iff = db.prepare('INSERT INTO faqs (q,a,sort) VALUES (?,?,?)');
  seed.faqs.forEach((f, i) => iff.run(f.q, f.a, i));

  // accounts: admin, a demo customer, and a demo approved vendor (Bonkam) for immediate testing
  const iu = db.prepare('INSERT INTO users (role,name,email,phone,pass_hash,vendor_id,created) VALUES (?,?,?,?,?,?,?)');
  iu.run('admin', seed.admin.name, seed.admin.email, '', hashPassword(seed.admin.password), null, now);
  iu.run('customer', 'Demo Customer', 'customer@lahmetna.com', '+20 100 000 0000', hashPassword('customer1234'), null, now);
  iu.run('vendor', 'Bonkam Farm', 'bonkam@lahmetna.com', '+20 100 111 1111', hashPassword('vendor1234'), vslug['bonkam'], now);
  iu.run('vendor', 'Nile Harvest', 'nileharvest@lahmetna.com', '+20 100 222 2222', hashPassword('vendor1234'), vslug['nileharvest'], now);
  // a pending application so the admin queue is testable
  db.prepare('INSERT INTO applications (farm_name,contact_name,email,phone,location,categories,message,status,created) VALUES (?,?,?,?,?,?,?,\'pending\',?)')
    .run('Green Valley Farm', 'Sara Nabil', 'greenvalley@example.com', '+20 122 333 4444', 'Ismailia', 'Vegetables, Fruit', 'We grow organic vegetables and citrus and would love to join Lahmetna.', now);

  console.log('[db] seeded', seed.products.length, 'products,', seed.vendors.length, 'vendors,', seed.reviews.length, 'reviews');
}

/* ---- demo data for the new features (only when their tables are empty) ---- */
{
  const seedNow = new Date().toISOString();
  const cust = db.prepare("SELECT id FROM users WHERE email='customer@lahmetna.com'").get();
  if (cust && db.prepare('SELECT COUNT(*) n FROM addresses').get().n === 0) {
    db.prepare('INSERT INTO addresses (user_id,label,name,phone,line1,line2,city,governorate,is_default,created) VALUES (?,?,?,?,?,?,?,?,1,?)')
      .run(cust.id, 'Home', 'Demo Customer', '+20 100 000 0000', '12 Nile View Street', 'Apartment 4', 'Maadi', 'Cairo', seedNow);
    db.prepare('UPDATE users SET default_address_id=(SELECT id FROM addresses WHERE user_id=? LIMIT 1) WHERE id=?').run(cust.id, cust.id);
  }
  if (db.prepare('SELECT COUNT(*) n FROM coupons').get().n === 0) {
    db.prepare("INSERT INTO coupons (code,kind,value,min_order,expires,usage_limit,used,active,created) VALUES ('WELCOME10','percent',10,300,NULL,NULL,0,1,?)").run(seedNow);
    db.prepare("INSERT INTO coupons (code,kind,value,min_order,expires,usage_limit,used,active,created) VALUES ('FRESH50','flat',50,500,NULL,NULL,0,1,?)").run(seedNow);
  }
  if (cust && db.prepare('SELECT COUNT(*) n FROM tickets').get().n === 0) {
    const t = db.prepare("INSERT INTO tickets (user_id,role,order_id,subject,category,status,priority,created,updated) VALUES (?,?,NULL,?,?,'open','normal',?,?)")
      .run(cust.id, 'customer', 'When do you deliver to Maadi?', 'Delivery', seedNow, seedNow);
    db.prepare('INSERT INTO ticket_messages (ticket_id,author_id,author_role,body,created) VALUES (?,?,?,?,?)')
      .run(t.lastInsertRowid, cust.id, 'customer', 'Hi! I would like to know the delivery windows for Maadi. Thanks!', seedNow);
  }
  // legal / policy pages — scaffolded templates ready for the admin to fill in
  if (db.prepare('SELECT COUNT(*) n FROM pages').get().n === 0) {
    const sec = (h, ...ps) => '<h2>' + h + '</h2>' + ps.map((p) => '<p>' + p + '</p>').join('');
    const intro = (name) => '<p class="lead">This ' + name + ' is a starting template for Lahmetna. Replace the bracketed placeholders and review with qualified legal counsel before publishing.</p>';
    const co = '[Company legal name]', addr = '[registered address]', email = '[legal@yourdomain.com]';
    const P = [
      ['terms', 'Terms & Conditions', 1,
        intro('Terms & Conditions document') +
        sec('1. About us', 'Lahmetna is operated by ' + co + ', registered at ' + addr + '. By using our website and services you agree to these Terms & Conditions.') +
        sec('2. Accounts', 'You are responsible for keeping your account details accurate and your password secure. You must be at least 18 years old to place an order.') +
        sec('3. Orders & pricing', 'All prices are shown in Egyptian Pounds (EGP) and include applicable taxes unless stated otherwise. We may refuse or cancel an order where an item is unavailable or a price is listed in error.') +
        sec('4. Vendors & the marketplace', 'Lahmetna is a marketplace connecting customers with independent partner farms and vendors. [Describe the respective responsibilities of Lahmetna and its vendors for the products sold.]') +
        sec('5. Delivery', 'Delivery terms are described in our Delivery & Cold-Chain policy. [Add delivery areas, windows and any conditions.]') +
        sec('6. Cancellations & refunds', 'Please see our Returns & Refunds policy. [Summarise cancellation rights for perishable goods and live animals.]') +
        sec('7. Liability', '[State the limitations of liability that apply, subject to Egyptian consumer-protection law.]') +
        sec('8. Governing law', 'These terms are governed by the laws of the Arab Republic of Egypt. [Confirm jurisdiction for disputes.]') +
        sec('9. Contact', 'Questions about these terms can be sent to ' + email + '.')],
      ['privacy', 'Privacy Policy', 2,
        intro('Privacy Policy') +
        sec('1. Who we are', co + ' (“Lahmetna”, “we”) is the data controller for personal data collected through this website.') +
        sec('2. Data we collect', 'Account details (name, email, phone), delivery addresses, order history, and payment references. [We never store full card numbers — only a tokenised reference, card brand and last four digits.]') +
        sec('3. How we use your data', 'To process orders and deliveries, provide customer support, operate memberships, prevent fraud, and — where you have consented — send you updates.') +
        sec('4. Sharing', 'We share the minimum necessary data with partner vendors and delivery providers to fulfil your orders, and with our payment processor. [List sub-processors.]') +
        sec('5. Your rights', 'You may request access to, correction of, or deletion of your personal data. [Describe how users exercise these rights and your response times.]') +
        sec('6. Retention & security', '[State how long data is kept and the safeguards in place.]') +
        sec('7. Contact', 'Privacy questions can be sent to ' + email + '.')],
      ['refunds', 'Returns & Refunds', 3,
        intro('Returns & Refunds policy') +
        sec('1. Fresh & perishable goods', '[Explain your approach to freshness guarantees and quality issues for meat, dairy and produce.]') +
        sec('2. Reporting a problem', 'Contact support within [X hours] of delivery with your order number and photos so we can investigate quickly.') +
        sec('3. Refunds & replacements', '[Describe when a refund, credit or replacement is offered and how long refunds take to appear.]') +
        sec('4. Live animals', '[State the specific terms that apply to live-animal orders and any slaughter/processing services.]') +
        sec('5. Contact', 'Start a return by opening a support request from your account or emailing ' + email + '.')],
      ['shipping', 'Delivery & Cold-Chain', 4,
        intro('Delivery & Cold-Chain policy') +
        sec('1. Delivery areas', 'We currently deliver across [Cairo & Giza]. [List governorates and any excluded zones.]') +
        sec('2. Delivery windows & fees', '[State delivery windows, standard fees, and free-delivery thresholds, including member benefits.]') +
        sec('3. Cold-chain handling', 'Orders are sealed, chilled and tracked end-to-end. [Describe packaging and temperature handling.]') +
        sec('4. Receiving your order', '[Explain what happens if no one is available to receive a chilled order.]')],
      ['cookies', 'Cookie Policy', 5,
        intro('Cookie Policy') +
        sec('1. What we use', 'We use strictly necessary cookies to keep you signed in and to remember your cart. [List any analytics or marketing cookies if added.]') +
        sec('2. Managing cookies', 'You can control cookies through your browser settings. [Describe any in-site consent controls.]')],
      ['halal', 'Halal Certification', 6,
        intro('Halal Certification statement') +
        sec('1. Our commitment', '[Describe your halal sourcing and slaughter standards.]') +
        sec('2. Certification', '[Name the certifying body and reference numbers, and how customers can verify them.]') +
        sec('3. Vendor requirements', '[State what partner farms must demonstrate to list halal products.]')]
    ];
    const ip = db.prepare('INSERT INTO pages (slug,title,body,sort,updated) VALUES (?,?,?,?,?)');
    P.forEach((x) => ip.run(x[0], x[1], x[3], x[2], seedNow));
  }
}

/* ---------------- queries ---------------- */
const productSelect = `SELECT p.*, v.name AS origin, v.slug AS vendor_slug FROM products p JOIN vendors v ON v.id=p.vendor_id`;
const nowISO = () => new Date().toISOString();
const addDays = (d) => new Date(Date.now() + d * 86400000).toISOString();
const q = {
  /* users / sessions */
  userByEmail: (e) => db.prepare('SELECT * FROM users WHERE email=?').get(String(e).toLowerCase()),
  userById: (id) => db.prepare('SELECT * FROM users WHERE id=?').get(id),
  createUser(u) {
    const info = db.prepare('INSERT INTO users (role,name,email,phone,pass_hash,vendor_id,created) VALUES (?,?,?,?,?,?,?)')
      .run(u.role, u.name, String(u.email).toLowerCase(), u.phone || '', u.pass_hash, u.vendor_id || null, new Date().toISOString());
    return q.userById(info.lastInsertRowid);
  },
  createSession(token, userId) {
    const created = new Date(); const expires = new Date(created.getTime() + 30 * 86400000);
    db.prepare('INSERT INTO sessions (token,user_id,created,expires) VALUES (?,?,?,?)').run(token, userId, created.toISOString(), expires.toISOString());
  },
  sessionUser(token) {
    if (!token) return null;
    const s = db.prepare('SELECT * FROM sessions WHERE token=?').get(token);
    if (!s) return null;
    if (new Date(s.expires) < new Date()) { db.prepare('DELETE FROM sessions WHERE token=?').run(token); return null; }
    return q.userById(s.user_id);
  },
  deleteSession: (token) => db.prepare('DELETE FROM sessions WHERE token=?').run(token),

  /* vendors */
  vendors: () => db.prepare('SELECT * FROM vendors ORDER BY name').all(),
  vendor: (id) => db.prepare('SELECT * FROM vendors WHERE id=?').get(id),
  vendorBySlug: (s) => db.prepare('SELECT * FROM vendors WHERE slug=?').get(s),
  createVendor(v) {
    const info = db.prepare('INSERT INTO vendors (slug,name,location,bio,status,created) VALUES (?,?,?,?,\'active\',?)')
      .run(v.slug, v.name, v.location || '', v.bio || '', new Date().toISOString());
    return q.vendor(info.lastInsertRowid);
  },

  /* applications */
  createApplication(a) {
    const info = db.prepare('INSERT INTO applications (farm_name,contact_name,email,phone,location,categories,message,status,created) VALUES (?,?,?,?,?,?,?,\'pending\',?)')
      .run(a.farm_name, a.contact_name, String(a.email).toLowerCase(), a.phone, a.location, a.categories, a.message || '', new Date().toISOString());
    return db.prepare('SELECT * FROM applications WHERE id=?').get(info.lastInsertRowid);
  },
  applications: (status) => status ? db.prepare('SELECT * FROM applications WHERE status=? ORDER BY created DESC').all(status) : db.prepare('SELECT * FROM applications ORDER BY created DESC').all(),
  application: (id) => db.prepare('SELECT * FROM applications WHERE id=?').get(id),
  approvedApplicationByEmail: (e) => db.prepare("SELECT * FROM applications WHERE email=? AND status='approved' AND vendor_id IS NOT NULL").get(String(e).toLowerCase()),
  decideApplication(id, status, vendorId) {
    db.prepare('UPDATE applications SET status=?, vendor_id=?, decided=? WHERE id=?').run(status, vendorId || null, new Date().toISOString(), id);
    return q.application(id);
  },

  /* products */
  products(f) {
    f = f || {}; const where = ['p.active=1']; const args = [];
    if (f.category && f.category !== 'all') { where.push('p.cat=?'); args.push(f.category); }
    if (f.vendor) { where.push('v.slug=?'); args.push(f.vendor); }
    if (f.type) { where.push('p.type=?'); args.push(f.type); }
    if (f.q) { where.push('(p.name LIKE ? OR p.description LIKE ?)'); args.push('%' + f.q + '%', '%' + f.q + '%'); }
    return db.prepare(productSelect + ' WHERE ' + where.join(' AND ') + ' ORDER BY p.sort, p.created').all(...args);
  },
  product: (id) => db.prepare(productSelect + ' WHERE p.id=?').get(id),
  vendorProducts: (vendorId) => db.prepare(productSelect + ' WHERE p.vendor_id=? ORDER BY p.created DESC').all(vendorId),
  createProduct(p) {
    db.prepare('INSERT INTO products (id,vendor_id,cat,type,name,unit,price,price_per_kg,weight_kg,rating,reviews,badge,stock,description,active,sort,created) VALUES (?,?,?,?,?,?,?,?,?,0,0,?,?,?,1,999,?)')
      .run(p.id, p.vendor_id, p.cat, p.type, p.name, p.unit, p.price, p.price_per_kg || null, p.weight_kg || null, p.badge || '', p.stock, p.description || '', new Date().toISOString());
    return q.product(p.id);
  },
  updateProduct(id, vendorId, p) {
    const cur = db.prepare('SELECT * FROM products WHERE id=? AND vendor_id=?').get(id, vendorId);
    if (!cur) return null;
    db.prepare('UPDATE products SET name=?,cat=?,type=?,unit=?,price=?,price_per_kg=?,weight_kg=?,badge=?,stock=?,description=?,active=? WHERE id=?')
      .run(p.name, p.cat, p.type, p.unit, p.price, p.price_per_kg || null, p.weight_kg || null, p.badge || '', p.stock, p.description || '', p.active == null ? cur.active : p.active, id);
    return q.product(id);
  },
  deleteProduct: (id, vendorId) => db.prepare('DELETE FROM products WHERE id=? AND vendor_id=?').run(id, vendorId),
  productExists: (id) => !!db.prepare('SELECT 1 FROM products WHERE id=?').get(id),

  /* reviews */
  productReviews(productId, rating, sort) {
    const order = { recent: 'date DESC, id DESC', helpful: 'helpful DESC', high: 'rating DESC, date DESC', low: 'rating ASC, date DESC' }[sort] || 'date DESC, id DESC';
    return rating
      ? db.prepare(`SELECT * FROM reviews WHERE product_id=? AND rating=? ORDER BY ${order}`).all(productId, rating)
      : db.prepare(`SELECT * FROM reviews WHERE product_id=? ORDER BY ${order}`).all(productId);
  },
  productReviewSummary(productId) {
    const row = db.prepare('SELECT COUNT(*) total, IFNULL(ROUND(AVG(rating),1),0) avg FROM reviews WHERE product_id=?').get(productId);
    const dist = [5, 4, 3, 2, 1].map((s) => db.prepare('SELECT COUNT(*) n FROM reviews WHERE product_id=? AND rating=?').get(productId, s).n);
    return { avg: row.avg, total: row.total, dist };
  },
  addReview(r) {
    const info = db.prepare('INSERT INTO reviews (product_id,user_id,name,rating,date,title,body,helpful,verified) VALUES (?,?,?,?,?,?,?,0,1)')
      .run(r.product_id, r.user_id || null, r.name, r.rating, new Date().toISOString().slice(0, 10), r.title, r.body);
    // nudge the product's headline aggregate so the card reflects the new review
    const p = db.prepare('SELECT rating,reviews FROM products WHERE id=?').get(r.product_id);
    if (p) {
      const newCount = p.reviews + 1;
      const newAvg = Math.round(((p.rating * p.reviews) + r.rating) / newCount * 10) / 10;
      db.prepare('UPDATE products SET rating=?, reviews=? WHERE id=?').run(newAvg, newCount, r.product_id);
    }
    return db.prepare('SELECT * FROM reviews WHERE id=?').get(info.lastInsertRowid);
  },
  helpful(id) {
    db.prepare('UPDATE reviews SET helpful=helpful+1 WHERE id=?').run(id);
    const row = db.prepare('SELECT helpful FROM reviews WHERE id=?').get(id);
    return row ? row.helpful : null;
  },
  recentReviews(limit) {
    return db.prepare('SELECT r.*, p.name AS product_name FROM reviews r JOIN products p ON p.id=r.product_id ORDER BY r.date DESC, r.id DESC LIMIT ?').all(limit || 6);
  },

  /* faqs */
  faqs: () => db.prepare('SELECT q,a FROM faqs ORDER BY sort').all(),

  /* legal / policy pages */
  pages: () => db.prepare('SELECT slug,title,sort,updated FROM pages ORDER BY sort').all(),
  page: (slug) => db.prepare('SELECT slug,title,body,updated FROM pages WHERE slug=?').get(slug),
  updatePage(slug, p) {
    const cur = db.prepare('SELECT slug FROM pages WHERE slug=?').get(slug); if (!cur) return null;
    db.prepare('UPDATE pages SET title=COALESCE(?,title), body=COALESCE(?,body), updated=? WHERE slug=?').run(p.title != null ? p.title : null, p.body != null ? p.body : null, new Date().toISOString(), slug);
    return db.prepare('SELECT slug,title,body,updated FROM pages WHERE slug=?').get(slug);
  },

  /* orders */
  createOrder(o, items) {
    db.exec('BEGIN');
    try {
      const created = new Date().toISOString();
      db.prepare("INSERT INTO orders (id,user_id,created,status,fulfillment,subtotal,discount,delivery,total,coupon_code,name,phone,address,method,slaughter,timeline) VALUES (?,?,?,'pending','processing',?,?,?,?,?,?,?,?,?,?,?)")
        .run(o.id, o.user_id || null, created, o.subtotal, o.discount || 0, o.delivery, o.total, o.coupon_code || null, o.name, o.phone, o.address, o.method, o.slaughter ? 1 : 0, JSON.stringify([{ status: 'placed', at: created }]));
      const ii = db.prepare('INSERT INTO order_items (order_id,product_id,vendor_id,name,unit_price,qty,line_total,commission_rate,commission,net) VALUES (?,?,?,?,?,?,?,?,?,?)');
      items.forEach((it) => ii.run(o.id, it.product_id, it.vendor_id, it.name, it.unit_price, it.qty, it.line_total, it.commission_rate == null ? 0 : it.commission_rate, it.commission == null ? 0 : it.commission, it.net == null ? it.line_total : it.net));
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    return q.order(o.id);
  },
  order(id) {
    const o = db.prepare('SELECT * FROM orders WHERE id=?').get(id);
    if (o) o.items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(id);
    return o;
  },
  setOrderStatus: (id, status, ref, method) => db.prepare('UPDATE orders SET status=?, payment_ref=COALESCE(?,payment_ref), method=COALESCE(?,method) WHERE id=?').run(status, ref || null, method || null, id),
  userOrders: (userId) => db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY created DESC').all(userId),
  vendorOrders(vendorId) {
    return db.prepare(`SELECT o.*, GROUP_CONCAT(oi.name || ' ×' || oi.qty, ', ') items_text, SUM(oi.line_total) vendor_total
      FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE oi.vendor_id=? GROUP BY o.id ORDER BY o.created DESC`).all(vendorId);
  },
  allOrders: () => db.prepare('SELECT * FROM orders ORDER BY created DESC LIMIT 200').all(),

  subscribe: (email) => db.prepare('INSERT OR IGNORE INTO newsletter (email,created) VALUES (?,?)').run(String(email).toLowerCase(), new Date().toISOString()),

  counts() {
    const realized = "status IN ('paid','placed')";
    return {
      products: db.prepare('SELECT COUNT(*) n FROM products').get().n,
      vendors: db.prepare('SELECT COUNT(*) n FROM vendors').get().n,
      activeVendors: db.prepare("SELECT COUNT(*) n FROM vendors WHERE status='active'").get().n,
      pendingApplications: db.prepare("SELECT COUNT(*) n FROM applications WHERE status='pending'").get().n,
      customers: db.prepare("SELECT COUNT(*) n FROM users WHERE role='customer'").get().n,
      orders: db.prepare('SELECT COUNT(*) n FROM orders').get().n,
      paidOrders: db.prepare("SELECT COUNT(*) n FROM orders WHERE status='paid'").get().n,
      revenue: db.prepare(`SELECT IFNULL(SUM(total),0) s FROM orders WHERE ${realized}`).get().s,
      gmv: db.prepare(`SELECT IFNULL(SUM(total),0) s FROM orders WHERE ${realized}`).get().s,
      commission: db.prepare("SELECT IFNULL(SUM(oi.commission),0) s FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status IN ('paid','placed')").get().s,
      oneMembers: db.prepare("SELECT COUNT(*) n FROM subscriptions WHERE subscriber_type='customer' AND plan='one' AND status IN ('active','cancelled')").get().n,
      awalVendors: db.prepare("SELECT COUNT(*) n FROM subscriptions WHERE subscriber_type='vendor' AND plan='awal' AND status IN ('active','cancelled')").get().n,
      openTickets: db.prepare("SELECT COUNT(*) n FROM tickets WHERE status IN ('open','pending')").get().n,
      pendingPayout: db.prepare("SELECT IFNULL(SUM(oi.net),0) s FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status IN ('paid','placed') AND oi.payout_id IS NULL").get().s
    };
  },

  /* ---- settings ---- */
  setting: (key, fb) => { const r = db.prepare('SELECT value FROM settings WHERE key=?').get(key); return r == null ? fb : r.value; },
  settingNum: (key, fb) => { const r = db.prepare('SELECT value FROM settings WHERE key=?').get(key); return r == null ? fb : Number(r.value); },
  settingsAll: () => { const o = {}; db.prepare('SELECT key,value FROM settings').all().forEach((r) => { o[r.key] = r.value; }); return o; },
  setSetting: (key, val) => db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(val)),

  /* ---- profile / security ---- */
  updateProfile(userId, p) { db.prepare('UPDATE users SET name=COALESCE(?,name), phone=COALESCE(?,phone) WHERE id=?').run(p.name != null ? p.name : null, p.phone != null ? p.phone : null, userId); return q.userById(userId); },
  setPassword(userId, hash) { db.prepare('UPDATE users SET pass_hash=? WHERE id=?').run(hash, userId); },

  /* ---- addresses ---- */
  addresses: (userId) => db.prepare('SELECT * FROM addresses WHERE user_id=? ORDER BY is_default DESC, id DESC').all(userId),
  address: (id, userId) => db.prepare('SELECT * FROM addresses WHERE id=? AND user_id=?').get(id, userId),
  createAddress(userId, a) {
    const first = db.prepare('SELECT COUNT(*) n FROM addresses WHERE user_id=?').get(userId).n === 0;
    const info = db.prepare('INSERT INTO addresses (user_id,label,name,phone,line1,line2,city,governorate,notes,is_default,created) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(userId, a.label || 'Home', a.name || '', a.phone || '', a.line1 || '', a.line2 || '', a.city || '', a.governorate || '', a.notes || '', first ? 1 : 0, nowISO());
    if (first) db.prepare('UPDATE users SET default_address_id=? WHERE id=?').run(info.lastInsertRowid, userId);
    return q.address(info.lastInsertRowid, userId);
  },
  updateAddress(id, userId, a) {
    const cur = q.address(id, userId); if (!cur) return null;
    db.prepare('UPDATE addresses SET label=?,name=?,phone=?,line1=?,line2=?,city=?,governorate=?,notes=? WHERE id=? AND user_id=?')
      .run(a.label || cur.label, a.name || cur.name, a.phone || cur.phone, a.line1 || cur.line1, a.line2 != null ? a.line2 : cur.line2, a.city || cur.city, a.governorate || cur.governorate, a.notes != null ? a.notes : cur.notes, id, userId);
    return q.address(id, userId);
  },
  deleteAddress: (id, userId) => db.prepare('DELETE FROM addresses WHERE id=? AND user_id=?').run(id, userId),
  setDefaultAddress(id, userId) {
    if (!q.address(id, userId)) return null;
    db.prepare('UPDATE addresses SET is_default=0 WHERE user_id=?').run(userId);
    db.prepare('UPDATE addresses SET is_default=1 WHERE id=? AND user_id=?').run(id, userId);
    db.prepare('UPDATE users SET default_address_id=? WHERE id=?').run(id, userId);
    return q.addresses(userId);
  },

  /* ---- payment methods (tokenized reference only; never a full PAN) ---- */
  paymentMethods: (userId) => db.prepare('SELECT id,user_id,brand,last4,exp_month,exp_year,is_default,created FROM payment_methods WHERE user_id=? ORDER BY is_default DESC, id DESC').all(userId),
  createPaymentMethod(userId, pm) {
    const first = db.prepare('SELECT COUNT(*) n FROM payment_methods WHERE user_id=?').get(userId).n === 0;
    const info = db.prepare('INSERT INTO payment_methods (user_id,brand,last4,token,exp_month,exp_year,is_default,created) VALUES (?,?,?,?,?,?,?,?)')
      .run(userId, pm.brand, pm.last4, pm.token, pm.exp_month || null, pm.exp_year || null, first ? 1 : 0, nowISO());
    return info.lastInsertRowid;
  },
  deletePaymentMethod: (id, userId) => db.prepare('DELETE FROM payment_methods WHERE id=? AND user_id=?').run(id, userId),
  setDefaultPaymentMethod(id, userId) {
    db.prepare('UPDATE payment_methods SET is_default=0 WHERE user_id=?').run(userId);
    db.prepare('UPDATE payment_methods SET is_default=1 WHERE id=? AND user_id=?').run(id, userId);
    return q.paymentMethods(userId);
  },

  /* ---- subscriptions (Lahmetna One / Awal) ---- */
  mirrorPlan(type, id, status, plan, renews) {
    const live = status === 'active' || status === 'cancelled';
    const pv = live ? plan : null;
    if (type === 'customer') db.prepare('UPDATE users SET plan=?, plan_status=?, plan_renews=? WHERE id=?').run(pv, status, renews || null, id);
    else db.prepare('UPDATE vendors SET plan=?, plan_status=?, plan_renews=? WHERE id=?').run(pv, status, renews || null, id);
  },
  subscription(type, id) {
    const s = db.prepare('SELECT * FROM subscriptions WHERE subscriber_type=? AND subscriber_id=?').get(type, id);
    if (s && (s.status === 'active' || s.status === 'cancelled') && s.renews && new Date(s.renews) < new Date()) {
      db.prepare("UPDATE subscriptions SET status='expired' WHERE id=?").run(s.id);
      q.mirrorPlan(type, id, 'expired', s.plan, s.renews); s.status = 'expired';
    }
    return s || null;
  },
  activeSubscription(type, id) {
    const s = q.subscription(type, id);
    const live = s && (s.status === 'active' || s.status === 'cancelled') && s.renews && new Date(s.renews) > new Date();
    return live ? s : null;
  },
  startSubscription(type, id, plan, price, ref) {
    const started = nowISO(), renews = addDays(30);
    db.prepare(`INSERT INTO subscriptions (subscriber_type,subscriber_id,plan,status,price,started,renews,cancelled_at,payment_ref,created)
      VALUES (?,?,?,'active',?,?,?,NULL,?,?)
      ON CONFLICT(subscriber_type,subscriber_id) DO UPDATE SET plan=excluded.plan,status='active',price=excluded.price,started=excluded.started,renews=excluded.renews,cancelled_at=NULL,payment_ref=excluded.payment_ref`)
      .run(type, id, plan, price, started, renews, ref || null, started);
    const sub = db.prepare('SELECT * FROM subscriptions WHERE subscriber_type=? AND subscriber_id=?').get(type, id);
    db.prepare('INSERT INTO subscription_payments (subscription_id,plan,amount,ref,created) VALUES (?,?,?,?,?)').run(sub.id, plan, price, ref || null, started);
    q.mirrorPlan(type, id, 'active', plan, renews);
    return sub;
  },
  cancelSubscription(type, id) {
    const s = db.prepare('SELECT * FROM subscriptions WHERE subscriber_type=? AND subscriber_id=?').get(type, id);
    if (!s) return null;
    db.prepare("UPDATE subscriptions SET status='cancelled', cancelled_at=? WHERE id=?").run(nowISO(), s.id);
    q.mirrorPlan(type, id, 'cancelled', s.plan, s.renews);
    return db.prepare('SELECT * FROM subscriptions WHERE id=?').get(s.id);
  },
  subscriptionPayments: (subId) => db.prepare('SELECT * FROM subscription_payments WHERE subscription_id=? ORDER BY created DESC').all(subId),
  allSubscriptions() {
    return db.prepare(`SELECT s.*,
      CASE WHEN s.subscriber_type='customer' THEN (SELECT name FROM users WHERE id=s.subscriber_id) ELSE (SELECT name FROM vendors WHERE id=s.subscriber_id) END AS subscriber_name,
      CASE WHEN s.subscriber_type='customer' THEN (SELECT email FROM users WHERE id=s.subscriber_id) ELSE (SELECT slug FROM vendors WHERE id=s.subscriber_id) END AS subscriber_ref
      FROM subscriptions s ORDER BY s.created DESC`).all();
  },

  /* ---- support tickets ---- */
  createTicket(userId, role, t) {
    const now = nowISO();
    const info = db.prepare('INSERT INTO tickets (user_id,role,order_id,subject,category,status,priority,created,updated) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(userId, role, t.order_id || null, t.subject, t.category || 'General', 'open', t.priority || 'normal', now, now);
    if (t.body) db.prepare('INSERT INTO ticket_messages (ticket_id,author_id,author_role,body,created) VALUES (?,?,?,?,?)').run(info.lastInsertRowid, userId, role, t.body, now);
    return q.ticket(info.lastInsertRowid);
  },
  ticket(id) {
    const t = db.prepare('SELECT * FROM tickets WHERE id=?').get(id);
    if (t) t.messages = db.prepare('SELECT * FROM ticket_messages WHERE ticket_id=? ORDER BY created').all(id);
    return t || null;
  },
  userTickets: (userId) => db.prepare('SELECT t.*, (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id=t.id) msgs FROM tickets t WHERE t.user_id=? ORDER BY t.updated DESC').all(userId),
  adminTickets(f) {
    f = f || {}; const where = []; const args = [];
    if (f.status) { where.push('t.status=?'); args.push(f.status); }
    if (f.priority) { where.push('t.priority=?'); args.push(f.priority); }
    const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
    return db.prepare(`SELECT t.*, u.name AS user_name, u.email AS user_email, (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id=t.id) msgs
      FROM tickets t LEFT JOIN users u ON u.id=t.user_id${w} ORDER BY CASE t.priority WHEN 'high' THEN 0 ELSE 1 END, t.updated DESC`).all(...args);
  },
  addTicketMessage(ticketId, authorId, role, body) {
    const now = nowISO();
    db.prepare('INSERT INTO ticket_messages (ticket_id,author_id,author_role,body,created) VALUES (?,?,?,?,?)').run(ticketId, authorId, role, body, now);
    db.prepare('UPDATE tickets SET updated=?, status=? WHERE id=?').run(now, role === 'admin' ? 'pending' : 'open', ticketId);
    return q.ticket(ticketId);
  },
  setTicketStatus(id, status) { db.prepare('UPDATE tickets SET status=?, updated=? WHERE id=?').run(status, nowISO(), id); return q.ticket(id); },
  setTicketPriority(id, priority) { db.prepare('UPDATE tickets SET priority=?, updated=? WHERE id=?').run(priority, nowISO(), id); return q.ticket(id); },

  /* ---- vendor earnings & payouts ---- */
  vendorEarnings(vendorId) {
    const g = db.prepare("SELECT IFNULL(SUM(oi.line_total),0) gross, IFNULL(SUM(oi.commission),0) commission, IFNULL(SUM(oi.net),0) net FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.vendor_id=? AND o.status IN ('paid','placed')").get(vendorId);
    const pending = db.prepare("SELECT IFNULL(SUM(oi.net),0) s FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.vendor_id=? AND o.status IN ('paid','placed') AND oi.payout_id IS NULL").get(vendorId).s;
    const paidOut = db.prepare("SELECT IFNULL(SUM(amount),0) s FROM payouts WHERE vendor_id=? AND status='paid'").get(vendorId).s;
    return { gross: g.gross, commission: g.commission, net: g.net, pending, paidOut };
  },
  vendorEarningRows: (vendorId) => db.prepare(`SELECT o.id order_id, o.created, o.status, SUM(oi.line_total) gross, SUM(oi.commission) commission, SUM(oi.net) net, MAX(oi.payout_id) payout_id
    FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.vendor_id=? AND o.status IN ('paid','placed') GROUP BY o.id ORDER BY o.created DESC`).all(vendorId),
  createPayout(vendorId, note) {
    const rows = db.prepare("SELECT oi.id id, oi.net net FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.vendor_id=? AND o.status IN ('paid','placed') AND oi.payout_id IS NULL").all(vendorId);
    const amount = rows.reduce((s, r) => s + (r.net || 0), 0);
    if (!rows.length || amount <= 0) return null;
    const now = nowISO();
    const info = db.prepare("INSERT INTO payouts (vendor_id,amount,status,note,created) VALUES (?,?,'pending',?,?)").run(vendorId, amount, note || '', now);
    const pid = info.lastInsertRowid;
    const upd = db.prepare('UPDATE order_items SET payout_id=? WHERE id=?');
    rows.forEach((r) => upd.run(pid, r.id));
    return db.prepare('SELECT * FROM payouts WHERE id=?').get(pid);
  },
  settlePayout(id) { db.prepare("UPDATE payouts SET status='paid', paid_at=? WHERE id=?").run(nowISO(), id); return db.prepare('SELECT * FROM payouts WHERE id=?').get(id); },
  payouts: (vendorId) => db.prepare('SELECT * FROM payouts WHERE vendor_id=? ORDER BY created DESC').all(vendorId),
  allPayouts: () => db.prepare('SELECT p.*, v.name vendor_name, v.slug vendor_slug FROM payouts p JOIN vendors v ON v.id=p.vendor_id ORDER BY p.created DESC').all(),
  pendingBalances: () => db.prepare(`SELECT v.id vendor_id, v.name vendor_name, v.slug vendor_slug,
    IFNULL(SUM(CASE WHEN o.status IN ('paid','placed') AND oi.payout_id IS NULL THEN oi.net ELSE 0 END),0) pending
    FROM vendors v LEFT JOIN order_items oi ON oi.vendor_id=v.id LEFT JOIN orders o ON o.id=oi.order_id
    GROUP BY v.id HAVING pending > 0 ORDER BY pending DESC`).all(),
  vendorAnalytics(vendorId) {
    const top = db.prepare("SELECT oi.product_id, oi.name, SUM(oi.qty) qty, SUM(oi.line_total) revenue FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.vendor_id=? AND o.status IN ('paid','placed') GROUP BY oi.product_id ORDER BY revenue DESC LIMIT 6").all(vendorId);
    const daily = db.prepare("SELECT substr(o.created,1,10) day, SUM(oi.line_total) revenue, COUNT(DISTINCT o.id) orders FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.vendor_id=? AND o.status IN ('paid','placed') GROUP BY day ORDER BY day DESC LIMIT 14").all(vendorId);
    return { top, daily: daily.reverse() };
  },

  /* ---- admin: customers, vendors, catalog, orders, fulfillment ---- */
  adminCustomers: () => db.prepare(`SELECT u.id,u.name,u.email,u.phone,u.created,u.suspended,u.plan,u.plan_status,
    (SELECT COUNT(*) FROM orders o WHERE o.user_id=u.id) orders,
    (SELECT IFNULL(SUM(total),0) FROM orders o WHERE o.user_id=u.id AND o.status IN ('paid','placed')) spend
    FROM users u WHERE u.role='customer' ORDER BY u.created DESC`).all(),
  adminCustomer(id) {
    const u = db.prepare("SELECT id,role,name,email,phone,created,suspended,plan,plan_status,plan_renews FROM users WHERE id=? AND role='customer'").get(id);
    if (!u) return null;
    u.orders = q.userOrders(id); u.addresses = q.addresses(id); u.tickets = q.userTickets(id); u.subscription = q.subscription('customer', id);
    return u;
  },
  setCustomerAdmin(id, p) { if (p.suspended != null) db.prepare('UPDATE users SET suspended=? WHERE id=?').run(p.suspended ? 1 : 0, id); return q.adminCustomer(id); },
  adminVendors: () => db.prepare(`SELECT v.*,
    (SELECT COUNT(*) FROM products p WHERE p.vendor_id=v.id) products,
    (SELECT COUNT(DISTINCT oi.order_id) FROM order_items oi WHERE oi.vendor_id=v.id) orders,
    (SELECT IFNULL(SUM(oi.line_total),0) FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.vendor_id=v.id AND o.status IN ('paid','placed')) revenue,
    (SELECT email FROM users WHERE vendor_id=v.id LIMIT 1) email
    FROM vendors v ORDER BY v.created DESC`).all(),
  adminVendorDetail(id) {
    const v = q.vendor(id); if (!v) return null;
    v.products = q.vendorProducts(id); v.earnings = q.vendorEarnings(id); v.subscription = q.subscription('vendor', id); v.payouts = q.payouts(id);
    return v;
  },
  setVendorAdmin(id, p) {
    if (!q.vendor(id)) return null;
    if (p.status != null) db.prepare('UPDATE vendors SET status=? WHERE id=?').run(p.status, id);
    if (p.commission_rate != null) db.prepare('UPDATE vendors SET commission_rate=? WHERE id=?').run(p.commission_rate, id);
    if (p.featured != null) db.prepare('UPDATE vendors SET featured=? WHERE id=?').run(p.featured ? 1 : 0, id);
    return q.vendor(id);
  },
  updateVendorProfile(id, p) {
    db.prepare('UPDATE vendors SET name=COALESCE(?,name), bio=COALESCE(?,bio), location=COALESCE(?,location), logo=COALESCE(?,logo) WHERE id=?')
      .run(p.name != null ? p.name : null, p.bio != null ? p.bio : null, p.location != null ? p.location : null, p.logo != null ? p.logo : null, id);
    return q.vendor(id);
  },
  adminCatalog(f) {
    f = f || {}; const where = []; const args = [];
    if (f.q) { where.push('(p.name LIKE ? OR p.id LIKE ?)'); args.push('%' + f.q + '%', '%' + f.q + '%'); }
    if (f.vendor) { where.push('v.slug=?'); args.push(f.vendor); }
    if (f.status === 'active') where.push('p.active=1');
    if (f.status === 'hidden') where.push('p.active=0');
    const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
    return db.prepare(`SELECT p.*, v.name origin, v.slug vendor_slug FROM products p JOIN vendors v ON v.id=p.vendor_id${w} ORDER BY p.created DESC`).all(...args);
  },
  setProductAdmin(id, p) {
    const cur = db.prepare('SELECT * FROM products WHERE id=?').get(id); if (!cur) return null;
    if (p.active != null) db.prepare('UPDATE products SET active=? WHERE id=?').run(p.active ? 1 : 0, id);
    if (p.badge != null) db.prepare('UPDATE products SET badge=? WHERE id=?').run(p.badge, id);
    if (p.price != null) db.prepare('UPDATE products SET price=? WHERE id=?').run(p.price, id);
    if (p.stock != null) db.prepare('UPDATE products SET stock=? WHERE id=?').run(p.stock, id);
    return db.prepare('SELECT * FROM products WHERE id=?').get(id);
  },
  adminDeleteProduct: (id) => db.prepare('DELETE FROM products WHERE id=?').run(id),
  adminOrders(f) {
    f = f || {}; const where = []; const args = [];
    if (f.status) { where.push('status=?'); args.push(f.status); }
    if (f.fulfillment) { where.push('fulfillment=?'); args.push(f.fulfillment); }
    if (f.q) { where.push('(id LIKE ? OR name LIKE ?)'); args.push('%' + f.q + '%', '%' + f.q + '%'); }
    const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
    return db.prepare(`SELECT * FROM orders${w} ORDER BY created DESC LIMIT 300`).all(...args);
  },
  adminOrder(id) {
    const o = q.order(id); if (!o) return null;
    o.customer = o.user_id ? db.prepare('SELECT id,name,email,phone FROM users WHERE id=?').get(o.user_id) : null;
    return o;
  },
  setFulfillment(id, status, note) {
    const o = db.prepare('SELECT timeline FROM orders WHERE id=?').get(id); if (!o) return null;
    let tl = []; try { tl = JSON.parse(o.timeline || '[]'); } catch (e) { tl = []; }
    tl.push({ status, note: note || '', at: nowISO() });
    db.prepare('UPDATE orders SET fulfillment=?, timeline=? WHERE id=?').run(status, JSON.stringify(tl), id);
    return q.order(id);
  },
  refundOrder(id, amount) { db.prepare("UPDATE orders SET status='refunded', refund=? WHERE id=?").run(amount, id); return q.setFulfillment(id, 'refunded', 'Refund issued: EGP ' + amount); },

  /* ---- coupons ---- */
  coupons: () => db.prepare('SELECT * FROM coupons ORDER BY created DESC').all(),
  coupon: (code) => db.prepare('SELECT * FROM coupons WHERE code=?').get(String(code || '').toUpperCase()),
  createCoupon(c) {
    db.prepare(`INSERT INTO coupons (code,kind,value,min_order,expires,usage_limit,used,active,created) VALUES (?,?,?,?,?,?,0,1,?)
      ON CONFLICT(code) DO UPDATE SET kind=excluded.kind,value=excluded.value,min_order=excluded.min_order,expires=excluded.expires,usage_limit=excluded.usage_limit,active=1`)
      .run(String(c.code).toUpperCase(), c.kind === 'flat' ? 'flat' : 'percent', c.value, c.min_order || 0, c.expires || null, c.usage_limit || null, nowISO());
    return q.coupon(c.code);
  },
  setCouponActive(code, active) { db.prepare('UPDATE coupons SET active=? WHERE code=?').run(active ? 1 : 0, String(code).toUpperCase()); return q.coupon(code); },
  validateCoupon(code, subtotal) {
    const c = q.coupon(code); if (!c || !c.active) return { error: 'Invalid or inactive code' };
    if (c.expires && new Date(c.expires) < new Date()) return { error: 'This code has expired' };
    if (c.usage_limit != null && c.used >= c.usage_limit) return { error: 'This code has reached its usage limit' };
    if (subtotal < (c.min_order || 0)) return { error: 'Minimum order of EGP ' + c.min_order + ' for this code' };
    const discount = c.kind === 'flat' ? c.value : Math.round(subtotal * c.value / 100);
    return { code: c.code, discount, kind: c.kind, value: c.value };
  },
  redeemCoupon: (code) => db.prepare('UPDATE coupons SET used=used+1 WHERE code=?').run(String(code).toUpperCase()),

  /* ---- notifications ---- */
  notify: (userId, type, body, link) => db.prepare('INSERT INTO notifications (user_id,type,body,link,read,created) VALUES (?,?,?,?,0,?)').run(userId, type, body, link || null, nowISO()),
  notifications: (userId) => db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created DESC LIMIT 30').all(userId),
  unreadCount: (userId) => db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read=0').get(userId).n,
  markNotificationsRead: (userId) => db.prepare('UPDATE notifications SET read=1 WHERE user_id=?').run(userId)
};

module.exports = { db, q };
