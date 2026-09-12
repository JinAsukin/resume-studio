/**
 * 简历工坊 Resume Studio · 启动
 */
(function () {
  var RS = (typeof window !== 'undefined' ? (window.RS = window.RS || {}) : (globalThis.RS = globalThis.RS || {}));

  function injectDocCss() {
    if (document.getElementById('rs-doc-style')) return;
    var s = document.createElement('style');
    s.id = 'rs-doc-style';
    s.textContent = RS.documentCss || '';
    document.head.appendChild(s);
  }

  function boot() {
    injectDocCss();
    RS.store.init();

    RS.form.init(document.getElementById('rsForm'));
    RS.preview.init();
    RS.toolbar.init();

    RS.store.subscribe(function (data, reason) {
      if (reason === 'structure' || reason === 'replace' || reason === 'version') {
        RS.form.render(data);
      }
      RS.preview.render(data);
      RS.toolbar.sync(data, reason);
    });

    var d = RS.store.current();
    RS.form.render(d);
    RS.preview.render(d);
    RS.toolbar.sync(d, 'init');

    if (!RS.store.storageOK()) {
      RS.toolbar.toast('本机存储不可用，请用「更多 → 备份数据」保存进度', 'bad');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
