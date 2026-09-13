/* Customer account — Amazon-shaped console */
(function () {
  'use strict';
  var esc = LH.esc, money = LH.money, api = LH.api, POST = LH.POST, $ = LH.$, card = LH.card, st = LH.st;
  var me = null, panel;

  /* ---------- helpers ---------- */
  function empty(msg, cta) { return '<div class="card" style="padding:40px;text-align:center"><p class="muted">' + msg + '</p>' + (cta || '') + '</div>'; }
  function timelineHTML(o) {
    var tl = []; try { tl = JSON.parse(o.timeline || '[]'); } catch (e) {}
    if (!tl.length) return '';
    return '<ul class="timeline" style="margin-top:8px">' + tl.map(function (t) {
      return '<li><strong style="text-transform:capitalize">' + esc(t.status) + '</strong><div class="when">' + esc((t.at || '').slice(0, 16).replace('T', ' ')) + (t.note ? ' · ' + esc(t.note) : '') + '</div></li>';
    }).join('') + '</ul>';
  }

  /* ---------- OVERVIEW ---------- */
  function overview() {
    Promise.all([api('/api/account/orders'), api('/api/subscriptions')]).then(function (r) {
      var orders = r[0], sub = r[1].subscription, active = sub && sub.status === 'active';
      var spend = orders.filter(function (o) { return o.status !== 'refunded' && o.status !== 'cancelled'; }).reduce(function (s, o) { return s + o.total; }, 0);
      var last = orders[0];
      panel.innerHTML = '<div class="stat-cards">' + card(orders.length, 'Orders placed') + card(money(spend), 'Lifetime spend') +
        card(active ? 'Active' : '—', 'Lahmetna One') + '</div>' +
        (last ? '<div class="card" style="margin-top:22px;padding:22px 26px"><div class="row between"><div><div class="eyebrow">Latest order</div><strong class="display" style="font-size:17px;margin-top:6px;display:block">' + esc(last.id) + ' · ' + money(last.total) + '</strong><div class="muted" style="font-size:13px;margin-top:4px">' + esc(last.created.slice(0, 10)) + ' · ' + st(last.fulfillment || last.status) + '</div></div><button class="btn btn-outline btn-sm" data-goto="orders">View orders</button></div></div>' : '') +
        (!active ? '<div class="card" style="margin-top:18px;padding:22px 26px;background:var(--soft)"><div class="row between" style="gap:16px;flex-wrap:wrap"><div><strong class="display" style="font-size:17px">Join Lahmetna One</strong><div class="muted" style="font-size:13.5px;margin-top:4px">Free delivery, 7% member pricing, priority support.</div></div><button class="btn btn-primary btn-sm" data-goto="one">See benefits</button></div></div>' : '');
    });
  }

  /* ---------- ORDERS ---------- */
  function orders() {
    api('/api/account/orders').then(function (list) {
      panel.innerHTML = '<h3 class="display" style="font-size:18px">Order history</h3>' +
        (list.length ? '<div class="card" style="margin-top:16px;padding:6px"><table class="tbl"><thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Total</th><th></th></tr></thead><tbody>' +
          list.map(function (o) {
            return '<tr><td data-label="Order"><strong>' + esc(o.id) + '</strong></td><td data-label="Date">' + esc(o.created.slice(0, 10)) + '</td>' +
              '<td data-label="Status">' + st(o.fulfillment || o.status) + '</td><td data-label="Total" class="num">' + money(o.total) + '</td>' +
              '<td data-label="" style="white-space:nowrap"><button class="btn btn-outline btn-sm" data-order="' + esc(o.id) + '">Details</button></td></tr>';
          }).join('') + '</tbody></table></div>'
          : empty('No orders yet.', '<a class="btn btn-primary btn-sm" href="index.html#shop" style="margin-top:12px">Start shopping</a>'));
    });
  }
  function orderDetail(id) {
    api('/api/account/orders/' + id).then(function (o) {
      LH.modal('<div style="padding:24px 26px"><div class="row between"><strong class="display" style="font-size:20px">' + esc(o.id) + '</strong><button class="icon-btn" data-close>✕</button></div>' +
        '<div class="muted" style="font-size:13px;margin-top:2px">' + esc(o.created.slice(0, 16).replace('T', ' ')) + ' · ' + st(o.fulfillment || o.status) + '</div>' +
        '<table class="tbl" style="margin-top:16px"><tbody>' + (o.items || []).map(function (i) {
          return '<tr><td>' + esc(i.name) + ' × ' + i.qty + '</td><td class="num">' + money(i.line_total) + '</td></tr>';
        }).join('') + '</tbody></table>' +
        '<dl class="deflist" style="margin-top:16px"><dt>Subtotal</dt><dd>' + money(o.subtotal) + '</dd>' +
        (o.discount ? '<dt>Discount' + (o.coupon_code ? ' (' + esc(o.coupon_code) + ')' : '') + '</dt><dd>−' + money(o.discount) + '</dd>' : '') +
        '<dt>Delivery</dt><dd>' + (o.delivery ? money(o.delivery) : 'Free') + '</dd>' +
        '<dt style="font-weight:600">Total</dt><dd style="font-weight:600">' + money(o.total) + '</dd>' +
        (o.refund ? '<dt>Refunded</dt><dd>' + money(o.refund) + '</dd>' : '') + '</dl>' +
        '<div class="eyebrow" style="margin-top:20px">Tracking</div>' + timelineHTML(o) +
        '<div class="row" style="gap:10px;margin-top:18px"><button class="btn btn-primary btn-sm" data-reorder="' + esc(o.id) + '">Buy again</button><button class="btn btn-outline btn-sm" data-help="' + esc(o.id) + '">Get help with this order</button></div></div>');
    });
  }

  /* ---------- ADDRESSES ---------- */
  function addresses() {
    api('/api/account/addresses').then(function (list) {
      panel.innerHTML = '<div class="row between"><h3 class="display" style="font-size:18px">Addresses</h3><button class="btn btn-primary btn-sm" data-addr-new>+ Add address</button></div>' +
        (list.length ? '<div class="grid cols-2" style="margin-top:16px;gap:16px">' + list.map(function (a) {
          return '<div class="card" style="padding:18px 20px"><div class="row between"><strong>' + esc(a.label || 'Address') + '</strong>' + (a.is_default ? '<span class="badge">Default</span>' : '') + '</div>' +
            '<div class="muted" style="font-size:13.5px;margin-top:8px;line-height:1.6">' + esc(a.name) + '<br>' + esc(a.line1) + (a.line2 ? ', ' + esc(a.line2) : '') + '<br>' + esc(a.city) + (a.governorate ? ', ' + esc(a.governorate) : '') + '<br>' + esc(a.phone) + '</div>' +
            '<div class="row" style="gap:8px;margin-top:14px">' + (a.is_default ? '' : '<button class="btn btn-outline btn-sm" data-addr-def="' + a.id + '">Make default</button>') +
            '<button class="btn btn-outline btn-sm" data-addr-edit="' + a.id + '">Edit</button><button class="btn btn-outline btn-sm" data-addr-del="' + a.id + '" style="color:#8e203f">Delete</button></div></div>';
        }).join('') + '</div>' : empty('No saved addresses yet.'));
      window.__addr = {}; list.forEach(function (a) { window.__addr[a.id] = a; });
    });
  }
  function addrForm(a) {
    a = a || {};
    LH.modal('<form id="addr-form" style="padding:24px 26px"><div class="row between"><strong class="display" style="font-size:20px">' + (a.id ? 'Edit address' : 'Add address') + '</strong><button type="button" class="icon-btn" data-close>✕</button></div>' +
      '<div class="form-row"><label class="label">Label</label><input class="field" name="label" value="' + esc(a.label || '') + '" placeholder="Home, Office…"></div>' +
      '<div class="field-row" style="margin-top:14px"><div><label class="label">Recipient</label><input class="field" name="name" value="' + esc(a.name || me.name) + '"></div><div><label class="label">Phone</label><input class="field" name="phone" value="' + esc(a.phone || me.phone || '') + '"></div></div>' +
      '<div class="form-row"><label class="label">Street address</label><input class="field" name="line1" required value="' + esc(a.line1 || '') + '"></div>' +
      '<div class="form-row"><label class="label">Apartment / floor (optional)</label><input class="field" name="line2" value="' + esc(a.line2 || '') + '"></div>' +
      '<div class="field-row" style="margin-top:14px"><div><label class="label">City</label><input class="field" name="city" value="' + esc(a.city || '') + '"></div><div><label class="label">Governorate</label><input class="field" name="governorate" value="' + esc(a.governorate || '') + '"></div></div>' +
      '<div class="form-error" id="addr-err" hidden></div><button class="btn btn-primary btn-block" style="margin-top:18px">Save address</button></form>');
    $('#addr-form').addEventListener('submit', function (e) {
      e.preventDefault(); var b = {}; new FormData(this).forEach(function (v, k) { b[k] = v; });
      var req = a.id ? api('/api/account/addresses/' + a.id, { method: 'PATCH', body: b }) : POST('/api/account/addresses', b);
      req.then(function () { LH.close($('#lh-modal'), $('#lh-mscrim')); LH.toast('Address saved'); addresses(); })
        .catch(function (er) { var el = $('#addr-err'); el.textContent = er.message; el.hidden = false; });
    });
  }

  /* ---------- PAYMENT METHODS ---------- */
  function payment() {
    api('/api/account/payment-methods').then(function (list) {
      panel.innerHTML = '<div class="row between"><h3 class="display" style="font-size:18px">Payment methods</h3><button class="btn btn-primary btn-sm" data-pm-new>+ Add card</button></div>' +
        '<p class="muted" style="font-size:13px;margin-top:6px">We never store full card numbers — only a secure token, the card brand and last 4 digits.</p>' +
        (list.length ? '<div class="grid cols-2" style="margin-top:16px;gap:16px">' + list.map(function (p) {
          return '<div class="card" style="padding:18px 20px"><div class="row between"><strong>' + esc(p.brand) + ' •••• ' + esc(p.last4) + '</strong>' + (p.is_default ? '<span class="badge">Default</span>' : '') + '</div>' +
            '<div class="muted" style="font-size:13px;margin-top:6px">' + (p.exp_month ? 'Expires ' + p.exp_month + '/' + p.exp_year : 'Tokenized card') + '</div>' +
            '<div class="row" style="gap:8px;margin-top:14px">' + (p.is_default ? '' : '<button class="btn btn-outline btn-sm" data-pm-def="' + p.id + '">Make default</button>') +
            '<button class="btn btn-outline btn-sm" data-pm-del="' + p.id + '" style="color:#8e203f">Remove</button></div></div>';
        }).join('') + '</div>' : empty('No saved cards. You can also pay cash on delivery at checkout.'));
    });
  }
  function pmForm() {
    LH.modal('<form id="pm-form" style="padding:24px 26px"><div class="row between"><strong class="display" style="font-size:20px">Add a card</strong><button type="button" class="icon-btn" data-close>✕</button></div>' +
      '<p class="muted" style="font-size:13px;margin-top:8px">Enter only your card brand and the last 4 digits — never the full number. A secure token stands in for the card.</p>' +
      '<div class="form-row"><label class="label">Card brand</label><select class="field" name="brand"><option>Visa</option><option>Mastercard</option><option>Meeza</option></select></div>' +
      '<div class="field-row" style="margin-top:14px"><div><label class="label">Last 4 digits</label><input class="field" name="last4" maxlength="4" inputmode="numeric" required placeholder="4242"></div><div><label class="label">Expiry</label><div class="row" style="gap:8px"><input class="field" name="exp_month" maxlength="2" inputmode="numeric" placeholder="MM"><input class="field" name="exp_year" maxlength="4" inputmode="numeric" placeholder="YYYY"></div></div></div>' +
      '<div class="form-error" id="pm-err" hidden></div><button class="btn btn-primary btn-block" style="margin-top:18px">Save card</button></form>');
    $('#pm-form').addEventListener('submit', function (e) {
      e.preventDefault(); var b = {}; new FormData(this).forEach(function (v, k) { b[k] = v; });
      POST('/api/account/payment-methods', b).then(function () { LH.close($('#lh-modal'), $('#lh-mscrim')); LH.toast('Card saved'); payment(); })
        .catch(function (er) { var el = $('#pm-err'); el.textContent = er.message; el.hidden = false; });
    });
  }

  /* ---------- LAHMETNA ONE ---------- */
  var ONE_PERKS = [
    ['Free delivery', 'Free cold-chain delivery on member orders over EGP 450.'],
    ['Member pricing', '7% off your subtotal on every order, automatically.'],
    ['Early access', 'Shop the weekly harvest drops before everyone else.'],
    ['Priority support', 'Your tickets jump the queue and are flagged high-priority.']
  ];
  function one() {
    api('/api/subscriptions').then(function (d) {
      var s = d.subscription, active = s && s.status === 'active', cancelled = s && s.status === 'cancelled';
      panel.innerHTML = '<div class="card" style="padding:0;overflow:hidden">' +
        '<div style="background:var(--burgundy);color:#fff;padding:28px 30px"><div class="row between" style="align-items:flex-start"><div>' + LH.planBadge('one') +
          '<h3 class="display" style="font-size:24px;margin-top:12px;color:#fff">Lahmetna One</h3><div style="opacity:.85;font-size:14px;margin-top:4px">' + money(d.price) + ' / month</div></div>' +
          (active || cancelled ? '<span class="st st-' + (active ? 'active' : 'cancelled-sub') + '">' + (active ? 'Active' : 'Cancelling') + '</span>' : '') + '</div></div>' +
        '<div style="padding:24px 30px">' + ONE_PERKS.map(function (p) {
          return '<div class="perk"><div class="ic">✓</div><div><div class="t">' + p[0] + '</div><div class="d">' + p[1] + '</div></div></div>';
        }).join('') +
        (active
          ? '<div class="card" style="margin-top:20px;padding:18px 20px;background:var(--soft)"><div class="row between"><span class="muted">Renews</span><strong>' + esc((s.renews || '').slice(0, 10)) + '</strong></div><button class="btn btn-outline btn-block" id="one-cancel" style="margin-top:14px;color:#8e203f">Cancel membership</button></div>'
          : cancelled
            ? '<div class="card" style="margin-top:20px;padding:18px 20px;background:var(--soft)"><p class="muted" style="font-size:13.5px">Your membership stays active until <strong>' + esc((s.renews || '').slice(0, 10)) + '</strong>, then expires.</p><button class="btn btn-primary btn-block" id="one-sub" style="margin-top:10px">Resume membership</button></div>'
            : '<button class="btn btn-primary btn-block" id="one-sub" style="margin-top:20px;height:50px">Join Lahmetna One · ' + money(d.price) + '/mo</button><p class="muted" style="font-size:12.5px;text-align:center;margin-top:10px">Billed monthly via PayTabs. Cancel anytime.</p>') +
        (d.payments && d.payments.length ? '<div class="eyebrow" style="margin-top:24px">Billing history</div><table class="tbl" style="margin-top:10px"><tbody>' + d.payments.map(function (p) {
          return '<tr><td>' + esc(p.created.slice(0, 10)) + '</td><td>' + esc(p.ref) + '</td><td class="num">' + money(p.amount) + '</td></tr>';
        }).join('') + '</tbody></table>' : '') + '</div></div>';
      var sb = $('#one-sub'); if (sb) sb.addEventListener('click', function () { sb.disabled = true; POST('/api/subscriptions/subscribe', {}).then(function () { LH.toast('Welcome to Lahmetna One!'); LH.loadMe().then(function () { LH.mountChrome({}); }); one(); }).catch(function (e) { LH.toast(e.message); sb.disabled = false; }); });
      var cb = $('#one-cancel'); if (cb) cb.addEventListener('click', function () { if (!confirm('Cancel Lahmetna One? Benefits continue until your renewal date.')) return; POST('/api/subscriptions/cancel', {}).then(function () { LH.toast('Membership cancelled'); one(); }); });
    });
  }

  /* ---------- SUPPORT ---------- */
  function support() {
    api('/api/tickets').then(function (list) {
      panel.innerHTML = '<div class="row between"><h3 class="display" style="font-size:18px">Support</h3><button class="btn btn-primary btn-sm" data-ticket-new>+ New request</button></div>' +
        (list.length ? '<div class="card" style="margin-top:16px;padding:6px"><table class="tbl"><thead><tr><th>Subject</th><th>Category</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>' +
          list.map(function (t) {
            return '<tr><td data-label="Subject"><strong>' + esc(t.subject) + '</strong>' + (t.priority === 'high' ? ' ' + st('high') : '') + '</td><td data-label="Category">' + esc(t.category || '—') + '</td>' +
              '<td data-label="Status">' + st(t.status) + '</td><td data-label="Updated">' + esc((t.updated || t.created).slice(0, 10)) + '</td>' +
              '<td data-label=""><button class="btn btn-outline btn-sm" data-ticket="' + t.id + '">Open</button></td></tr>';
          }).join('') + '</tbody></table></div>' : empty('No support requests yet.'));
    });
  }
  function ticketView(id) {
    api('/api/tickets/' + id).then(function (t) {
      LH.modal('<div style="padding:24px 26px;display:flex;flex-direction:column;max-height:80vh"><div class="row between"><div><strong class="display" style="font-size:19px">' + esc(t.subject) + '</strong><div class="muted" style="font-size:12.5px;margin-top:2px">' + st(t.status) + ' · ' + esc(t.category || 'general') + '</div></div><button class="icon-btn" data-close>✕</button></div>' +
        '<div style="flex:1;overflow:auto;margin-top:8px">' + LH.ticketThread(t.messages, me.id) + '</div>' +
        (t.status === 'closed' ? '<p class="muted" style="font-size:13px;margin-top:14px">This request is closed.</p>' :
          '<form id="tk-reply" style="margin-top:16px"><textarea class="field" name="body" required placeholder="Write a reply…" style="min-height:70px"></textarea><div class="row" style="gap:10px;margin-top:10px"><button class="btn btn-primary btn-sm">Send</button><button type="button" class="btn btn-outline btn-sm" id="tk-close">Close request</button></div></form>') + '</div>');
      var f = $('#tk-reply'); if (f) f.addEventListener('submit', function (e) { e.preventDefault(); POST('/api/tickets/' + id + '/messages', { body: this.body.value }).then(function () { ticketView(id); }); });
      var c = $('#tk-close'); if (c) c.addEventListener('click', function () { POST('/api/tickets/' + id + '/close', {}).then(function () { LH.close($('#lh-modal'), $('#lh-mscrim')); LH.toast('Request closed'); support(); }); });
    });
  }
  function ticketForm(orderId) {
    LH.modal('<form id="tk-form" style="padding:24px 26px"><div class="row between"><strong class="display" style="font-size:20px">New support request</strong><button type="button" class="icon-btn" data-close>✕</button></div>' +
      '<div class="form-row"><label class="label">Subject</label><input class="field" name="subject" required></div>' +
      '<div class="field-row" style="margin-top:14px"><div><label class="label">Category</label><select class="field" name="category"><option value="order">Order</option><option value="delivery">Delivery</option><option value="quality">Product quality</option><option value="billing">Billing</option><option value="other">Other</option></select></div><div><label class="label">Order (optional)</label><input class="field" name="order_id" value="' + esc(orderId || '') + '" placeholder="LH-…"></div></div>' +
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
    panel.innerHTML = '<h3 class="display" style="font-size:18px">Login &amp; security</h3>' +
      '<div class="grid cols-2" style="margin-top:16px;gap:20px">' +
        '<form class="card" id="prof-form" style="padding:22px 24px"><strong>Profile</strong>' +
          '<div class="form-row"><label class="label">Name</label><input class="field" name="name" value="' + esc(me.name) + '"></div>' +
          '<div class="form-row"><label class="label">Phone</label><input class="field" name="phone" value="' + esc(me.phone || '') + '"></div>' +
          '<div class="form-row"><label class="label">Email</label><input class="field" value="' + esc(me.email) + '" disabled></div>' +
          '<button class="btn btn-primary btn-sm" style="margin-top:14px">Save profile</button></form>' +
        '<form class="card" id="pw-form" style="padding:22px 24px"><strong>Change password</strong>' +
          '<div class="form-row"><label class="label">Current password</label><input class="field" type="password" name="current" required></div>' +
          '<div class="form-row"><label class="label">New password</label><input class="field" type="password" name="password" required minlength="6"></div>' +
          '<div class="form-error" id="pw-err" hidden></div><button class="btn btn-primary btn-sm" style="margin-top:14px">Update password</button></form>' +
      '</div><button class="btn btn-outline" id="logout3" style="margin-top:20px">Log out</button>';
    $('#prof-form').addEventListener('submit', function (e) {
      e.preventDefault(); var b = { name: this.name.value, phone: this.phone.value };
      api('/api/account/profile', { method: 'PATCH', body: b }).then(function (u) { me = u.user || u; LH.toast('Profile updated'); LH.loadMe().then(function () { LH.mountChrome({}); }); });
    });
    $('#pw-form').addEventListener('submit', function (e) {
      e.preventDefault(); var f = this;
      POST('/api/account/password', { current: f.current.value, password: f.password.value })
        .then(function () { LH.toast('Password updated'); f.reset(); })
        .catch(function (er) { var el = $('#pw-err'); el.textContent = er.message; el.hidden = false; });
    });
    $('#logout3').addEventListener('click', LH.logout);
  }

  /* ---------- boot + delegation ---------- */
  LH.boot().then(function (who) {
    me = who;
    if (!me) { location.href = 'login.html?next=account.html'; return; }
    if (me.role === 'vendor') { location.href = 'vendor.html'; return; }
    if (me.role === 'admin') { location.href = 'admin.html'; return; }
    panel = $('#panel');
    $('#acct-hello').textContent = 'Hi, ' + me.name.split(' ')[0];

    var go = LH.tabs({ overview: overview, orders: orders, addresses: addresses, payment: payment, one: one, support: support, security: security }, 'overview');

    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-goto],[data-order],[data-reorder],[data-help],[data-addr-new],[data-addr-edit],[data-addr-def],[data-addr-del],[data-pm-new],[data-pm-def],[data-pm-del],[data-ticket-new],[data-ticket]');
      if (!t) return;
      var d = t.dataset;
      if (d.goto) go(d.goto);
      else if (d.order) orderDetail(d.order);
      else if (d.reorder) { api('/api/account/orders/' + d.reorder + '/reorder').then(function (r) { r.items.forEach(function (i) { LH.addToCart(i.id, i.qty); }); LH.close($('#lh-modal'), $('#lh-mscrim')); }); }
      else if (d.help) { LH.close($('#lh-modal'), $('#lh-mscrim')); ticketForm(d.help); }
      else if (d.addrNew !== undefined) addrForm(null);
      else if (d.addrEdit) addrForm(window.__addr[d.addrEdit]);
      else if (d.addrDef) api('/api/account/addresses/' + d.addrDef + '/default', { method: 'PATCH' }).then(addresses);
      else if (d.addrDel) { if (confirm('Delete this address?')) api('/api/account/addresses/' + d.addrDel, { method: 'DELETE' }).then(addresses); }
      else if (d.pmNew !== undefined) pmForm();
      else if (d.pmDef) api('/api/account/payment-methods/' + d.pmDef + '/default', { method: 'PATCH' }).then(payment);
      else if (d.pmDel) { if (confirm('Remove this card?')) api('/api/account/payment-methods/' + d.pmDel, { method: 'DELETE' }).then(payment); }
      else if (d.ticketNew !== undefined) ticketForm('');
      else if (d.ticket) ticketView(d.ticket);
    });
  });
})();
