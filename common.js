/* Lahmetna — shared chrome, cart, auth state and helpers (LH namespace) */
window.LH = (function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var money = function (n) { return 'EGP ' + Number(n || 0).toLocaleString('en-US'); };
  var stars = function (r) { return '<span class="stars"><span style="width:' + (r / 5 * 100) + '%"></span></span>'; };

  function api(path, opts) {
    opts = opts || {}; opts.credentials = 'same-origin';
    if (opts.body && typeof opts.body !== 'string') { opts.headers = Object.assign({ 'content-type': 'application/json' }, opts.headers); opts.body = JSON.stringify(opts.body); }
    return fetch(path, opts).then(function (r) {
      return r.text().then(function (t) { var d; try { d = t ? JSON.parse(t) : {}; } catch (e) { d = {}; } if (!r.ok) { var err = new Error(d.error || ('HTTP ' + r.status)); err.status = r.status; throw err; } return d; });
    });
  }
  function POST(p, b) { return api(p, { method: 'POST', body: b || {} }); }

  /* presentation maps */
  /* round category-tile images (the fun farm photos + real produce shots) */
  var IMG = { Beef: 'assets/cat/beef.webp', 'Lamb & Goat': 'assets/cat/lamb.webp', Poultry: 'assets/cat/poultry.webp', Eggs: 'assets/cat/eggs.webp', Dairy: 'assets/cat/dairy.webp', Vegetables: 'assets/cat/veg.webp', Fruit: 'assets/cat/fruit.webp', Honey: 'assets/cat/honey.webp', Livestock: 'assets/cat/livestock.webp' };
  var TINT = {};
  /* category-level fallback photo when a product's own image is missing */
  var CATIMG = { Beef: 'assets/steak.webp', 'Lamb & Goat': 'assets/steak.webp', Poultry: 'assets/chicken.webp', Eggs: 'assets/eggs.webp', Dairy: 'assets/dairy.webp', Vegetables: 'assets/tomatoes.webp', Fruit: 'assets/oranges.webp', Honey: 'assets/honey.webp', Livestock: 'assets/livestock.webp' };
  function prodImg(p) { return 'assets/products/' + p.id + '.webp'; }
  function fallbackImg(p) { return CATIMG[p.cat] || 'assets/farm-foods.webp'; }
  var ICONS = {
    Vegetables: '<svg width="54" height="54" viewBox="0 0 48 48" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M24 16c-2-6 2-10 8-10 0 6-3 10-8 10z"/><path d="M22 18c-3-2-8-1-10 3-2 5 0 14 6 18 5 3 11 1 14-4 3-6 1-14-4-17-2-1-4-1-6 0z"/></svg>',
    Fruit: '<svg width="54" height="54" viewBox="0 0 48 48" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M24 14c-6-3-14 0-15 8-1 9 6 18 12 18 2 0 2-1 3-1s1 1 3 1c6 0 13-9 12-18-1-8-9-11-15-8z"/><path d="M24 14c0-4 2-7 6-8"/></svg>',
    Honey: '<svg width="52" height="52" viewBox="0 0 48 48" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 12h18l-2 6H17z"/><path d="M17 18v16a4 4 0 004 4h6a4 4 0 004-4V18"/><path d="M24 24v7"/></svg>'
  };
  function media(p, cls) {
    return '<img class="' + (cls || '') + '" src="' + prodImg(p) + '" alt="' + esc(p.name) + '" onerror="this.onerror=null;this.src=\'' + fallbackImg(p) + '\'">';
  }
  function thumb(p, px) {
    px = px || 56;
    return '<img src="' + prodImg(p) + '" onerror="this.onerror=null;this.src=\'' + fallbackImg(p) + '\'" style="width:' + px + 'px;height:' + px + 'px;object-fit:cover;border-radius:8px">';
  }

  /* products cache (for cart display etc.) */
  var byId = {}, productsLoaded = false;
  function getProducts() {
    if (productsLoaded) return Promise.resolve(byId);
    return api('/api/products').then(function (list) { byId = {}; list.forEach(function (p) { byId[p.id] = p; }); productsLoaded = true; LH.byId = byId; return byId; });
  }

  /* cart (localStorage) */
  var cart = {};
  try { cart = JSON.parse(localStorage.getItem('lah_cart') || '{}') || {}; } catch (e) { cart = {}; }
  function saveCart() { try { localStorage.setItem('lah_cart', JSON.stringify(cart)); } catch (e) {} updateBadge(); document.dispatchEvent(new CustomEvent('lh:cart')); }
  function cartQty() { return Object.keys(cart).reduce(function (s, k) { return s + cart[k]; }, 0); }
  function cartTotal() { return Object.keys(cart).reduce(function (s, k) { return s + (byId[k] ? byId[k].price * cart[k] : 0); }, 0); }
  function updateBadge() { var b = $('#lh-cart-count'); if (b) b.textContent = cartQty(); }
  function addToCart(id, qty) {
    cart[id] = (cart[id] || 0) + (qty || 1); saveCart();
    var el = $('#lh-cart-count'); if (el) el.parentElement.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.14)' }, { transform: 'scale(1)' }], { duration: 260 });
    renderCart();
    open($('#lh-cart'), $('#lh-scrim-cart'));
  }
  function setQty(id, n) { if (n <= 0) delete cart[id]; else cart[id] = n; saveCart(); renderCart(); }
  function clearCart() { cart = {}; saveCart(); renderCart(); }
  function cartArray() { return Object.keys(cart).map(function (id) { return { id: id, qty: cart[id] }; }); }

  function renderCart() {
    updateBadge();
    var box = $('#lh-cart-items'); if (!box) return;
    getProducts().then(function () {
      var ids = Object.keys(cart).filter(function (id) { return byId[id]; });
      if (!ids.length) { box.innerHTML = '<div class="muted" style="text-align:center;padding:56px 0;font-size:14px">Your cart is empty.<br>Fresh from the farm is a click away.</div>'; }
      else {
        box.innerHTML = ids.map(function (id) {
          var p = byId[id];
          return '<div class="row" style="gap:12px;padding:14px 0;border-bottom:1px solid var(--line-2);align-items:center">' + thumb(p) +
            '<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:13.5px;line-height:1.3"><a href="product.html?id=' + id + '">' + esc(p.name) + '</a></div>' +
            '<div class="muted" style="font-size:12.5px;margin-top:2px">' + money(p.price) + '</div>' +
            '<div class="qty" style="margin-top:8px"><button data-lh-dec="' + id + '">–</button><span>' + cart[id] + '</span><button data-lh-inc="' + id + '">+</button></div></div>' +
            '<button data-lh-rm="' + id + '" aria-label="Remove" style="width:32px;height:32px;border:none;background:none;color:var(--ink-3);cursor:pointer">✕</button></div>';
        }).join('');
      }
      var tot = $('#lh-cart-total'); if (tot) tot.textContent = money(cartTotal());
    });
  }

  /* toast */
  function toast(msg) {
    var t = $('#lh-toast'); if (!t) { t = document.createElement('div'); t.id = 'lh-toast'; t.className = 'toast'; document.body.appendChild(t); }
    t.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--champagne)" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' + esc(msg);
    t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  /* auth */
  var me = null;
  function loadMe() { return api('/api/auth/me').then(function (d) { me = d.user || null; return me; }).catch(function () { me = null; return null; }); }
  function logout() { return POST('/api/auth/logout').then(function () { me = null; location.href = 'index.html'; }); }

  /* ---------- chrome ---------- */
  var NAV = [
    { l: 'Shop all', href: 'index.html#shop', k: 'all' },
    { l: 'Beef', href: 'index.html?cat=Beef#shop' }, { l: 'Lamb & Goat', href: 'index.html?cat=Lamb%20%26%20Goat#shop' },
    { l: 'Poultry', href: 'index.html?cat=Poultry#shop' }, { l: 'Vegetables', href: 'index.html?cat=Vegetables#shop' },
    { l: 'Fruit', href: 'index.html?cat=Fruit#shop' }, { l: 'Livestock', href: 'index.html?cat=Livestock#shop' },
    { l: 'Reviews', href: 'index.html#reviews' }, { l: 'FAQ', href: 'index.html#faq' }
  ];
  function headerHTML() {
    return '' +
    '<div class="utility"><div class="wrap">' +
      '<div class="row" style="gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--champagne)" stroke-width="1.6"><path d="M3 7h13v9H3z"/><path d="M16 10h3l2 3v3h-5z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/></svg><span style="opacity:.9">Free cold-chain delivery over EGP 800 · Cairo &amp; Giza</span></div>' +
      '<div class="row" style="gap:22px;opacity:.9"><a href="#">Track order</a><a href="apply.html">Sell on Lahmetna</a><a href="#">EG · العربية</a></div>' +
    '</div></div>' +
    '<header class="header"><div class="wrap"><div class="bar">' +
      '<button class="icon-btn hamburger" id="lh-menu" aria-label="Menu"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>' +
      '<a href="index.html" class="logo" dir="ltr"><span class="wm">lahmetna<span class="dot">.</span></span><span class="cap">YOUR EVERYDAY FARM MARKET</span></a>' +
      '<form class="search" id="lh-search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#917b85" stroke-width="1.7"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><input type="search" name="q" placeholder="Search ribeye, free-range eggs, heirloom tomatoes…" aria-label="Search"></form>' +
      '<div class="row" style="margin-left:auto;gap:16px">' +
        '<div class="acct" id="lh-acct"></div>' +
        '<button class="btn btn-ink btn-sm" id="lh-cart-btn" style="gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><path d="M4 7h15l-1.5 9H6L4 7z"/><path d="M4 7l-.8-3H1"/><circle cx="8" cy="20" r="1.4" fill="#fff" stroke="none"/><circle cx="16" cy="20" r="1.4" fill="#fff" stroke="none"/></svg>Cart · <span id="lh-cart-count">0</span></button>' +
      '</div>' +
    '</div></div>' +
    '<div class="wrap"><nav class="nav" id="lh-nav">' + NAV.map(function (n) { return '<a href="' + n.href + '"' + (n.k ? ' data-nav="' + n.k + '"' : '') + '>' + n.l + '</a>'; }).join('') +
      '<span style="margin-left:auto;font-size:13px;font-weight:600;color:var(--cognac)" class="row"><span class="tag-dot"></span>This week\'s harvest</span></nav></div>' +
    '</header>';
  }
  function acctHTML() {
    if (!me) return '<a href="login.html" class="row" style="gap:7px;font-size:14px;font-weight:500"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B1714" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg><span class="acct-label">Log in</span></a>';
    var links = '';
    if (me.role === 'customer') links = '<a href="account.html">My account</a><a href="account.html#orders">Order history</a><a href="account.html#addresses">Addresses</a><a href="account.html#one">Lahmetna One</a><a href="account.html#support">Support</a>';
    else if (me.role === 'vendor') links = '<a href="vendor.html">Vendor dashboard</a><a href="vendor.html#orders">Orders</a><a href="vendor.html#earnings">Earnings</a><a href="vendor.html#awal">Lahmetna Awal</a><a href="vendor.html#support">Support</a>';
    else if (me.role === 'admin') links = '<a href="admin.html">Admin console</a><a href="admin.html#support">Support queue</a><a href="admin.html#payouts">Payouts</a><a href="admin.html#settings">Settings</a>';
    return '<button class="row" id="lh-acct-btn" style="gap:7px;font-size:14px;font-weight:500;background:none;border:none;cursor:pointer;color:var(--ink)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B1714" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg><span class="acct-label">' + esc(me.name.split(' ')[0]) + '</span></button>' +
      '<div class="acct-menu" id="lh-acct-menu" hidden><div class="who"><div class="n">' + esc(me.name) + '</div><div class="e">' + esc(me.email) + ' · ' + me.role + '</div></div><div class="sep"></div>' + links + '<div class="sep"></div><button id="lh-logout">Log out</button></div>';
  }
  function footerHTML() {
    return '<footer class="footer"><div class="wrap"><div class="cols">' +
      '<div><a href="index.html" class="logo" dir="ltr"><span class="wm" style="font-size:30px">lahmetna<span class="dot">.</span></span></a>' +
      '<p class="muted" style="font-size:13.5px;line-height:1.6;margin-top:16px;max-width:280px">The marketplace for naturally raised meat and fresh farm produce, direct from named farms across Egypt.</p>' +
      '<div class="row" style="gap:10px;margin-top:18px"><span class="pill">Cash on delivery</span><span class="pill">Visa · Meeza · PayTabs</span></div></div>' +
      '<div><h4>Shop</h4><div class="links"><a href="index.html?cat=Beef#shop">Beef</a><a href="index.html?cat=Lamb%20%26%20Goat#shop">Lamb &amp; Goat</a><a href="index.html?cat=Poultry#shop">Poultry &amp; Eggs</a><a href="index.html?cat=Vegetables#shop">Vegetables &amp; Fruit</a><a href="index.html?cat=Livestock#shop">Livestock</a></div></div>' +
      '<div><h4>Company</h4><div class="links"><a href="apply.html">Sell on Lahmetna</a><a href="index.html#faq">How it works</a><a href="#">Sustainability</a><a href="#">Careers</a></div></div>' +
      '<div><h4>Help</h4><div class="links"><a href="index.html#faq">FAQs</a><a href="#">Delivery &amp; cold-chain</a><a href="#">Returns &amp; freshness</a><a href="login.html">My account</a></div></div>' +
      '</div><div class="base"><span>© 2026 Lahmetna. Raised right, priced fair.</span><div class="row" style="gap:22px"><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Halal certification</a></div></div></div></footer>';
  }
  function cartHTML() {
    return '<div class="scrim-full" id="lh-scrim-cart"></div>' +
    '<aside class="drawer" id="lh-cart" aria-label="Cart"><div class="row between" style="padding:20px 22px;border-bottom:1px solid var(--line)"><strong class="display" style="font-size:18px">Your cart</strong><button class="icon-btn" id="lh-cart-close" aria-label="Close">✕</button></div>' +
      '<div id="lh-cart-items" style="flex:1;overflow:auto;padding:8px 22px"></div>' +
      '<div style="padding:20px 22px;border-top:1px solid var(--line);background:var(--paper)"><div class="row between"><span class="muted">Subtotal</span><strong class="display" style="font-size:20px" id="lh-cart-total">EGP 0</strong></div>' +
      '<div class="muted" style="font-size:12.5px;margin-top:4px">Delivery calculated at checkout · free over EGP 800</div>' +
      '<a class="btn btn-primary btn-block" id="lh-checkout" href="checkout.html" style="margin-top:14px">Checkout</a></div></aside>';
  }
  function mnavHTML() {
    return '<div class="scrim-full" id="lh-scrim-menu"></div><div class="mnav" id="lh-mnav"><div class="row between" style="margin-bottom:12px"><span class="brand" style="font-size:28px">lahmetna<span style="color:var(--gold)">.</span></span><button class="icon-btn" id="lh-mnav-close">✕</button></div>' +
      NAV.map(function (n) { return '<a href="' + n.href + '">' + n.l + '</a>'; }).join('') + '<a href="apply.html">Sell on Lahmetna</a></div>';
  }

  function open(el, sc) { if (el) el.classList.add('show'); if (sc) sc.classList.add('show'); }
  function close(el, sc) { if (el) el.classList.remove('show'); if (sc) sc.classList.remove('show'); }

  function mountChrome(opts) {
    opts = opts || {};
    var h = document.getElementById('site-header') || document.body.insertBefore(document.createElement('div'), document.body.firstChild);
    h.id = 'site-header'; h.innerHTML = headerHTML();
    var f = document.getElementById('site-footer') || document.body.appendChild(document.createElement('div'));
    f.id = 'site-footer'; f.innerHTML = footerHTML();
    document.body.insertAdjacentHTML('beforeend', cartHTML() + mnavHTML());
    // active nav
    if (opts.active) { var a = h.querySelector('.nav a[data-nav="' + opts.active + '"]'); if (a) a.classList.add('active'); }
    // acct
    renderAcct();
    // search
    var sf = $('#lh-search'); if (sf) sf.addEventListener('submit', function (e) { e.preventDefault(); var v = this.q.value.trim(); location.href = 'index.html?q=' + encodeURIComponent(v) + '#shop'; });
    // cart
    $('#lh-cart-btn').addEventListener('click', function () { renderCart(); open($('#lh-cart'), $('#lh-scrim-cart')); });
    $('#lh-cart-close').addEventListener('click', function () { close($('#lh-cart'), $('#lh-scrim-cart')); });
    $('#lh-scrim-cart').addEventListener('click', function () { close($('#lh-cart'), $('#lh-scrim-cart')); });
    $('#lh-checkout').addEventListener('click', function (e) { if (!cartQty()) { e.preventDefault(); toast('Your cart is empty'); } });
    // menu
    $('#lh-menu').addEventListener('click', function () { open($('#lh-mnav'), $('#lh-scrim-menu')); });
    $('#lh-mnav-close').addEventListener('click', function () { close($('#lh-mnav'), $('#lh-scrim-menu')); });
    $('#lh-scrim-menu').addEventListener('click', function () { close($('#lh-mnav'), $('#lh-scrim-menu')); });
    // cart qty delegation
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-lh-inc],[data-lh-dec],[data-lh-rm]'); if (!t) return;
      if (t.dataset.lhInc) setQty(t.dataset.lhInc, (cart[t.dataset.lhInc] || 0) + 1);
      else if (t.dataset.lhDec) setQty(t.dataset.lhDec, (cart[t.dataset.lhDec] || 0) - 1);
      else if (t.dataset.lhRm) setQty(t.dataset.lhRm, 0);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { close($('#lh-cart'), $('#lh-scrim-cart')); close($('#lh-mnav'), $('#lh-scrim-menu')); var mnu = $('#lh-acct-menu'); if (mnu) mnu.hidden = true; } });
    updateBadge();
  }
  function renderAcct() {
    var box = $('#lh-acct'); if (!box) return;
    box.innerHTML = acctHTML();
    if (me) {
      $('#lh-acct-btn').addEventListener('click', function (e) { e.stopPropagation(); var mnu = $('#lh-acct-menu'); mnu.hidden = !mnu.hidden; });
      document.addEventListener('click', function () { var mnu = $('#lh-acct-menu'); if (mnu) mnu.hidden = true; });
      $('#lh-logout').addEventListener('click', logout);
    }
  }

  /* boot: load auth, mount chrome */
  function boot(opts) { return loadMe().then(function () { mountChrome(opts || {}); return me; }); }

  /* ---------- shared dashboard helpers ---------- */
  function card(v, k) { return '<div class="stat-card"><div class="v">' + v + '</div><div class="k">' + k + '</div></div>'; }
  function st(s) { return '<span class="st st-' + esc(s) + '">' + esc(s) + '</span>'; }
  var CROWN = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7l4 4 5-7 5 7 4-4v11H3z"/></svg>';
  function planBadge(plan) {
    if (plan === 'one') return '<span class="plan-badge">' + CROWN + 'Lahmetna One</span>';
    if (plan === 'awal') return '<span class="plan-badge">' + CROWN + 'Lahmetna Awal</span>';
    return '';
  }
  /* renders a ticket message thread; mineRole decides bubble side */
  function ticketThread(msgs, meId) {
    return '<div class="thread">' + (msgs || []).map(function (m) {
      var mine = m.author_id === meId;
      var who = m.author_role === 'admin' ? 'Lahmetna support' : (mine ? 'You' : 'You');
      return '<div class="msg ' + (mine ? 'mine' : 'them') + '"><div class="who">' + esc(who) + ' · ' + esc((m.created || '').slice(0, 16).replace('T', ' ')) + '</div>' + esc(m.body).replace(/\n/g, '<br>') + '</div>';
    }).join('') + '</div>';
  }
  /* generic tab router used by the three dashboards */
  function tabs(handlers, def) {
    var buttons = document.querySelectorAll('.dash-nav button');
    function go(t) {
      if (!handlers[t]) t = def;
      buttons.forEach(function (b) { b.classList.toggle('active', b.dataset.tab === t); });
      if (location.hash.slice(1) !== t) history.replaceState(null, '', '#' + t);
      handlers[t]();
    }
    buttons.forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.tab); }); });
    window.addEventListener('hashchange', function () { go(location.hash.slice(1)); });
    go(location.hash.slice(1) || def);
    return go;
  }
  /* generic centered modal from an id already in the DOM */
  function modal(html) {
    var sc = $('#lh-mscrim') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'lh-mscrim', className: 'scrim-full' }));
    var mo = $('#lh-modal') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'lh-modal', className: 'modal' }));
    mo.innerHTML = html;
    function shut() { close(mo, sc); }
    sc.onclick = shut;
    mo.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', shut); });
    open(mo, sc);
    return { el: mo, close: shut };
  }

  return {
    $: $, esc: esc, money: money, stars: stars, api: api, POST: POST, toast: toast,
    IMG: IMG, TINT: TINT, ICONS: ICONS, media: media, thumb: thumb,
    getProducts: getProducts, byId: byId,
    get cart() { return cart; }, cartArray: cartArray, addToCart: addToCart, cartQty: cartQty, cartTotal: cartTotal, clearCart: clearCart, renderCart: renderCart,
    loadMe: loadMe, logout: logout, get me() { return me; },
    boot: boot, mountChrome: mountChrome, open: open, close: close,
    card: card, st: st, planBadge: planBadge, ticketThread: ticketThread, tabs: tabs, modal: modal
  };
})();
