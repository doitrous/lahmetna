/* Checkout page */
(function () {
  'use strict';
  var esc = LH.esc, money = LH.money, $ = LH.$;
  var FREE_OVER = 800, DELIVERY = 60, SLAUGHTER = 150;

  function loginGate() {
    $('#checkout-root').innerHTML = '<div class="wrap" style="padding:56px 24px;max-width:520px"><div class="card" style="padding:32px;text-align:center"><h2 class="display" style="font-size:22px">Please log in to check out</h2><p class="muted" style="margin-top:8px">Your cart is saved — log in or create an account to place your order.</p><div class="row" style="gap:12px;justify-content:center;margin-top:20px"><a class="btn btn-primary" href="login.html?next=checkout.html">Log in</a><a class="btn btn-outline" href="signup.html">Create account</a></div></div></div>';
  }

  function render(byId, me) {
    var items = LH.cartArray().filter(function (it) { return byId[it.id]; });
    if (!items.length) { $('#checkout-root').innerHTML = '<div class="wrap" style="padding:56px 24px;max-width:520px"><div class="card" style="padding:32px;text-align:center"><h2 class="display" style="font-size:22px">Your cart is empty</h2><a class="btn btn-primary" href="index.html#shop" style="margin-top:18px">Browse the market</a></div></div>'; return; }
    var hasLivestock = items.some(function (it) { return byId[it.id].type === 'livestock'; });
    var subtotal = items.reduce(function (s, it) { return s + byId[it.id].price * it.qty; }, 0);

    $('#checkout-root').innerHTML =
      '<div class="wrap" style="padding:32px 24px;display:grid;grid-template-columns:1.2fr 1fr;gap:40px" id="co-grid">' +
        '<div><div class="card" style="padding:26px 28px">' +
          '<h3 class="display" style="font-size:18px">Delivery details</h3>' +
          '<div class="field-row" style="margin-top:16px"><div><label class="label">Full name</label><input class="field" id="co-name" required></div><div><label class="label">Phone</label><input class="field" id="co-phone" required placeholder="+20 1XX XXX XXXX"></div></div>' +
          '<div class="form-row"><label class="label">Delivery address</label><textarea class="field" id="co-address" required placeholder="Street, building, apartment, area, city"></textarea></div>' +
          (hasLivestock ? '<div class="card" style="padding:14px 16px;margin-top:16px;background:var(--bone-2);border:none"><label class="row" style="gap:10px;cursor:pointer;align-items:flex-start"><input type="checkbox" id="co-slaughter" checked style="margin-top:3px"><span style="font-size:14px;line-height:1.5"><strong>Halal farm slaughter &amp; butchering</strong> (+' + money(SLAUGHTER) + ')<br><span class="muted" style="font-size:13px">Your live animal is slaughtered and hand-cut to spec, then delivered cold. Uncheck for live collection.</span></span></label></div>' : '') +
          '<h3 class="display" style="font-size:18px;margin-top:24px">Payment</h3>' +
          '<div class="row" style="gap:12px;margin-top:12px;flex-wrap:wrap">' +
            '<label class="chip" style="cursor:pointer;padding:10px 16px"><input type="radio" name="pay" value="paytabs" checked style="margin-right:8px">Card · Visa / Meeza (PayTabs)</label>' +
            '<label class="chip" style="cursor:pointer;padding:10px 16px"><input type="radio" name="pay" value="cod" style="margin-right:8px">Cash on delivery</label>' +
          '</div>' +
          '<div id="err" class="form-error" hidden></div>' +
        '</div></div>' +
        '<div><div class="card" style="padding:24px;position:sticky;top:90px">' +
          '<h3 class="display" style="font-size:18px">Order summary</h3>' +
          '<div style="margin-top:14px">' + items.map(function (it) { var p = byId[it.id]; return '<div class="row" style="gap:12px;padding:10px 0;border-bottom:1px solid var(--line-2)">' + LH.thumb(p, 46) + '<div style="flex:1;min-width:0"><div style="font-size:13.5px;font-weight:600;line-height:1.3">' + esc(p.name.split(' · ')[0]) + '</div><div class="muted" style="font-size:12px">' + money(p.price) + ' × ' + it.qty + '</div></div><div style="font-weight:600;font-size:13.5px">' + money(p.price * it.qty) + '</div></div>'; }).join('') + '</div>' +
          '<div id="totals" style="margin-top:14px"></div>' +
          '<button class="btn btn-primary btn-block" id="place" style="margin-top:18px;height:50px">Place order</button>' +
          '<p class="muted" style="font-size:12px;text-align:center;margin-top:10px" id="pay-note"></p>' +
        '</div></div>' +
      '</div>';

    $('#co-name').value = me.name || ''; $('#co-phone').value = me.phone || '';

    function recompute() {
      var slaughter = hasLivestock && $('#co-slaughter') && $('#co-slaughter').checked;
      var delivery = subtotal >= FREE_OVER ? 0 : DELIVERY;
      var extra = slaughter ? SLAUGHTER : 0;
      var total = subtotal + delivery + extra;
      $('#totals').innerHTML =
        row('Subtotal', money(subtotal)) +
        row('Delivery', delivery === 0 ? 'Free' : money(delivery)) +
        (slaughter ? row('Slaughter &amp; butchering', money(SLAUGHTER)) : '') +
        '<div class="divider" style="margin:12px 0"></div>' +
        '<div class="row between"><strong>Total</strong><strong class="display" style="font-size:22px">' + money(total) + '</strong></div>';
      return { slaughter: slaughter };
    }
    function row(k, v) { return '<div class="row between" style="font-size:14px;margin-bottom:8px"><span class="muted">' + k + '</span><span>' + v + '</span></div>'; }
    recompute();
    if ($('#co-slaughter')) $('#co-slaughter').addEventListener('change', recompute);
    var payNote = function () { $('#pay-note').textContent = payMethod() === 'cod' ? 'You’ll pay in cash when your order arrives.' : 'You’ll be taken to PayTabs to pay securely by card.'; };
    function payMethod() { return document.querySelector('input[name=pay]:checked').value; }
    document.querySelectorAll('input[name=pay]').forEach(function (r) { r.addEventListener('change', payNote); }); payNote();

    $('#place').addEventListener('click', function () {
      var err = $('#err'); err.hidden = true;
      var opts = recompute();
      var body = { items: LH.cartArray(), name: $('#co-name').value.trim(), phone: $('#co-phone').value.trim(), address: $('#co-address').value.trim(), method: payMethod(), slaughter: opts.slaughter };
      if (!body.name || !body.phone || !body.address) { err.textContent = 'Please fill in your name, phone and delivery address.'; err.hidden = false; return; }
      var btn = $('#place'); btn.disabled = true; btn.textContent = 'Placing order…';
      LH.POST('/api/orders', body).then(function (res) {
        if (res.method === 'cod') { LH.clearCart(); location.href = 'order-confirmation.html?order=' + res.orderId; return; }
        return LH.POST('/api/checkout/' + res.orderId + '/pay').then(function (pay) { LH.clearCart(); location.href = pay.redirect_url; });
      }).catch(function (e) { err.textContent = e.message; err.hidden = false; btn.disabled = false; btn.textContent = 'Place order'; });
    });
  }

  LH.boot().then(function (me) {
    if (!me) return loginGate();
    LH.getProducts().then(function (byId) { render(byId, me); });
  });
})();
