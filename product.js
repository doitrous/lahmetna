/* Product detail page */
(function () {
  'use strict';
  var esc = LH.esc, money = LH.money, api = LH.api, $ = LH.$;
  var id = new URLSearchParams(location.search).get('id');
  var product = null, revFilter = 0, revSort = 'recent';

  function gallery(p) { return LH.media(p); }
  function renderProduct(data) {
    product = data.product; var v = data.vendor, s = data.summary;
    document.title = product.name.split(' · ')[0] + ' · Lahmetna';
    var priceBlock = product.type === 'livestock'
      ? '<div class="price" style="font-size:26px">' + money(product.price) + '</div><div class="muted" style="font-size:13px;margin-top:2px">Est. ' + product.weight_kg + 'kg · ' + money(product.price_per_kg) + '/kg live weight</div>'
      : '<div class="price" style="font-size:26px">' + money(product.price) + '</div><div class="muted" style="font-size:13px;margin-top:2px">per ' + esc(product.unit) + '</div>';
    var ratingRow = product.reviews ? (LH.stars(product.rating) + '<span class="muted" style="font-size:13px">' + product.rating.toFixed(1) + ' · ' + product.reviews + ' reviews</span>') : '<span class="muted" style="font-size:13px">No reviews yet</span>';
    var stockRow = product.stock > 0
      ? '<span class="pill" style="color:#3B5537;border-color:#CDDCC6">In stock' + (product.stock <= 10 ? ' · only ' + product.stock + ' left' : '') + '</span>'
      : '<span class="pill" style="color:#8A2F1E;border-color:#E5C9C1">Sold out</span>';
    $('#pdp-root').innerHTML =
      '<div class="pdp">' +
        '<div><div class="crumbs"><a href="index.html">Home</a> / <a href="index.html?cat=' + encodeURIComponent(product.cat) + '#shop">' + esc(product.cat) + '</a> / ' + esc(product.name.split(' · ')[0]) + '</div>' +
          '<div class="gallery">' + gallery(product) + (product.badge ? '<span class="badge badge-cognac" style="position:absolute;top:14px;left:14px">' + esc(product.badge) + '</span>' : '') + '</div></div>' +
        '<div>' +
          '<div class="eyebrow">' + esc(product.cat) + '</div>' +
          '<h1>' + esc(product.name.split(' · ')[0]) + '</h1>' +
          '<div class="row" style="gap:8px;margin-top:10px">' + ratingRow + '</div>' +
          '<div class="row" style="gap:10px;margin-top:14px"><a href="index.html?cat=' + encodeURIComponent(product.cat) + '#shop" class="pill">' + esc(product.origin) + '</a>' + stockRow + '</div>' +
          '<div style="margin-top:20px">' + priceBlock + '</div>' +
          '<p class="muted" style="font-size:15px;line-height:1.65;margin-top:18px">' + esc(product.description || '') + '</p>' +
          (product.type === 'livestock' ? '<div class="card" style="padding:14px 16px;margin-top:16px;background:var(--bone-2);border:none"><div class="row" style="gap:10px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.6"><path d="M12 2l8 4v5c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V6z"/></svg><div style="font-size:13.5px;line-height:1.5">Priced by live weight — final weight confirmed on collection. Choose <strong>halal farm slaughter &amp; butchering</strong> or live collection at checkout.</div></div></div>' : '') +
          '<div class="row" style="gap:12px;margin-top:22px;align-items:center">' +
            '<div class="qty"><button id="q-dec">–</button><span id="q-val">1</span><button id="q-inc">+</button></div>' +
            (product.stock > 0 ? '<button class="btn btn-primary" id="add" style="flex:1;height:50px">Add to cart · <span id="add-price">' + money(product.price) + '</span></button>' : '<button class="btn btn-outline" disabled style="flex:1;height:50px">Sold out</button>') +
          '</div>' +
          '<div class="spec"><div><div class="k">Farm</div><div class="v">' + esc(v ? v.name : product.origin) + '</div></div><div><div class="k">Unit</div><div class="v">' + esc(product.unit) + '</div></div><div><div class="k">Category</div><div class="v">' + esc(product.cat) + '</div></div><div><div class="k">Freshness</div><div class="v">Cut / picked to order</div></div></div>' +
        '</div>' +
      '</div>';
    var qty = 1;
    var setQ = function (n) { qty = Math.max(1, Math.min(99, n)); $('#q-val').textContent = qty; var ap = $('#add-price'); if (ap) ap.textContent = money(product.price * qty); };
    $('#q-dec').onclick = function () { setQ(qty - 1); };
    $('#q-inc').onclick = function () { setQ(qty + 1); };
    if ($('#add')) $('#add').onclick = function () { LH.addToCart(product.id, qty); };
    renderDist(s);
    renderRelated();
  }

  /* reviews */
  function reviewCard(r) {
    return '<div class="card review" style="padding:20px 22px">' + LH.stars(r.rating) +
      '<div class="display" style="font-size:16px;font-weight:600;margin-top:10px;letter-spacing:-.01em">' + esc(r.title) + '</div>' +
      '<p class="muted" style="font-size:14px;line-height:1.55;margin:8px 0 0">' + esc(r.body) + '</p>' +
      '<div class="row between" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--line-2)">' +
        '<div class="head" style="display:flex;align-items:center;gap:11px"><div class="avatar">' + esc((r.name || '?').trim().charAt(0)) + '</div><div><div style="font-size:13px;font-weight:600">' + esc(r.name) + '</div><div style="font-size:11.5px;color:var(--cognac);font-weight:600">✓ Verified · ' + esc(r.date) + '</div></div></div>' +
        '<button class="helpful" data-helpful="' + r.id + '"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M7 11v9H3v-9zM7 11l4-8c1.5 0 2.5 1 2.5 2.5V9h5c1.2 0 2 1 1.8 2.2l-1.3 7c-.2 1-1 1.8-2 1.8H7"/></svg>' + r.helpful + '</button>' +
      '</div></div>';
  }
  function renderDist(s) {
    $('#rev-avg').textContent = Number(s.avg).toFixed(1);
    $('#rev-avg-stars').innerHTML = '<span style="width:' + (s.avg / 5 * 100) + '%"></span>';
    $('#rev-total').textContent = s.total;
    var max = s.total || 1;
    $('#dist').innerHTML = s.dist.map(function (c, i) {
      var st = 5 - i, pct = Math.round(c / max * 100);
      return '<button class="dist-row" data-star="' + st + '" style="background:none;border:none;cursor:pointer;text-align:left;width:100%"><span style="width:34px;color:var(--ink-2);font-weight:600">' + st + ' ★</span><span class="dist-bar"><span style="width:' + pct + '%"></span></span><span class="muted" style="width:44px;text-align:right">' + c + '</span></button>';
    }).join('');
  }
  function loadReviews() {
    return api('/api/products/' + id + '/reviews?sort=' + revSort + (revFilter ? '&rating=' + revFilter : '')).then(function (res) {
      renderDist(res.summary);
      $('#reviews-list').innerHTML = res.reviews.length ? res.reviews.map(reviewCard).join('') : '<div class="muted" style="grid-column:1/-1;text-align:center;padding:36px 0">No reviews' + (revFilter ? ' with that rating' : ' yet — be the first') + '.</div>';
    });
  }
  function renderRevFilters() {
    var opts = [{ v: 0, l: 'All' }, { v: 5, l: '5 ★' }, { v: 4, l: '4 ★' }, { v: 3, l: '3 ★' }, { v: 2, l: '2 ★' }, { v: 1, l: '1 ★' }];
    $('#rev-filters').innerHTML = opts.map(function (o) { return '<button class="chip" data-star="' + o.v + '" aria-pressed="' + (o.v === revFilter) + '">' + o.l + '</button>'; }).join('');
  }
  function renderRelated() {
    api('/api/products?category=' + encodeURIComponent(product.cat)).then(function (list) {
      var rel = list.filter(function (p) { return p.id !== product.id; }).slice(0, 4);
      if (!rel.length) return;
      $('#related-wrap').hidden = false;
      $('#related').innerHTML = rel.map(function (p) {
        return '<a class="card card-hover" href="product.html?id=' + p.id + '" style="display:block"><div class="media" style="height:150px;position:relative">' + LH.media(p) + '</div><div style="padding:12px 14px"><div class="name" style="font-family:var(--font-display);font-weight:600;font-size:15px">' + esc(p.name.split(' · ')[0]) + '</div><div class="price" style="font-size:16px;margin-top:6px">' + (p.type === 'livestock' ? 'from ' : '') + money(p.price) + '</div></div></a>';
      }).join('');
    });
  }

  if (!id) { document.getElementById('pdp-root').innerHTML = '<div class="wrap" style="padding:80px 24px">Product not specified. <a href="index.html">Back to shop</a></div>'; return; }
  LH.boot().then(function () {
    api('/api/products/' + id).then(function (data) {
      renderProduct(data);
      $('#pdp-reviews').hidden = false;
      $('#rev-heading').textContent = 'Reviews for ' + product.name.split(' · ')[0];
      renderRevFilters(); loadReviews();
    }).catch(function () {
      document.getElementById('pdp-root').innerHTML = '<div class="wrap" style="padding:80px 24px">Product not found. <a href="index.html">Back to shop</a></div>';
    });

    document.addEventListener('click', function (e) {
      var h = e.target.closest('[data-helpful]'); if (h) { LH.POST('/api/reviews/' + h.dataset.helpful + '/helpful').then(loadReviews); return; }
      var st = e.target.closest('[data-star]'); if (st) { revFilter = parseInt(st.dataset.star, 10); renderRevFilters(); loadReviews(); }
    });
    $('#rev-sort').addEventListener('change', function () { revSort = this.value; loadReviews(); });
    $('#btn-write').addEventListener('click', function () { LH.open($('#modal'), $('#scrim-modal')); });
    $('#btn-modal-close').addEventListener('click', function () { LH.close($('#modal'), $('#scrim-modal')); });
    $('#scrim-modal').addEventListener('click', function () { LH.close($('#modal'), $('#scrim-modal')); });
    $('#review-form').addEventListener('submit', function (e) {
      e.preventDefault();
      LH.POST('/api/products/' + id + '/reviews', { name: $('#rev-name').value.trim(), rating: parseInt(document.querySelector('input[name=rate]:checked').value, 10), title: $('#rev-title').value.trim(), body: $('#rev-body').value.trim() })
        .then(function () { LH.close($('#modal'), $('#scrim-modal')); e.target.reset(); revFilter = 0; renderRevFilters(); loadReviews(); LH.toast('Thanks — your review was posted'); })
        .catch(function (err) { LH.toast(err.message); });
    });
  });
})();
