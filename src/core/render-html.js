/**
 * 简历工坊 Resume Studio · HTML 渲染器
 * 输入 ResumeJSON，输出 A4 文档结构（视觉全部交给 document.css + 设计令牌）。
 * 渲染器只负责结构，不负责样式 —— 主题切换无需重新渲染。
 */
(function () {
  var RS = (typeof window !== 'undefined' ? (window.RS = window.RS || {}) : (globalThis.RS = globalThis.RS || {}));
  var md = RS.markup;

  function T(s) { return String(s === null || s === undefined ? '' : s).trim(); }

  function renderHeader(d) {
    var m = d.meta || {};
    var name = T(m.name);
    var photo = T(m.photo);
    var subBits = [];
    if (T(m.headline)) subBits.push(md.toHtml(T(m.headline)));
    var facts = (m.facts || []).map(T).filter(Boolean);
    if (facts.length) subBits.push(md.escapeHtml(facts.join(' · ')));

    var contacts = (m.contacts || []).filter(function (c) { return T(c && c.value); });
    var contactHtml = contacts.map(function (c) {
      return '<span>' + md.escapeHtml(T(c.label) ? T(c.label) + '：' : '') + md.toHtml(T(c.value)) + '</span>';
    }).join('');

    var who = [];
    if (name) who.push('<h1 class="doc-name">' + md.toHtml(name) + '</h1>');
    if (T(m.nameEn)) who.push('<div class="doc-name-en">' + md.escapeHtml(T(m.nameEn)) + '</div>');
    if (subBits.length) who.push('<div class="doc-sub">' + subBits.join(' ｜ ') + '</div>');
    if (contactHtml) who.push('<div class="doc-contact">' + contactHtml + '</div>');

    var photoHtml = photo ? '<img class="doc-photo" src="' + md.escapeHtml(photo) + '" alt="">' : '';
    if (!who.length && !photoHtml) return '';
    return '<header class="doc-header">' + photoHtml + '<div class="doc-who">' + who.join('') + '</div></header>';
  }

  function renderIntent(d) {
    var it = d.intent || {};
    var out = [];
    var positions = (it.positions || []).map(T).filter(Boolean);
    if (positions.length) {
      out.push('<div class="doc-intent"><span class="doc-intent-k">求职意向：</span>' +
        md.escapeHtml(positions.join('、')) + '</div>');
    }
    var tags = (it.highlights || []).map(T).filter(Boolean);
    if (tags.length) {
      out.push('<div class="doc-tags">' + tags.map(function (t) {
        return '<span>' + md.toHtml(t) + '</span>';
      }).join('<span class="doc-tag-sep">｜</span>') + '</div>');
    }
    return out.join('');
  }

  function renderSummary(d) {
    var s = T(d.summary);
    return s ? '<div class="doc-summary">' + md.toHtml(s) + '</div>' : '';
  }

  function renderEntryItems(items) {
    var html = [];
    (items || []).forEach(function (it) {
      var heading = T(it.heading);
      var metaText = T(it.meta);
      var sub = T(it.sub);
      var bullets = (it.bullets || []).map(T).filter(Boolean);
      if (!heading && !sub && !bullets.length) return;

      var head = '';
      if (heading || metaText) {
        head = '<div class="doc-item-head">' +
          '<span class="doc-item-title">' + md.toHtml(heading) + '</span>' +
          (metaText ? '<span class="doc-item-meta">' + md.escapeHtml(metaText) + '</span>' : '') +
          '</div>';
      }
      var subHtml = sub ? '<div class="doc-item-sub">' + md.toHtml(sub) + '</div>' : '';
      var ul = bullets.length ? '<ul class="doc-bullets">' + bullets.map(function (b) {
        return '<li>' + md.toHtml(b) + '</li>';
      }).join('') + '</ul>' : '';
      html.push('<div class="doc-item">' + head + subHtml + ul + '</div>');
    });
    return html.join('');
  }

  function renderKv(pairs) {
    var list = (pairs || []).filter(function (p) { return T(p && p.key) || T(p && p.value); });
    if (!list.length) return '';
    return '<ul class="doc-kv">' + list.map(function (p) {
      var k = T(p.key);
      return '<li>' + (k ? '<span class="doc-kv-k">' + md.escapeHtml(k) + '：</span>' : '') +
        md.toHtml(T(p.value)) + '</li>';
    }).join('') + '</ul>';
  }

  function renderList(bullets) {
    var list = (bullets || []).map(T).filter(Boolean);
    if (!list.length) return '';
    return '<ul class="doc-bullets">' + list.map(function (b) {
      return '<li>' + md.toHtml(b) + '</li>';
    }).join('') + '</ul>';
  }

  function renderSection(sec) {
    if (sec.visible === false) return '';
    var body = '';
    if (sec.type === 'entry') body = renderEntryItems(sec.items);
    else if (sec.type === 'kv') body = renderKv(sec.pairs);
    else if (sec.type === 'list') body = renderList(sec.bullets);
    else if (sec.type === 'text') body = T(sec.body) ? '<div class="doc-text">' + md.toHtml(T(sec.body)) + '</div>' : '';

    var title = T(sec.title);
    if (!body && !title) return '';
    if (!body) return '';

    var note = T(sec.note) ? '<div class="doc-note">' + md.toHtml(T(sec.note)) + '</div>' : '';
    return '<section class="doc-section" data-sec-title="' + md.escapeHtml(title) + '">' +
      (title ? '<h2 class="doc-h2">' + md.escapeHtml(title) + '</h2>' : '') +
      note + body + '</section>';
  }

  /** 主入口：ResumeJSON → A4 文档 HTML */
  function render(data) {
    var d = data || RS.schema.blank();
    var parts = ['<article class="doc-page" id="rsDocPage">'];
    parts.push(renderHeader(d));
    parts.push(renderIntent(d));
    parts.push(renderSummary(d));
    (d.sections || []).forEach(function (s) { parts.push(renderSection(s)); });
    parts.push('</article>');
    return parts.join('');
  }

  RS.renderHtml = { render: render };
})();
