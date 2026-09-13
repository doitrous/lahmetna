/* Public legal / policy page — renders an admin-managed page by slug */
(function () {
  'use strict';
  var $ = LH.$, esc = LH.esc, api = LH.api;
  var slug = new URLSearchParams(location.search).get('doc') || 'terms';

  LH.boot().then(function () {
    api('/api/pages').then(function (list) {
      $('#legal-nav').innerHTML = list.map(function (p) {
        return '<button class="' + (p.slug === slug ? 'active' : '') + '" onclick="location.href=\'legal.html?doc=' + p.slug + '\'">' + esc(p.title) + '</button>';
      }).join('');
    }).catch(function () {});

    api('/api/pages/' + slug).then(function (p) {
      document.title = p.title + ' · Lahmetna';
      $('#legal-title').textContent = p.title;
      $('#legal-body').innerHTML = p.body || '<p class="muted">This policy has not been written yet.</p>';
      $('#legal-updated').textContent = p.updated ? 'Last updated ' + p.updated.slice(0, 10) : '';
    }).catch(function () {
      $('#legal-title').textContent = 'Not found';
      $('#legal-body').innerHTML = '<p class="muted">This policy is not available. <a href="index.html">Return home →</a></p>';
    });
  });
})();
