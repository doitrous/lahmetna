/* Admin console — operations for the whole marketplace */
(function () {
  'use strict';
  var esc = LH.esc, money = LH.money, api = LH.api, POST = LH.POST, $ = LH.$, card = LH.card, st = LH.st;
  var me = null, panel;
  function empty(msg) { return '<div class="card" style="padding:40px;text-align:center"><p class="muted">' + msg + '</p></div>'; }
  function pct(x) { return (x * 100).toFixed(x * 100 % 1 ? 1 : 0) + '%'; }

  /* ---------- OVERVIEW ---------- */
  function overview() {
    api('/api/admin/overview').then(function (o) {
      panel.innerHTML = '<div class="stat-cards">' +
        card(money(o.gmv), 'GMV') + card(money(o.commission), 'Commission earned') + card(o.orders, 'Orders') + card(o.paidOrders, 'Paid orders') +
        card(o.customers, 'Customers') + card(o.activeVendors + '/' + o.vendors, 'Active vendors') + card(o.products, 'Products') +
        card(o.oneMembers, 'One members') + card(o.awalVendors, 'Awal vendors') + card(o.openTickets, 'Open tickets') +
        card(money(o.pendingPayout), 'Pending payouts') + card(o.pendingApplications, 'Applications') + '</div>' +
        '<div class="grid cols-2" style="margin-top:22px;gap:16px">' +
          (o.pendingApplications ? '<div class="card" style="padding:20px 24px"><div class="row between"><div><strong class="display" style="font-size:16px">' + o.pendingApplications + ' application' + (o.pendingApplications > 1 ? 's' : '') + ' to review</strong><div class="muted" style="font-size:13px;margin-top:4px">Approve to onboard new vendors.</div></div><button class="btn btn-primary btn-sm" data-goto="applications">Review</button></div></div>' : '') +
          (o.openTickets ? '<div class="card" style="padding:20px 24px"><div class="row between"><div><strong class="display" style="font-size:16px">' + o.openTickets + ' open support ticket' + (o.openTickets > 1 ? 's' : '') + '</strong><div class="muted" style="font-size:13px;margin-top:4px">Customers and vendors awaiting a reply.</div></div><button class="btn btn-primary btn-sm" data-goto="support">Open queue</button></div></div>' : '') +
          (o.pendingPayout ? '<div class="card" style="padding:20px 24px"><div class="row between"><div><strong class="display" style="font-size:16px">' + money(o.pendingPayout) + ' owed to vendors</strong><div class="muted" style="font-size:13px;margin-top:4px">Settle pending payouts.</div></div><button class="btn btn-primary btn-sm" data-goto="payouts">Settle</button></div></div>' : '') +
        '</div>';
    });
  }

  /* ---------- ORDERS ---------- */
  function orders() {
    api('/api/admin/orders').then(function (list) {
      panel.innerHTML = '<h3 class="display" style="font-size:18px">Orders (' + list.length + ')</h3>' +
        (list.length ? '<div class="card" style="margin-top:16px;padding:6px"><table class="tbl"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Total</th><th>Method</th><th>Fulfillment</th><th></th></tr></thead><tbody>' +
          list.map(function (o) {
            return '<tr><td data-label="Order"><strong>' + esc(o.id) + '</strong></td><td data-label="Date">' + esc(o.created.slice(0, 10)) + '</td>' +
              '<td data-label="Customer">' + esc(o.name) + '</td><td data-label="Total" class="num">' + money(o.total) + '</td>' +
              '<td data-label="Method">' + (o.method === 'cod' ? 'COD' : 'Card') + '</td>' +
              '<td data-label="Fulfillment">' + st(o.fulfillment || o.status) + '</td>' +
              '<td data-label=""><button class="btn btn-outline btn-sm" data-order="' + esc(o.id) + '">Manage</button></td></tr>';
          }).join('') + '</tbody></table></div>' : empty('No orders yet.'));
    });
  }
  var FLOW = ['confirmed', 'packed', 'shipped', 'delivered'];
  function orderDetail(id) {
    api('/api/admin/orders/' + id).then(function (o) {
      var tl = []; try { tl = JSON.parse(o.timeline || '[]'); } catch (e) {}
      var ff = o.fulfillment || 'processing';
      var next = FLOW[FLOW.indexOf(ff) + 1] || (ff === 'processing' ? 'confirmed' : null);
      var done = o.status === 'refunded' || o.status === 'cancelled';
      LH.modal('<div style="padding:24px 26px;max-height:84vh;overflow:auto"><div class="row between"><div><strong class="display" style="font-size:20px">' + esc(o.id) + '</strong><div class="muted" style="font-size:12.5px;margin-top:2px">' + esc(o.created.slice(0, 16).replace('T', ' ')) + ' · ' + st(o.fulfillment || o.status) + '</div></div><button class="icon-btn" data-close>✕</button></div>' +
        '<div class="muted" style="font-size:13px;margin-top:10px">' + esc(o.customer ? o.customer.name : o.name) + ' · ' + esc(o.phone) + '<br>' + esc(o.address) + '</div>' +
        '<table class="tbl" style="margin-top:14px"><thead><tr><th>Item</th><th>Qty</th><th>Line</th><th>Comm.</th><th>Net</th></tr></thead><tbody>' + (o.items || []).map(function (i) {
          return '<tr><td>' + esc(i.name) + '</td><td class="num">' + i.qty + '</td><td class="num">' + money(i.line_total) + '</td><td class="num">−' + money(i.commission) + '</td><td class="num">' + money(i.net) + '</td></tr>';
        }).join('') + '</tbody></table>' +
        '<dl class="deflist" style="margin-top:14px"><dt>Subtotal</dt><dd>' + money(o.subtotal) + '</dd>' + (o.discount ? '<dt>Discount' + (o.coupon_code ? ' (' + esc(o.coupon_code) + ')' : '') + '</dt><dd>−' + money(o.discount) + '</dd>' : '') + '<dt>Delivery</dt><dd>' + (o.delivery ? money(o.delivery) : 'Free') + '</dd><dt style="font-weight:600">Total</dt><dd style="font-weight:600">' + money(o.total) + '</dd>' + (o.refund ? '<dt>Refunded</dt><dd>' + money(o.refund) + '</dd>' : '') + '</dl>' +
        (tl.length ? '<div class="eyebrow" style="margin-top:18px">Timeline</div><ul class="timeline" style="margin-top:8px">' + tl.map(function (t) { return '<li><strong style="text-transform:capitalize">' + esc(t.status) + '</strong><div class="when">' + esc((t.at || '').slice(0, 16).replace('T', ' ')) + (t.note ? ' · ' + esc(t.note) : '') + '</div></li>'; }).join('') + '</ul>' : '') +
        (done ? '' : '<div class="row" style="gap:10px;margin-top:18px;flex-wrap:wrap">' +
          (next ? '<button class="btn btn-primary btn-sm" data-ff="' + esc(id) + '" data-next="' + next + '">Mark ' + next + '</button>' : '') +
          '<button class="btn btn-outline btn-sm" data-refund="' + esc(id) + '">Refund</button>' +
          '<button class="btn btn-outline btn-sm" data-cancel="' + esc(id) + '" style="color:#8e203f">Cancel order</button></div>') + '</div>');
    });
  }

  /* ---------- CATALOG ---------- */
  function catalog() {
    api('/api/admin/catalog').then(function (list) {
      panel.innerHTML = '<h3 class="display" style="font-size:18px">Catalog (' + list.length + ')</h3>' +
        '<div class="card" style="margin-top:16px;padding:6px"><table class="tbl"><thead><tr><th>Product</th><th>Vendor</th><th>Category</th><th>Price</th><th>Status</th><th></th></tr></thead><tbody>' +
        list.map(function (p) {
          return '<tr><td data-label="Product"><strong>' + esc(p.name.split(' · ')[0]) + '</strong></td><td data-label="Vendor">' + esc(p.vendor_slug || p.vendor_id) + '</td>' +
            '<td data-label="Category">' + esc(p.cat) + '</td><td data-label="Price" class="num">' + (p.type === 'livestock' ? money(p.price_per_kg) + '/kg' : money(p.price)) + '</td>' +
            '<td data-label="Status">' + (p.active ? st('active') : st('pending')) + '</td>' +
            '<td data-label="" style="white-space:nowrap"><button class="btn btn-outline btn-sm" data-toggle="' + esc(p.id) + '" data-active="' + (p.active ? 0 : 1) + '">' + (p.active ? 'Hide' : 'Show') + '</button> <button class="btn btn-outline btn-sm" data-pdel="' + esc(p.id) + '" style="color:#8e203f">Delete</button></td></tr>';
        }).join('') + '</tbody></table></div>';
    });
  }

  /* ---------- VENDORS ---------- */
  function vendors() {
    api('/api/admin/vendors').then(function (list) {
      panel.innerHTML = '<h3 class="display" style="font-size:18px">Vendors (' + list.length + ')</h3>' +
        '<div class="card" style="margin-top:16px;padding:6px"><table class="tbl"><thead><tr><th>Vendor</th><th>Status</th><th>Plan</th><th>Commission</th><th>Products</th><th>Revenue</th><th></th></tr></thead><tbody>' +
        list.map(function (v) {
          return '<tr><td data-label="Vendor"><strong>' + esc(v.name) + '</strong><div class="muted" style="font-size:12px">' + esc(v.location || '') + '</div></td>' +
            '<td data-label="Status">' + st(v.status === 'active' ? 'active' : 'pending') + (v.featured ? ' <span class="badge">★</span>' : '') + '</td>' +
            '<td data-label="Plan">' + (v.plan === 'awal' ? 'Awal' : '—') + '</td>' +
            '<td data-label="Commission" class="num">' + (v.commission_rate != null ? pct(v.commission_rate) : '—') + '</td>' +
            '<td data-label="Products" class="num">' + v.products + '</td><td data-label="Revenue" class="num">' + money(v.revenue) + '</td>' +
            '<td data-label=""><button class="btn btn-outline btn-sm" data-vendor="' + v.id + '">Manage</button></td></tr>';
        }).join('') + '</tbody></table></div>';
      window.__vend = {}; list.forEach(function (v) { window.__vend[v.id] = v; });
    });
  }
  function vendorDetail(id) {
    var v = window.__vend[id];
    LH.modal('<div style="padding:24px 26px"><div class="row between"><strong class="display" style="font-size:20px">' + esc(v.name) + '</strong><button class="icon-btn" data-close>✕</button></div>' +
      '<div class="muted" style="font-size:13px;margin-top:2px">' + esc(v.email || '') + ' · ' + esc(v.location || '') + '</div>' +
      '<form id="v-form" style="margin-top:18px"><div class="field-row"><div><label class="label">Commission rate (%)</label><input class="field" name="commission_rate" type="number" step="0.01" min="0" max="1" value="' + (v.commission_rate != null ? v.commission_rate : '') + '" placeholder="e.g. 0.12"></div>' +
      '<div><label class="label">Featured store</label><select class="field" name="featured"><option value="0"' + (v.featured ? '' : ' selected') + '>No</option><option value="1"' + (v.featured ? ' selected' : '') + '>Yes</option></select></div></div>' +
      '<label class="row" style="gap:8px;margin-top:16px;font-size:14px;cursor:pointer"><input type="checkbox" name="suspended" ' + (v.status === 'suspended' ? 'checked' : '') + '> Suspend this vendor</label>' +
      '<div class="row" style="gap:10px;margin-top:18px"><button class="btn btn-primary btn-sm">Save changes</button></div></form></div>');
    $('#v-form').addEventListener('submit', function (e) {
      e.preventDefault(); var f = this;
      var b = { commission_rate: f.commission_rate.value === '' ? null : parseFloat(f.commission_rate.value), featured: f.featured.value === '1', suspended: f.suspended.checked };
      api('/api/admin/vendors/' + id, { method: 'PATCH', body: b }).then(function () { LH.close($('#lh-modal'), $('#lh-mscrim')); LH.toast('Vendor updated'); vendors(); });
    });
  }

  /* ---------- CUSTOMERS ---------- */
  function customers() {
    api('/api/admin/customers').then(function (list) {
      panel.innerHTML = '<h3 class="display" style="font-size:18px">Customers (' + list.length + ')</h3>' +
        '<div class="card" style="margin-top:16px;padding:6px"><table class="tbl"><thead><tr><th>Customer</th><th>Member</th><th>Orders</th><th>Spend</th><th>Status</th><th></th></tr></thead><tbody>' +
        list.map(function (c) {
          return '<tr><td data-label="Customer"><strong>' + esc(c.name) + '</strong><div class="muted" style="font-size:12px">' + esc(c.email) + '</div></td>' +
            '<td data-label="Member">' + (c.plan === 'one' && c.plan_status === 'active' ? '<span class="badge">One</span>' : '—') + '</td>' +
            '<td data-label="Orders" class="num">' + c.orders + '</td><td data-label="Spend" class="num">' + money(c.spend) + '</td>' +
            '<td data-label="Status">' + (c.suspended ? st('cancelled') : st('active')) + '</td>' +
            '<td data-label=""><button class="btn btn-outline btn-sm" data-cust="' + c.id + '">' + (c.suspended ? 'Unsuspend' : 'Suspend') + '</button></td></tr>';
        }).join('') + '</tbody></table></div>';
      window.__cust = {}; list.forEach(function (c) { window.__cust[c.id] = c; });
    });
  }

  /* ---------- APPLICATIONS ---------- */
  function applications() {
    api('/api/admin/applications').then(function (list) {
      if (!list.length) { panel.innerHTML = empty('No applications yet.'); return; }
      panel.innerHTML = '<h3 class="display" style="font-size:18px">Vendor applications</h3><div style="margin-top:16px;display:flex;flex-direction:column;gap:14px">' +
        list.map(function (a) {
          return '<div class="card" style="padding:20px 22px"><div class="row between" style="align-items:flex-start;gap:16px"><div style="flex:1">' +
            '<div class="row" style="gap:10px;align-items:center"><strong class="display" style="font-size:17px">' + esc(a.farm_name) + '</strong>' + st(a.status) + '</div>' +
            '<div class="muted" style="font-size:13.5px;margin-top:6px">' + esc(a.contact_name) + ' · ' + esc(a.email) + ' · ' + esc(a.phone) + '</div>' +
            '<div class="muted" style="font-size:13.5px;margin-top:2px">' + esc(a.location) + (a.categories ? ' · ' + esc(a.categories) : '') + '</div>' +
            (a.message ? '<p style="font-size:14px;line-height:1.55;margin-top:10px">' + esc(a.message) + '</p>' : '') + '</div>' +
            '<div style="white-space:nowrap">' + (a.status === 'pending' ? '<button class="btn btn-primary btn-sm" data-approve="' + a.id + '">Approve</button> <button class="btn btn-outline btn-sm" data-reject="' + a.id + '" style="color:#8e203f">Reject</button>' : (a.status === 'approved' ? '<span class="muted" style="font-size:13px">Vendor created</span>' : '<span class="muted" style="font-size:13px">Declined</span>')) + '</div>' +
          '</div></div>';
        }).join('') + '</div>';
    });
  }

  /* ---------- SUPPORT QUEUE ---------- */
  function support() {
    api('/api/tickets').then(function (list) {
      panel.innerHTML = '<h3 class="display" style="font-size:18px">Support queue (' + list.length + ')</h3>' +
        (list.length ? '<div class="card" style="margin-top:16px;padding:6px"><table class="tbl"><thead><tr><th>Subject</th><th>From</th><th>Priority</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>' +
          list.map(function (t) {
            return '<tr><td data-label="Subject"><strong>' + esc(t.subject) + '</strong></td><td data-label="From">' + esc(t.user_name || '') + '<div class="muted" style="font-size:12px">' + esc(t.role) + '</div></td>' +
              '<td data-label="Priority">' + (t.priority === 'high' ? st('high') : '<span class="muted" style="font-size:12.5px">normal</span>') + '</td>' +
              '<td data-label="Status">' + st(t.status) + '</td><td data-label="Updated">' + esc((t.updated || t.created).slice(0, 10)) + '</td>' +
              '<td data-label=""><button class="btn btn-outline btn-sm" data-ticket="' + t.id + '">Open</button></td></tr>';
          }).join('') + '</tbody></table></div>' : empty('No tickets in the queue.'));
    });
  }
  function ticketView(id) {
    api('/api/tickets/' + id).then(function (t) {
      LH.modal('<div style="padding:24px 26px;display:flex;flex-direction:column;max-height:82vh"><div class="row between"><div><strong class="display" style="font-size:19px">' + esc(t.subject) + '</strong><div class="muted" style="font-size:12.5px;margin-top:2px">' + esc(t.user_name || '') + ' · ' + esc(t.role) + (t.order_id ? ' · ' + esc(t.order_id) : '') + '</div></div><button class="icon-btn" data-close>✕</button></div>' +
        '<div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">' +
          '<select class="field" id="tk-status" style="width:auto;min-height:38px"><option value="open"' + (t.status === 'open' ? ' selected' : '') + '>Open</option><option value="pending"' + (t.status === 'pending' ? ' selected' : '') + '>Awaiting customer</option><option value="resolved"' + (t.status === 'resolved' ? ' selected' : '') + '>Resolved</option><option value="closed"' + (t.status === 'closed' ? ' selected' : '') + '>Closed</option></select>' +
          '<button class="btn btn-outline btn-sm" id="tk-prio">' + (t.priority === 'high' ? 'Set normal' : 'Set high') + '</button></div>' +
        '<div style="flex:1;overflow:auto;margin-top:14px">' + LH.ticketThread(t.messages, me.id) + '</div>' +
        '<form id="tk-reply" style="margin-top:16px"><textarea class="field" name="body" required placeholder="Reply to customer…" style="min-height:70px"></textarea><button class="btn btn-primary btn-sm" style="margin-top:10px">Send reply</button></form></div>');
      $('#tk-reply').addEventListener('submit', function (e) { e.preventDefault(); POST('/api/tickets/' + id + '/messages', { body: this.body.value }).then(function () { ticketView(id); }); });
      $('#tk-status').addEventListener('change', function () { POST('/api/tickets/' + id + '/status', { status: this.value }).then(function () { LH.toast('Status updated'); }); });
      $('#tk-prio').addEventListener('click', function () { POST('/api/tickets/' + id + '/priority', { priority: t.priority === 'high' ? 'normal' : 'high' }).then(function () { ticketView(id); }); });
    });
  }

  /* ---------- PAYOUTS ---------- */
  function payouts() {
    api('/api/admin/payouts').then(function (d) {
      panel.innerHTML = '<h3 class="display" style="font-size:18px">Payouts</h3>' +
        '<div class="eyebrow" style="margin-top:16px">Pending balances</div>' +
        (d.pending.length ? '<div class="card" style="margin-top:10px;padding:6px"><table class="tbl"><thead><tr><th>Vendor</th><th>Owed</th><th></th></tr></thead><tbody>' +
          d.pending.map(function (p) { return '<tr><td data-label="Vendor"><strong>' + esc(p.vendor_name) + '</strong></td><td data-label="Owed" class="num">' + money(p.pending) + '</td><td data-label=""><button class="btn btn-primary btn-sm" data-pay="' + p.vendor_id + '">Create payout</button></td></tr>'; }).join('') + '</tbody></table></div>'
          : '<p class="muted" style="margin-top:10px">No pending balances.</p>') +
        '<div class="eyebrow" style="margin-top:24px">Payout history</div>' +
        (d.history.length ? '<div class="card" style="margin-top:10px;padding:6px"><table class="tbl"><thead><tr><th>#</th><th>Vendor</th><th>Amount</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>' +
          d.history.map(function (p) { return '<tr><td data-label="#"><strong>' + p.id + '</strong></td><td data-label="Vendor">' + esc(p.vendor_name) + '</td><td data-label="Amount" class="num">' + money(p.amount) + '</td><td data-label="Status">' + st(p.status === 'paid' ? 'paid' : 'processing') + '</td><td data-label="Created">' + esc(p.created.slice(0, 10)) + '</td><td data-label="">' + (p.status !== 'paid' ? '<button class="btn btn-outline btn-sm" data-settle="' + p.id + '">Mark paid</button>' : '<span class="muted" style="font-size:12.5px">' + esc((p.paid_at || '').slice(0, 10)) + '</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>'
          : '<p class="muted" style="margin-top:10px">No payouts yet.</p>');
    });
  }

  /* ---------- SUBSCRIPTIONS ---------- */
  function subscriptions() {
    api('/api/admin/subscriptions').then(function (list) {
      panel.innerHTML = '<h3 class="display" style="font-size:18px">Subscriptions (' + list.length + ')</h3>' +
        (list.length ? '<div class="card" style="margin-top:16px;padding:6px"><table class="tbl"><thead><tr><th>Subscriber</th><th>Plan</th><th>Price</th><th>Status</th><th>Started</th><th>Renews</th></tr></thead><tbody>' +
          list.map(function (s) {
            return '<tr><td data-label="Subscriber"><strong>' + esc(s.subscriber_name || s.subscriber_ref || ('#' + s.subscriber_id)) + '</strong><div class="muted" style="font-size:12px">' + esc(s.subscriber_type) + '</div></td>' +
              '<td data-label="Plan">' + (s.plan === 'awal' ? 'Awal' : 'One') + '</td><td data-label="Price" class="num">' + money(s.price) + '</td>' +
              '<td data-label="Status">' + st(s.status === 'active' ? 'active' : (s.status === 'cancelled' ? 'cancelled-sub' : 'expired')) + '</td>' +
              '<td data-label="Started">' + esc((s.started || '').slice(0, 10)) + '</td><td data-label="Renews">' + esc((s.renews || '').slice(0, 10)) + '</td></tr>';
          }).join('') + '</tbody></table></div>' : empty('No subscriptions yet.'));
    });
  }

  /* ---------- MARKETING (coupons) ---------- */
  function marketing() {
    api('/api/admin/coupons').then(function (list) {
      panel.innerHTML = '<div class="row between"><h3 class="display" style="font-size:18px">Coupons</h3><button class="btn btn-primary btn-sm" data-coupon-new>+ New coupon</button></div>' +
        (list.length ? '<div class="card" style="margin-top:16px;padding:6px"><table class="tbl"><thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Min order</th><th>Used</th><th>Status</th><th></th></tr></thead><tbody>' +
          list.map(function (c) {
            return '<tr><td data-label="Code"><strong>' + esc(c.code) + '</strong></td><td data-label="Type">' + esc(c.kind) + '</td>' +
              '<td data-label="Value" class="num">' + (c.kind === 'percent' ? c.value + '%' : money(c.value)) + '</td><td data-label="Min order" class="num">' + money(c.min_order) + '</td>' +
              '<td data-label="Used" class="num">' + c.used + (c.usage_limit ? '/' + c.usage_limit : '') + '</td>' +
              '<td data-label="Status">' + (c.active ? st('active') : st('closed')) + '</td>' +
              '<td data-label=""><button class="btn btn-outline btn-sm" data-coupon-toggle="' + esc(c.code) + '" data-on="' + (c.active ? 0 : 1) + '">' + (c.active ? 'Disable' : 'Enable') + '</button></td></tr>';
          }).join('') + '</tbody></table></div>' : empty('No coupons yet.'));
    });
  }
  function couponForm() {
    LH.modal('<form id="cp-form" style="padding:24px 26px"><div class="row between"><strong class="display" style="font-size:20px">New coupon</strong><button type="button" class="icon-btn" data-close>✕</button></div>' +
      '<div class="form-row"><label class="label">Code</label><input class="field" name="code" required placeholder="WELCOME10" style="text-transform:uppercase"></div>' +
      '<div class="field-row" style="margin-top:14px"><div><label class="label">Type</label><select class="field" name="kind"><option value="percent">Percent off</option><option value="flat">Flat amount</option></select></div><div><label class="label">Value</label><input class="field" name="value" type="number" min="1" required></div></div>' +
      '<div class="field-row" style="margin-top:14px"><div><label class="label">Min order (EGP)</label><input class="field" name="min_order" type="number" min="0" value="0"></div><div><label class="label">Usage limit (optional)</label><input class="field" name="usage_limit" type="number" min="1"></div></div>' +
      '<div class="form-error" id="cp-err" hidden></div><button class="btn btn-primary btn-block" style="margin-top:18px">Create coupon</button></form>');
    $('#cp-form').addEventListener('submit', function (e) {
      e.preventDefault(); var f = this;
      var b = { code: f.code.value.toUpperCase(), kind: f.kind.value, value: f.value.value, min_order: f.min_order.value, usage_limit: f.usage_limit.value || null };
      POST('/api/admin/coupons', b).then(function () { LH.close($('#lh-modal'), $('#lh-mscrim')); LH.toast('Coupon created'); marketing(); })
        .catch(function (er) { var el = $('#cp-err'); el.textContent = er.message; el.hidden = false; });
    });
  }

  /* ---------- LEGAL PAGES ---------- */
  function legal() {
    api('/api/admin/pages').then(function (list) {
      panel.innerHTML = '<h3 class="display" style="font-size:18px">Legal &amp; policy pages</h3>' +
        '<p class="muted" style="font-size:13.5px;margin-top:6px">Edit the content of each public policy page. Saved changes go live immediately on the site.</p>' +
        '<div class="card" style="margin-top:16px;padding:6px"><table class="tbl"><thead><tr><th>Page</th><th>Public URL</th><th>Updated</th><th></th></tr></thead><tbody>' +
        list.map(function (p) {
          return '<tr><td data-label="Page"><strong>' + esc(p.title) + '</strong></td>' +
            '<td data-label="URL"><a href="legal.html?doc=' + esc(p.slug) + '" target="_blank">/legal.html?doc=' + esc(p.slug) + '</a></td>' +
            '<td data-label="Updated">' + esc((p.updated || '').slice(0, 10)) + '</td>' +
            '<td data-label=""><button class="btn btn-outline btn-sm" data-page="' + esc(p.slug) + '">Edit</button></td></tr>';
        }).join('') + '</tbody></table></div>';
    });
  }
  function pageEditor(slug) {
    api('/api/admin/pages/' + slug).then(function (p) {
      LH.modal('<form id="pg-form" style="padding:24px 26px;width:780px;max-width:94vw"><div class="row between"><strong class="display" style="font-size:20px">Edit: ' + esc(p.title) + '</strong><button type="button" class="icon-btn" data-close>✕</button></div>' +
        '<div class="form-row"><label class="label">Title</label><input class="field" name="title" value="' + esc(p.title) + '"></div>' +
        '<div class="form-row"><label class="label">Body (HTML)</label><textarea class="field" name="body" spellcheck="false" style="min-height:340px;font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.5">' + esc(p.body) + '</textarea></div>' +
        '<p class="muted" style="font-size:12px">Write HTML — <code>&lt;h2&gt;</code> headings, <code>&lt;p&gt;</code> paragraphs, <code>&lt;ul&gt;&lt;li&gt;</code> lists. Replace the [bracketed] placeholders with your own wording.</p>' +
        '<div class="form-error" id="pg-err" hidden></div>' +
        '<div class="row" style="gap:10px;margin-top:8px"><button class="btn btn-primary btn-sm">Save page</button><a class="btn btn-outline btn-sm" href="legal.html?doc=' + esc(slug) + '" target="_blank">Preview</a></div></form>');
      $('#pg-form').addEventListener('submit', function (e) {
        e.preventDefault();
        api('/api/admin/pages/' + slug, { method: 'PATCH', body: { title: this.title.value, body: this.body.value } })
          .then(function () { LH.close($('#lh-modal'), $('#lh-mscrim')); LH.toast('Page saved'); legal(); })
          .catch(function (er) { var el = $('#pg-err'); el.textContent = er.message; el.hidden = false; });
      });
    });
  }

  /* ---------- SETTINGS ---------- */
  var SETTING_LABELS = {
    commission_rate: 'Standard commission (0–1)', awal_commission_rate: 'Awal commission (0–1)',
    one_price: 'Lahmetna One price (EGP/mo)', awal_price: 'Lahmetna Awal price (EGP/mo)',
    member_discount: 'One member discount (0–1)', delivery_fee: 'Delivery fee (EGP)',
    free_over: 'Free delivery over (EGP)', member_free_delivery_over: 'Member free delivery over (EGP)',
    slaughter_fee: 'Slaughter fee (EGP)'
  };
  function settings() {
    api('/api/admin/settings').then(function (s) {
      panel.innerHTML = '<h3 class="display" style="font-size:18px">Platform settings</h3>' +
        '<form class="card" id="set-form" style="margin-top:16px;padding:24px 26px;max-width:640px"><div class="field-row">' +
        Object.keys(SETTING_LABELS).map(function (k) {
          return '<div style="margin-top:6px"><label class="label">' + SETTING_LABELS[k] + '</label><input class="field" name="' + k + '" value="' + esc(s[k] != null ? s[k] : '') + '"></div>';
        }).join('') + '</div><div class="form-error" id="set-err" hidden></div><button class="btn btn-primary btn-sm" style="margin-top:18px">Save settings</button></form>';
      $('#set-form').addEventListener('submit', function (e) {
        e.preventDefault(); var b = {}; new FormData(this).forEach(function (v, k) { b[k] = v; });
        api('/api/admin/settings', { method: 'PATCH', body: b }).then(function () { LH.toast('Settings saved'); }).catch(function (er) { var el = $('#set-err'); el.textContent = er.message; el.hidden = false; });
      });
    });
  }

  /* ---------- boot + delegation ---------- */
  LH.boot().then(function (who) {
    me = who;
    if (!me) { location.href = 'login.html?next=admin.html'; return; }
    if (me.role !== 'admin') { location.href = me.role === 'vendor' ? 'vendor.html' : 'account.html'; return; }
    panel = $('#panel');
    var go = LH.tabs({ overview: overview, orders: orders, catalog: catalog, vendors: vendors, customers: customers, applications: applications, support: support, payouts: payouts, subscriptions: subscriptions, marketing: marketing, legal: legal, settings: settings }, 'overview');

    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-goto],[data-order],[data-ff],[data-refund],[data-cancel],[data-toggle],[data-pdel],[data-vendor],[data-cust],[data-approve],[data-reject],[data-ticket],[data-pay],[data-settle],[data-coupon-new],[data-coupon-toggle],[data-page]');
      if (!t) return; var d = t.dataset;
      if (d.goto) go(d.goto);
      else if (d.order) orderDetail(d.order);
      else if (d.ff) POST('/api/admin/orders/' + d.ff + '/fulfill', { status: d.next }).then(function () { LH.close($('#lh-modal'), $('#lh-mscrim')); LH.toast('Marked ' + d.next); orders(); });
      else if (d.refund) { if (confirm('Refund this order in full?')) POST('/api/admin/orders/' + d.refund + '/refund', {}).then(function () { LH.close($('#lh-modal'), $('#lh-mscrim')); LH.toast('Order refunded'); orders(); }); }
      else if (d.cancel) { if (confirm('Cancel this order?')) POST('/api/admin/orders/' + d.cancel + '/cancel', {}).then(function () { LH.close($('#lh-modal'), $('#lh-mscrim')); LH.toast('Order cancelled'); orders(); }); }
      else if (d.toggle) api('/api/admin/catalog/' + d.toggle, { method: 'PATCH', body: { active: d.active === '1' } }).then(catalog);
      else if (d.pdel) { if (confirm('Delete this product permanently?')) api('/api/admin/catalog/' + d.pdel, { method: 'DELETE' }).then(function () { LH.toast('Deleted'); catalog(); }); }
      else if (d.vendor) vendorDetail(d.vendor);
      else if (d.cust) { var c = window.__cust[d.cust]; api('/api/admin/customers/' + d.cust, { method: 'PATCH', body: { suspended: !c.suspended } }).then(function () { LH.toast(c.suspended ? 'Unsuspended' : 'Suspended'); customers(); }); }
      else if (d.approve) POST('/api/admin/applications/' + d.approve + '/approve').then(function () { LH.toast('Approved'); applications(); }).catch(function (er) { LH.toast(er.message); });
      else if (d.reject) { if (confirm('Reject this application?')) POST('/api/admin/applications/' + d.reject + '/reject').then(function () { LH.toast('Rejected'); applications(); }); }
      else if (d.ticket) ticketView(d.ticket);
      else if (d.pay) POST('/api/admin/payouts/create', { vendor_id: parseInt(d.pay, 10) }).then(function () { LH.toast('Payout created'); payouts(); }).catch(function (er) { LH.toast(er.message); });
      else if (d.settle) POST('/api/admin/payouts/' + d.settle + '/settle', {}).then(function () { LH.toast('Marked paid'); payouts(); });
      else if (d.couponNew !== undefined) couponForm();
      else if (d.couponToggle) POST('/api/admin/coupons/toggle', { code: d.couponToggle, active: d.on === '1' }).then(marketing);
      else if (d.page) pageEditor(d.page);
    });
  });
})();
