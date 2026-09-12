/**
 * 简历工坊 Resume Studio · 预览
 * 职责：渲染 A4 文档、自适应缩放、页数测量与溢出预警（简历的第一硬伤）。
 */
(function () {
  var RS = (typeof window !== 'undefined' ? (window.RS = window.RS || {}) : (globalThis.RS = globalThis.RS || {}));

  var stage = null, frame = null, scaler = null, pageInfo = null, warnBox = null;
  var currentData = null;
  var lastMetrics = { pages: 1, height: 0, ratio: 1, heaviest: null };

  function el(id) { return document.getElementById(id); }

  function themeStyle() {
    var s = el('rs-theme-style');
    if (!s) {
      s = document.createElement('style');
      s.id = 'rs-theme-style';
      document.head.appendChild(s);
    }
    return s;
  }

  function render(data) {
    currentData = data;
    if (!scaler) return;
    var tokens = RS.tokens.resolve(data.theme);
    themeStyle().textContent = RS.tokens.toCssVars(tokens);
    scaler.innerHTML = RS.renderHtml.render(data);
    fit();
    measure();
    requestAnimationFrame(measure);
    setTimeout(measure, 220);
  }

  /** 自适应缩放：按预览区可用宽度等比缩放整页 */
  function fit() {
    if (!stage || !scaler) return;
    var page = scaler.querySelector('.doc-page');
    if (!page) return;
    var tokens = RS.tokens.resolve((currentData && currentData.theme) || {});
    var pageW = tokens.pageW;
    var avail = stage.clientWidth - 32;
    var scale = Math.min(1, Math.max(0.35, avail / pageW));
    var h = page.offsetHeight;
    scaler.style.transform = 'scale(' + scale + ')';
    scaler.style.left = Math.max(0, (stage.clientWidth - pageW * scale) / 2) + 'px';
    frame.style.height = Math.round(h * scale + 32) + 'px';
    scaler.dataset.scale = String(scale);
  }

  /** 页数测量 + 溢出预警 */
  function measure() {
    if (!scaler || !pageInfo) return;
    var page = scaler.querySelector('.doc-page');
    if (!page) return;
    var tokens = RS.tokens.resolve((currentData && currentData.theme) || {});
    var pageH = tokens.pageH;
    var h = page.offsetHeight;
    /* 8px 容差，避免亚像素误差误报 */
    var pages = Math.max(1, Math.ceil((h - 8) / pageH));
    var ratio = h / pageH;

    /* 找最占地方的板块，供精简建议 */
    var heaviest = null;
    var secs = page.querySelectorAll('.doc-section');
    for (var i = 0; i < secs.length; i++) {
      var hh = secs[i].offsetHeight;
      if (!heaviest || hh > heaviest.h) {
        heaviest = { h: hh, title: secs[i].getAttribute('data-sec-title') || '该板块' };
      }
    }

    lastMetrics = { pages: pages, height: h, ratio: ratio, heaviest: heaviest };

    pageInfo.textContent = '当前 ' + pages + ' 页 · 正文 ' + tokens.fsBody + 'px · A4 单面' +
      (pages > 1 ? ' · 实占 ' + ratio.toFixed(2) + ' 页' : '');

    var msg = '', cls = 'rs-ok';
    if (pages > 1) {
      cls = 'rs-bad';
      msg = '内容超出 1 页（约 ' + ratio.toFixed(2) + ' 页），建议精简「' +
        (heaviest ? heaviest.title : '内容最多的板块') + '」';
    } else if (ratio > 0.96) {
      cls = 'rs-warn';
      msg = '已接近一页底部，再加内容就会溢出';
    } else {
      msg = '版面正常，单页内';
    }
    warnBox.className = 'rs-warnbox ' + cls;
    warnBox.textContent = msg;
  }

  function init() {
    stage = el('rsStage');
    frame = el('rsFrame');
    scaler = el('rsScaler');
    pageInfo = el('rsPageInfo');
    warnBox = el('rsWarn');
    if (typeof ResizeObserver !== 'undefined' && stage) {
      var ro = new ResizeObserver(function () { fit(); });
      ro.observe(stage);
    } else {
      window.addEventListener('resize', function () { fit(); });
    }
  }

  RS.preview = {
    init: init,
    render: render,
    fit: fit,
    metrics: function () { return lastMetrics; }
  };
})();
