/* Vendor dashboard — storefront console with earnings, payouts, Awal */
(function () {
  'use strict';
  var esc = LH.esc, money = LH.money, api = LH.api, POST = LH.POST, $ = LH.$, card = LH.card, st = LH.st;
  var CATS = ['Beef', 'Lamb & Goat', 'Poultry', 'Eggs', 'Dairy', 'Vegetables', 'Fruit', 'Honey', 'Livestock'];
  var me = null, panel;
  function empty(msg, cta) { return '<div class="card" style="padding:40px;text-align:center"><p class="muted">' + msg + '</p>' + (cta || '') + '</div>'; }

  /* ---------- OVERVIEW ---------- */
  function overview() {
    api('/api/vendor/overview').then(function (o) {
      panel.innerHTML = (o.plan === 'awal' ? '<div style="margin-bottom:16px">' + LH.planBadge('awal') + (o.featured ? ' <span class="badge">Featured store</span>' : '') + '</div>' : '') +
        '<div class="stat-cards">' + card(o.products, 'Products') + card(o.orders, 'Orders') + card(money(o.revenue), 'Gross sales') +
        card(money(o.net), 'Net earnings') + card(money(o.pending), 'Pending payout') + '</div>' +
        '<div class="card" style="margin-top:22px;padding:24px 26px"><div class="row between" style="gap:16px;flex-wrap:wrap"><div><h3 class="display" style="font-size:18px">' + esc(me.vendor_name || 'Your farm') + '</h3><p class="muted" style="font-size:14px;margin-top:6px;max-width:560px">Add products, fulfill orders, and track your earnings. Products appear in the shop instantly.</p></div><button class="btn btn-primary btn-sm" data-goto="products">Manage products</button></div></div>' +
        (o.plan !== 'awal' ? '<div class="card" style="margin-top:16px;padding:22px 26px;background:var(--soft)"><div class="row between" style="gap:16px;flex-wrap:wrap"><div><strong class="display" style="font-size:17px">Upgrade to Lahmetna Awal</strong><div class="muted" style="font-size:13.5px;margin-top:4px">Lower commission (8%), featured placement, weekly payouts, advanced analytics.</div></div><button class="btn btn-primary btn-sm" data-goto="awal">See Awal</button></div></div>' : '');
    });
  }

  /* ---------- PRODUCTS ---------- */
  function products() {
    api('/api/vendor/products').then(function (list) {
      panel.innerHTML = '<div class="row between"><h3 class="display" style="font-size:18px">Your products (' + list.length + ')</h3><button class="btn btn-primary btn-sm" id="add-prod">+ Add product</button></div>' +
        (list.length ? '<div class="card" style="margin-top:16px;padding:6px"><table class="tbl"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead><tbody>' +
          list.map(function (p) {
            return '<tr><td data-label="Product"><strong>' + esc(p.name.split(' · ')[0]) + '</strong></td><td data-label="Category">' + esc(p.cat) + '</td>' +
              '<td data-label="Price" class="num">' + (p.type === 'livestock' ? money(p.price_per_kg) + '/kg' : money(p.price)) + '</td>' +
              '<td data-label="Stock" class="num">' + p.stock + '</td>' +
              '<td data-label="Status">' + (p.active ? st('active') : st('pending')) + '</td>' +
              '<td data-label="" style="white-space:nowrap"><button class="btn btn-outline btn-sm" data-edit="' + esc(p.id) + '">Edit</button> <button class="btn btn-outline btn-sm" data-del="' + esc(p.id) + '" style="color:#8e203f">Delete</button></td></tr>';
          }).join('') + '</tbody></table></div>'
          : empty('No products yet.', '<button class="btn btn-primary" id="add-first" style="margin-top:12px">+ Add your first product</button>'));
      var a1 = $('#add-prod'), a2 = $('#add-first');
      if (a1) a1.addEventListener('click', function () { openProd(null); });
      if (a2) a2.addEventListener('click', function () { openProd(null); });
      window.__vp = {}; list.forEach(function (p) { window.__vp[p.id] = p; });
    });
  }

  /* ---------- ORDERS (with fulfillment) ---------- */
  var FLOW = ['confirmed', 'packed', 'shipped', 'delivered'];
  function orders() {
    api('/api/vendor/orders').then(function (list) {
      panel.innerHTML = '<h3 class="display" style="font-size:18px">Orders (' + list.length + ')</h3>' +
        (list.length ? '<div class="card" style="margin-top:16px;padding:6px"><table class="tbl"><thead><tr><th>Order</th><th>Date</th><th>Your items</th><th>Your total</th><th>Fulfillment</th><th></th></tr></thead><tbody>' +
          list.map(function (o) {
            var ff = o.fulfillment || 'processing';
            var next = FLOW[FLOW.indexOf(ff) + 1] || (ff === 'processing' ? 'confirmed' : null);
            return '<tr><td data-label="Order"><strong>' + esc(o.id) + '</strong></td><td data-label="Date">' + esc(o.created.slice(0, 10)) + '</td>' +
              '<td data-label="Items" style="max-width:300px">' + esc(o.items_text || '') + '</td>' +
              '<td data-label="Total" class="num">' + money(o.vendor_total) + '</td>' +
              '<td data-label="Fulfillment">' + st(ff) + '</td>' +
              '<td data-label="">' + (next && o.status !== 'cancelled' && o.status !== 'refunded' ? '<button class="btn btn-outline btn-sm" data-fulfill="' + esc(o.id) + '" data-next="' + next + '">Mark ' + next + '</button>' : '<span class="muted" style="font-size:12.5px">—</span>') + '</td></tr>';
          }).join('') + '</tbody></table></div>'
          : empty('No orders yet — they’ll appear here as customers buy your products.'));
    });
  }

  /* ---------- EARNINGS ---------- */
  function earnings() {
    api('/api/vendor/earnings').then(function (d) {
      var s = d.summary;
      panel.innerHTML = '<h3 class="display" style="font-size:18px">Earnings</h3>' +
        '<div class="stat-cards" style="margin-top:16px">' + card(money(s.gross), 'Gross sales') + card(money(s.commission), 'Commission') + card(money(s.net), 'Net earnings') + card(money(s.pending), 'Pending payout') + card(money(s.paidOut), 'Paid out') + '</div>' +
        (d.rows.length ? '<div class="card" style="margin-top:18px;padding:6px"><table class="tbl"><thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Gross</th><th>Commission</th><th>Net</th><th>Settled</th></tr></thead><tbody>' +
          d.rows.map(function (r) {
            return '<tr><td data-label="Order"><strong>' + esc(r.order_id) + '</strong></td><td data-label="Date">' + esc(r.created.slice(0, 10)) + '</td>' +
              '<td data-label="Status">' + st(r.status) + '</td><td data-label="Gross" class="num">' + money(r.gross) + '</td>' +
              '<td data-label="Commission" class="num">−' + money(r.commission) + '</td><td data-label="Net" class="num">' + money(r.net) + '</td>' +
              '<td data-label="Settled">' + (r.payout_id ? st('paid') : '<span class="muted" style="font-size:12.5px">pending</span>') + '</td></tr>';
          }).join('') + '</tbody></table></div>' : empty('No earnings yet.'));
    });
  }

  /* ---------- PAYOUTS ---------- */
  function payouts() {
    api('/api/vendor/payouts').then(function (d) {
      panel.innerHTML = '<div class="row between"><h3 class="display" style="font-size:18px">Payouts</h3><span class="badge">' + esc(d.cadence) + '</span></div>' +
        '<div class="card" style="margin-top:16px;padding:22px 26px;background:var(--soft)"><div class="row between"><span class="muted">Pending balance</span><strong class="display" style="font-size:22px">' + money(d.summary.pending) + '</strong></div><p class="muted" style="font-size:12.5px;margin-top:6px">Lahmetna settles payouts to your registered account on the cadence above. Admin marks each payout as paid.</p></div>' +
        (d.payouts.length ? '<div class="card" style="margin-top:18px;padding:6px"><table class="tbl"><thead><tr><th>Payout</th><th>Created</th><th>Amount</th><th>Status</th><th>Paid</th></tr></thead><tbody>' +
          d.payouts.map(function (p) {
            return '<tr><td data-label="Payout"><strong>#' + p.id + '</strong></td><td data-label="Created">' + esc(p.created.slice(0, 10)) + '</td>' +
              '<td data-label="Amount" class="num">' + money(p.amount) + '</td><td data-label="Status">' + st(p.status === 'paid' ? 'paid' : 'processing') + '</td>' +
              '<td data-label="Paid">' + (p.paid_at ? esc(p.paid_at.slice(0, 10)) : '—') + '</td></tr>';
          }).join('') + '</tbody></table></div>' : '<p class="muted" style="margin-top:16px">No payouts issued yet.</p>');
    });
  }

  /* ---------- ANALYTICS ---------- */
  function analytics() {
    api('/api/vendor/analytics').then(function (d) {
      var maxRev = Math.max.apply(null, d.daily.map(function (x) { return x.revenue; }).concat([1]));
      panel.innerHTML = '<h3 class="display" style="font-size:18px">Analytics</h3>' + (d.advanced ? '' : '<p class="muted" style="font-size:13.5px;margin-top:6px">Upgrade to <strong>Lahmetna Awal</strong> for advanced analytics.</p>') +
        '<div class="card" style="margin-top:16px;padding:22px 26px"><div class="eyebrow">Revenue · recent days</div>' +
        (d.daily.length ? '<div class="bars" style="margin-top:26px;margin-bottom:24px">' + d.daily.slice(-10).map(function (x) {
          return '<div class="bar" style="height:' + Math.round(x.revenue / maxRev * 100) + '%"><b>' + Math.round(x.revenue) + '</b><span>' + esc(x.day.slice(5)) + '</span></div>';
        }).join('') + '</div>' : '<p class="muted" style="margin-top:10px">No sales data yet.</p>') + '</div>' +
        '<div class="card" style="margin-top:18px;padding:22px 26px"><div class="eyebrow">Top products</div>' +
        (d.top.length ? '<table class="tbl" style="margin-top:12px"><thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead><tbody>' + d.top.map(function (t) {
          return '<tr><td>' + esc(t.name) + '</td><td class="num">' + t.qty + '</td><td class="num">' + money(t.revenue) + '</td></tr>';
        }).join('') + '</tbody></table>' : '<p class="muted" style="margin-top:10px">No product sales yet.</p>') + '</div>';
    });
  }

  /* ---------- LAHMETNA AWAL ---------- */
  var AWAL_PERKS = [
    ['Lower commission', 'Pay 8% instead of 12% on every sale — it usually pays for itself.'],
    ['Featured placement', 'Your store and products get boosted visibility across Lahmetna.'],
    ['Weekly payouts', 'Get settled weekly instead of the standard cadence.'],
    ['Advanced analytics', 'Daily revenue trends and top-product breakdowns.']
  ];
  function awal() {
    api('/api/subscriptions').then(function (d) {
      var s = d.subscription, active = s && s.status === 'active', cancelled = s && s.status === 'cancelled';
      panel.innerHTML = '<div class="card" style="padding:0;overflow:hidden">' +
        '<div style="background:var(--burgundy);color:#fff;padding:28px 30px"><div class="row between" style="align-items:flex-start"><div>' + LH.planBadge('awal') +
          '<h3 class="display" style="font-size:24px;margin-top:12px;color:#fff">Lahmetna Awal</h3><div style="opacity:.85;font-size:14px;margin-top:4px">' + money(d.price) + ' / month</div></div>' +
          (active || cancelled ? '<span class="st st-' + (active ? 'active' : 'cancelled-sub') + '">' + (active ? 'Active' : 'Cancelling') + '</span>' : '') + '</div></div>' +
        '<div style="padding:24px 30px">' + AWAL_PERKS.map(function (p) {
          return '<div class="perk"><div class="ic">✓</div><div><div class="t">' + p[0] + '</div><div class="d">' + p[1] + '</div></div></div>';
        }).join('') +
        (active
          ? '<div class="card" style="margin-top:20px;padding:18px 20px;background:var(--soft)"><div class="row between"><span class="muted">Renews</span><strong>' + esc((s.renews || '').slice(0, 10)) + '</strong></div><button class="btn btn-outline btn-block" id="awal-cancel" style="margin-top:14px;color:#8e203f">Cancel Awal</button></div>'
          : cancelled
            ? '<div class="card" style="margin-top:20px;padding:18px 20px;background:var(--soft)"><p class="muted" style="font-size:13.5px">Awal stays active until <strong>' + esc((s.renews || '').slice(0, 10)) + '</strong>, then expires.</p><button class="btn btn-primary btn-block" id="awal-sub" style="margin-top:10px">Resume Awal</button></div>'
            : '<button class="btn btn-primary btn-block" id="awal-sub" style="margin-top:20px;height:50px">Upgrade to Awal · ' + money(d.price) + '/mo</button><p class="muted" style="font-size:12.5px;text-align:center;margin-top:10px">Billed monthly via PayTabs. Cancel anytime.</p>') +
        (d.payments && d.payments.length ? '<div class="eyebrow" style="margin-top:24px">Billing history</div><table class="tbl" style="margin-top:10px"><tbody>' + d.payments.map(function (p) {
          return '<tr><td>' + esc(p.created.slice(0, 10)) + '</td><td>' + esc(p.ref) + '</td><td class="num">' + money(p.amount) + '</td></tr>';
        }).join('') + '</tbody></table>' : '') + '</div></div>';
      var sb = $('#awal-sub'); if (sb) sb.addEventListener('click', function () { sb.disabled = true; POST('/api/subscriptions/subscribe', {}).then(function () { LH.toast('Welcome to Lahmetna Awal!'); LH.loadMe().then(function () { LH.mountChrome({}); }); awal(); }).catch(function (e) { LH.toast(e.message); sb.disabled = false; }); });
      var cb = $('#awal-cancel'); if (cb) cb.addEventListener('click', function () { if (!confirm('Cancel Lahmetna Awal? Benefits continue until renewal.')) return; POST('/api/subscriptions/cancel', {}).then(function () { LH.toast('Awal cancelled'); awal(); }); });
    });
  }

  /* ---------- STORE PROFILE ---------- */
  function profile() {
    api('/api/vendor/profile').then(function (v) {
      panel.innerHTML = '<h3 class="display" style="font-size:18px">Store profile</h3>' +
        '<form class="card" id="vp-form" style="margin-top:16px;padding:24px 26px;max-width:620px">' +
          '<div class="form-row"><label class="label">Store name</label><input class="field" name="name" value="' + esc(v.name) + '"></div>' +
          '<div class="form-row"><label class="label">Location</label><input class="field" name="location" value="' + esc(v.location || '') + '"></div>' +
          '<div class="form-row"><label class="label">About your farm</label><textarea class="field" name="bio">' + esc(v.bio || '') + '</textarea></div>' +
          '<div class="row" style="gap:12px;margin-top:8px">' + (v.featured ? '<span class="badge">Featured store</span>' : '') + (v.plan === 'awal' ? LH.planBadge('awal') : '') + '</div>' +
          '<div class="form-error" id="vp-err" hidden></div><button class="btn btn-primary btn-sm" style="margin-top:16px">Save profile</button></form>';
      $('#vp-form').addEventListener('submit', function (e) {
        e.preventDefault(); var b = { name: this.name.value, location: this.location.value, bio: this.bio.value };
        api('/api/vendor/profile', { method: 'PATCH', body: b }).then(function () { LH.toast('Profile saved'); }).catch(function (er) { var el = $('#vp-err'); el.textContent = er.message; el.hidden = false; });
      });
    });
  }

  /* ---------- SUPPORT ---------- */
  function support() {
    api('/api/tickets').then(function (list) {
      panel.innerHTML = '<div class="row between"><h3 class="display" style="font-size:18px">Support</h3><button class="btn btn-primary btn-sm" data-ticket-new>+ New request</button></div>' +
        (list.length ? '<div class="card" style="margin-top:16px;padding:6px"><table class="tbl"><thead><tr><th>Subject</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>' +
          list.map(function (t) {
            return '<tr><td data-label="Subject"><strong>' + esc(t.subject) + '</strong></td><td data-label="Status">' + st(t.status) + '</td>' +
              '<td data-label="Updated">' + esc((t.updated || t.created).slice(0, 10)) + '</td><td data-label=""><button class="btn btn-outline btn-sm" data-ticket="' + t.id + '">Open</button></td></tr>';
          }).join('') + '</tbody></table></div>' : empty('No support requests yet.'));
    });
  }
  function ticketView(id) {
    api('/api/tickets/' + id).then(function (t) {
      LH.modal('<div style="padding:24px 26px;display:flex;flex-direction:column;max-height:80vh"><div class="row between"><div><strong class="display" style="font-size:19px">' + esc(t.subject) + '</strong><div class="muted" style="font-size:12.5px;margin-top:2px">' + st(t.status) + '</div></div><button class="icon-btn" data-close>✕</button></div>' +
        '<div style="flex:1;overflow:auto;margin-top:8px">' + LH.ticketThread(t.messages, me.id) + '</div>' +
        (t.status === 'closed' ? '<p class="muted" style="font-size:13px;margin-top:14px">This request is closed.</p>' :
          '<form id="tk-reply" style="margin-top:16px"><textarea class="field" name="body" required placeholder="Write a reply…" style="min-height:70px"></textarea><button class="btn btn-primary btn-sm" style="margin-top:10px">Send</button></form>') + '</div>');
      var f = $('#tk-reply'); if (f) f.addEventListener('submit', function (e) { e.preventDefault(); POST('/api/tickets/' + id + '/messages', { body: this.body.value }).then(function () { ticketView(id); }); });
    });
  }
  function ticketForm() {
    LH.modal('<form id="tk-form" style="padding:24px 26px"><div class="row between"><strong class="display" style="font-size:20px">New support request</strong><button type="button" class="icon-btn" data-close>✕</button></div>' +
      '<div class="form-row"><label class="label">Subject</label><input class="field" name="subject" required></div>' +
      '<div class="form-row"><label class="label">Category</label><select class="field" name="category"><option value="payouts">Payouts</option><option value="orders">Orders</option><option value="account">Account</option><option value="other">Other</option></select></div>' +
      '<div class="form-row"><label class="label">How can we help?</label><textarea class="field" name="body" required></textarea></div>' +
      '<div class="form-error" id="tk-err" hidden></div><button class="btn btn-primary btn-block" style="margin-top:18px">Submit request</button></form>');
    $('#tk-form').addEventListener('submit', function (e) {
      e.preventDefault(); var b = {}; new FormData(this).forEach(function (v, k) { b[k] = v; });
      POST('/api/tickets', b).then(function () { LH.close($('#lh-modal'), $('#lh-mscrim')); LH.toast('Request submitted'); support(); })
        .catch(function (er) { var el = $('#tk-err'); el.textContent = er.message; el.hidden = false; });
    });
  }

  /* ---------- SECURITY ---------- */
  function security() {
    panel.innerHTML = '<h3 class="display" style="font-size:18px">Security</h3>' +
      '<form class="card" id="pw-form" style="margin-top:16px;padding:24px 26px;max-width:480px"><strong>Change password</strong>' +
        '<div class="form-row"><label class="label">Current password</label><input class="field" type="password" name="current" required></div>' +
        '<div class="form-row"><label class="label">New password</label><input class="field" type="password" name="password" required minlength="6"></div>' +
        '<div class="form-error" id="pw-err" hidden></div><button class="btn btn-primary btn-sm" style="margin-top:14px">Update password</button></form>' +
      '<button class="btn btn-outline" id="logout3" style="margin-top:20px">Log out</button>';
    $('#pw-form').addEventListener('submit', function (e) {
      e.preventDefault(); var f = this;
      POST('/api/vendor/password', { current: f.current.value, password: f.password.value })
        .then(function () { LH.toast('Password updated'); f.reset(); })
        .catch(function (er) { var el = $('#pw-err'); el.textContent = er.message; el.hidden = false; });
    });
    $('#logout3').addEventListener('click', LH.logout);
  }

  /* ---------- product modal (unchanged mechanics) ---------- */
  function openProd(p) {
    $('#p-cat').innerHTML = CATS.map(function (c) { return '<option>' + c + '</option>'; }).join('');
    $('#prod-err').hidden = true;
    $('#prod-title').textContent = p ? 'Edit product' : 'Add product';
    $('#p-id').value = p ? p.id : ''; $('#p-name').value = p ? p.name : '';
    $('#p-cat').value = p ? p.cat : 'Beef'; $('#p-type').value = p ? p.type : 'packaged';
    $('#p-price').value = p && p.type === 'packaged' ? p.price : '';
    $('#p-unit').value = p ? p.unit : ''; $('#p-ppk').value = p && p.price_per_kg ? p.price_per_kg : '';
    $('#p-weight').value = p && p.weight_kg ? p.weight_kg : ''; $('#p-stock').value = p ? p.stock : 0;
    $('#p-badge').value = p ? p.badge : ''; $('#p-desc').value = p ? (p.description || '') : '';
    $('#p-active').checked = p ? !!p.active : true;
    syncType();
    LH.open($('#prod-modal'), $('#scrim-prod'));
  }
  function syncType() { var live = $('#p-type').value === 'livestock'; $('#livestock-fields').hidden = !live; $('#packaged-fields').hidden = live; }

  /* ---------- boot ---------- */
  LH.boot().then(function (who) {
    me = who;
    if (!me) { location.href = 'login.html?next=vendor.html'; return; }
    if (me.role !== 'vendor') { location.href = me.role === 'admin' ? 'admin.html' : 'account.html'; return; }
    panel = $('#panel');
    $('#vendor-name').textContent = me.vendor_name || 'Your farm';

    LH.tabs({ overview: overview, products: products, orders: orders, earnings: earnings, payouts: payouts, analytics: analytics, awal: awal, profile: profile, support: support, security: security }, 'overview');
    var go = function (t) { location.hash = t; };

    $('#p-type').addEventListener('change', syncType);
    $('#prod-close').addEventListener('click', function () { LH.close($('#prod-modal'), $('#scrim-prod')); });
    $('#scrim-prod').addEventListener('click', function () { LH.close($('#prod-modal'), $('#scrim-prod')); });

    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-goto],[data-edit],[data-del],[data-fulfill],[data-ticket-new],[data-ticket]');
      if (!t) return; var d = t.dataset;
      if (d.goto) go(d.goto);
      else if (d.edit) openProd(window.__vp[d.edit]);
      else if (d.del) { if (confirm('Delete this product? This cannot be undone.')) api('/api/vendor/products/' + d.del, { method: 'DELETE' }).then(function () { LH.toast('Product deleted'); products(); }); }
      else if (d.fulfill) POST('/api/vendor/orders/' + d.fulfill + '/fulfill', { status: d.next }).then(function () { LH.toast('Marked ' + d.next); orders(); }).catch(function (er) { LH.toast(er.message); });
      else if (d.ticketNew !== undefined) ticketForm();
      else if (d.ticket) ticketView(d.ticket);
    });

    $('#prod-form').addEventListener('submit', function (e) {
      e.preventDefault(); var err = $('#prod-err'); err.hidden = true;
      var body = { name: $('#p-name').value.trim(), cat: $('#p-cat').value, type: $('#p-type').value, unit: $('#p-unit').value.trim(), stock: $('#p-stock').value, badge: $('#p-badge').value.trim(), description: $('#p-desc').value.trim(), active: $('#p-active').checked };
      if (body.type === 'livestock') { body.price_per_kg = $('#p-ppk').value; body.weight_kg = $('#p-weight').value; } else { body.price = $('#p-price').value; }
      var id = $('#p-id').value;
      var req = id ? api('/api/vendor/products/' + id, { method: 'PATCH', body: body }) : POST('/api/vendor/products', body);
      req.then(function () { LH.close($('#prod-modal'), $('#scrim-prod')); LH.toast(id ? 'Product updated' : 'Product added'); location.hash = 'products'; products(); })
        .catch(function (er) { err.textContent = er.message; err.hidden = false; });
    });
  });
})();
