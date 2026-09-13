/* Storefront (index) page */
(function () {
  'use strict';
  var esc = LH.esc, money = LH.money, api = LH.api, $ = LH.$;
  var CATS = ['all', 'Beef', 'Lamb & Goat', 'Poultry', 'Eggs', 'Dairy', 'Vegetables', 'Fruit', 'Honey', 'Livestock'];
  var CAT_TILES = [
    { c: 'Beef', s: 'Dry-aged & fresh' }, { c: 'Lamb & Goat', s: 'Pasture-raised' }, { c: 'Poultry', s: 'Free-range' },
    { c: 'Eggs', s: 'Laid this week' }, { c: 'Dairy', s: 'Milk, labneh, cheese' }, { c: 'Vegetables', s: 'Picked daily' },
    { c: 'Fruit', s: 'In season' }, { c: 'Honey', s: 'Raw honey, pantry' }, { c: 'Livestock', s: 'Live & whole animals' }
  ];
  var products = [], activeFilter = 'all', search = '';
  var PAGE = 20, shown = PAGE; // 5 rows × 4 columns before "Show more"

  // persist the shop view (filter / search / expanded) so a reload keeps what the customer was browsing
  function saveView() { try { sessionStorage.setItem('lah_shop', JSON.stringify({ f: activeFilter, q: search, all: shown === Infinity })); } catch (e) {} }
  function loadView() { try { return JSON.parse(sessionStorage.getItem('lah_shop') || 'null'); } catch (e) { return null; } }

  function priceLabel(p) { return p.type === 'livestock' ? 'from ' + money(p.price) : money(p.price); }

  function addControl(p) {
    if (p.stock <= 0) return '<button class="btn btn-outline btn-sm" disabled>Sold out</button>';
    var q = LH.cart[p.id] || 0;
    if (q > 0) return '<div class="qty qty-card"><button data-lh-dec="' + p.id + '" aria-label="Remove one">–</button><span>' + q + '</span><button data-lh-inc="' + p.id + '" aria-label="Add one">+</button></div>';
    return '<button class="btn btn-ink btn-sm" data-add="' + p.id + '">Add</button>';
  }
  function refreshAddboxes() {
    document.querySelectorAll('[data-addbox]').forEach(function (box) {
      var p = LH.byId[box.dataset.addbox]; if (p) box.innerHTML = addControl(p);
    });
  }
  document.addEventListener('lh:cart', refreshAddboxes);

  function tile(t) {
    var m = '<img src="' + (LH.IMG[t.c] || 'assets/farm-foods.webp') + '" alt="' + esc(t.c) + '">';
    return '<a class="tile" data-filter="' + esc(t.c) + '">' + m + '<div class="scrim"></div><div class="lbl"><div class="t">' + esc(t.c) + '</div><div class="c">' + esc(t.s) + '</div></div></a>';
  }
  function card(p) {
    var rating = p.reviews ? (LH.stars(p.rating) + '<span class="muted">' + p.rating.toFixed(1) + ' (' + p.reviews + ')</span>') : '<span class="muted" style="font-size:12px">New</span>';
    return '<div class="card card-hover product">' +
      '<a href="product.html?id=' + p.id + '" class="media" style="display:block">' + LH.media(p) +
        (p.badge ? '<span class="badge badge-cognac" style="position:absolute;top:10px;left:10px">' + esc(p.badge) + '</span>' : '') +
        (p.stock <= 0 ? '<span class="badge" style="position:absolute;top:10px;right:10px;background:#8A2F1E">Sold out</span>' : '') +
      '</a><div class="body">' +
        '<div class="origin">' + esc(p.cat) + ' · ' + esc(p.origin) + '</div>' +
        '<a href="product.html?id=' + p.id + '" class="name" style="display:block">' + esc(p.name) + '</a>' +
        '<div class="row" style="gap:6px;margin-top:7px;font-size:12.5px">' + rating + '</div>' +
        '<div class="row between" style="margin-top:12px;align-items:center"><span class="price">' + priceLabel(p) + '</span>' +
          '<span class="addbox" data-addbox="' + p.id + '">' + addControl(p) + '</span>' +
        '</div></div></div>';
  }
  function renderGrid() {
    var list = products.filter(function (p) {
      if (activeFilter !== 'all' && p.cat !== activeFilter) return false;
      if (search && (p.name + ' ' + p.cat + ' ' + p.origin).toLowerCase().indexOf(search) < 0) return false;
      return true;
    });
    var visible = list.slice(0, shown);
    $('#product-grid').innerHTML = visible.map(card).join('') || '<div class="muted" style="grid-column:1/-1;padding:40px 0">No products match.</div>';
    $('#shop-count').textContent = list.length + ' product' + (list.length === 1 ? '' : 's') + (activeFilter === 'all' ? '' : ' in ' + activeFilter) + (search ? ' · “' + search + '”' : '');
    var box = document.getElementById('shop-more');
    if (!box) { box = document.createElement('div'); box.id = 'shop-more'; box.style.cssText = 'text-align:center;margin-top:30px'; $('#product-grid').after(box); }
    var more = list.length - visible.length;
    box.innerHTML = more > 0 ? '<button class="btn btn-outline" data-showmore>' + LH.t('Show more') + ' · ' + more + '</button>' : '';
    if (LH.applyLang) LH.applyLang();
  }
  function renderFilters() {
    $('#filters').innerHTML = CATS.map(function (c) { return '<button class="chip" data-filter="' + esc(c) + '" aria-pressed="' + (c === activeFilter) + '">' + (c === 'all' ? 'All' : esc(c)) + '</button>'; }).join('');
  }
  function setFilter(cat) {
    activeFilter = cat; shown = PAGE;
    document.querySelectorAll('#filters .chip').forEach(function (ch) { ch.setAttribute('aria-pressed', ch.dataset.filter === cat); });
    saveView(); renderGrid();
  }

  function reviewCard(r) {
    return '<div class="card review" style="padding:20px 22px">' + LH.stars(r.rating) +
      '<div class="display" style="font-size:16px;font-weight:600;margin-top:10px;letter-spacing:-.01em">' + esc(r.title) + '</div>' +
      '<p class="muted" style="font-size:14px;line-height:1.55;margin:8px 0 0">' + esc(r.body) + '</p>' +
      '<div class="row between" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--line-2)">' +
        '<div class="review head"><div class="avatar">' + esc(r.name.trim().charAt(0)) + '</div><div><div style="font-size:13px;font-weight:600">' + esc(r.name) + '</div>' +
        '<div style="font-size:11.5px;color:var(--cognac);font-weight:600">✓ ' + esc(r.product_name || '') + '</div></div></div>' +
        '<a href="product.html?id=' + esc(r.product_id) + '" class="muted" style="font-size:12px">View →</a></div></div>';
  }
  function renderFaq(faqs) {
    $('#faq-list').innerHTML = faqs.map(function (f, i) {
      return '<div class="acc-item' + (i === 0 ? ' open' : '') + '"><button class="acc-head" aria-expanded="' + (i === 0) + '">' + esc(f.q) + '<span class="acc-icon"></span></button><div class="acc-panel"><div class="inner">' + esc(f.a) + '</div></div></div>';
    }).join('');
    var first = $('#faq-list .acc-item.open .acc-panel'); if (first) first.style.maxHeight = first.scrollHeight + 'px';
  }

  LH.boot({ active: activeFilter === 'all' ? 'all' : null }).then(function () {
    var params = new URLSearchParams(location.search);
    var saved = loadView();
    if (saved) { activeFilter = saved.f || 'all'; search = saved.q || ''; if (saved.all) shown = Infinity; }
    // an explicit ?cat / ?q in the URL wins over the saved view
    if (params.get('cat')) { activeFilter = params.get('cat'); shown = PAGE; }
    if (params.get('q')) { search = params.get('q').toLowerCase(); shown = PAGE; }

    $('#cat-grid').innerHTML = CAT_TILES.map(tile).join('');
    renderFilters();
    if (LH.applyLang) LH.applyLang();

    LH.getProducts().then(function (byId) {
      products = Object.keys(byId).map(function (k) { return byId[k]; }).sort(function (a, b) { return (a.sort - b.sort) || (a.created < b.created ? -1 : 1); });
      renderGrid();
      if (params.get('cat') || params.get('q')) { setTimeout(function () { var s = document.getElementById('shop'); if (s) s.scrollIntoView(); }, 60); }
    });

    api('/api/reviews').then(function (rv) { $('#reviews-list').innerHTML = rv.slice(0, 3).map(reviewCard).join(''); }).catch(function () {});
    api('/api/faqs').then(function (l) { renderFaq(LH.tFaq(l)); }).catch(function () {});

    // interactions
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-add],[data-filter],[data-showmore]'); if (!t) return;
      if (t.dataset.add) { e.preventDefault(); LH.addToCart(t.dataset.add); }
      else if (t.hasAttribute('data-showmore')) { e.preventDefault(); shown = Infinity; saveView(); renderGrid(); }
      else if (t.hasAttribute('data-filter')) { e.preventDefault(); setFilter(t.dataset.filter); document.getElementById('shop').scrollIntoView({ behavior: 'smooth' }); }
    });
    $('#faq-list').addEventListener('click', function (e) {
      var head = e.target.closest('.acc-head'); if (!head) return;
      var item = head.parentElement, panel = item.querySelector('.acc-panel');
      var open = item.classList.toggle('open'); head.setAttribute('aria-expanded', open); panel.style.maxHeight = open ? panel.scrollHeight + 'px' : 0;
    });
    $('#news-form').addEventListener('submit', function (e) {
      e.preventDefault(); var email = this.querySelector('input').value.trim();
      LH.POST('/api/newsletter', { email: email }).then(function () { LH.toast('You’re on the list — see you Thursday'); }).catch(function (err) { LH.toast(err.message); });
      this.reset();
    });
  });
})();
