/**
 * 简历工坊 Resume Studio · 表单
 * 职责：渲染填写界面、绑定输入（路径写回数据）、折叠交互、照片压缩。
 * 关键约定：输入不重建 DOM（避免焦点丢失），只有结构性变更才整体重渲染。
 */
(function () {
  var RS = (typeof window !== 'undefined' ? (window.RS = window.RS || {}) : (globalThis.RS = globalThis.RS || {}));

  var root = null;
  var collapsed = {};          /* key -> true */
  var pendingScroll = null;

  function esc(s) { return RS.markup.escapeHtml(s === null || s === undefined ? '' : s); }
  function lines(v) {
    return String(v || '').split('\n').map(function (s) { return s.trim(); }).filter(function (s) { return s !== ''; });
  }

  /** 照片规格提示：尺寸、体积、以及是否偏大 */
  function photoHint(m) {
    var out = ['<span class="rs-hint">自动裁成 3:4 并压缩为 JPEG</span>'];
    var photo = String((m && m.photo) || '');
    if (photo.indexOf('data:') === 0) {
      var kb = Math.round(photo.length * 0.75 / 1024);
      out.push('<span class="rs-hint' + (kb > 300 ? ' rs-hint-warn' : '') + '">当前 420 × 560 px · 约 ' +
        kb + ' KB' + (kb > 300 ? '（偏大）' : '') + '</span>');
    } else if (photo) {
      out.push('<span class="rs-hint">当前使用外部图片链接</span>');
    }
    return out.join('');
  }

  /* ---------- 原子控件 ---------- */
  function field(label, path, value, ph, extra) {
    return '<label class="rs-field' + (extra ? ' ' + extra : '') + '">' +
      '<span class="rs-label">' + esc(label) + '</span>' +
      '<input class="rs-input" type="text" data-path="' + esc(path) + '" value="' + esc(value) + '"' +
      (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>' +
      '</label>';
  }

  function areaLines(label, path, value, ph, rows) {
    var v = Array.isArray(value) ? value.join('\n') : (value || '');
    return '<label class="rs-field">' +
      '<span class="rs-label">' + esc(label) + '</span>' +
      '<textarea class="rs-area" rows="' + (rows || 3) + '" data-array="' + esc(path) + '"' +
      (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>' + esc(v) + '</textarea>' +
      '</label>';
  }

  function areaText(label, path, value, ph, rows) {
    return '<label class="rs-field">' +
      '<span class="rs-label">' + esc(label) + '</span>' +
      '<textarea class="rs-area" rows="' + (rows || 3) + '" data-path="' + esc(path) + '"' +
      (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>' + esc(value || '') + '</textarea>' +
      '</label>';
  }

  function card(key, title, hint, body) {
    var isCollapsed = collapsed[key] ? ' is-collapsed' : '';
    return '<section class="rs-card' + isCollapsed + '" data-card="' + esc(key) + '">' +
      '<header class="rs-card-head">' +
      '<button type="button" class="rs-collapse" data-act="collapse" data-key="' + esc(key) + '" aria-label="折叠">▾</button>' +
      '<span class="rs-card-title">' + esc(title) + '</span>' +
      '<span class="rs-card-hint">' + esc(hint || '') + '</span>' +
      '</header>' +
      '<div class="rs-card-body">' + body + '</div>' +
      '</section>';
  }

  /* ---------- 基本信息 ---------- */
  function cardMeta(d) {
    var m = d.meta || {};
    var b = [];
    b.push('<div class="rs-grid2">');
    b.push(field('姓名', 'meta.name', m.name, '张三'));
    b.push(field('姓名拼音（可选）', 'meta.nameEn', m.nameEn, 'Zhang San'));
    b.push('</div>');
    b.push(field('一句话定位', 'meta.headline', m.headline, '2027 届本科应届生 · 某某大学 社会学'));
    b.push(areaLines('基本信息标签（一行一条）', 'meta.facts', m.facts, '20 岁\n男\n汉族', 3));

    b.push('<div class="rs-subhead">联系方式</div>');
    (m.contacts || []).forEach(function (c, i) {
      b.push('<div class="rs-row">' +
        '<input class="rs-input rs-w-90" type="text" data-path="meta.contacts.' + i + '.label" value="' + esc(c.label) + '" placeholder="标签">' +
        '<input class="rs-input" type="text" data-path="meta.contacts.' + i + '.value" value="' + esc(c.value) + '" placeholder="内容">' +
        '<button type="button" class="rs-icon" data-act="remove-contact" data-index="' + i + '" title="删除">×</button>' +
        '</div>');
    });
    b.push('<button type="button" class="rs-btn rs-btn-sm" data-act="add-contact">＋ 添加联系方式</button>');

    b.push('<div class="rs-subhead">证件照</div>');
    b.push('<div class="rs-row rs-row-photo">' +
      '<div class="rs-photo-box' + (m.photo ? ' has-photo' : '') + '" data-act="pick-photo" ' +
      'title="点击选择 / 直接拖入图片 / Ctrl+V 粘贴">' +
      (m.photo ? '<img src="' + esc(m.photo) + '" alt="">' : '<span>点击 · 拖入 · 粘贴</span>') +
      '</div>' +
      '<div class="rs-photo-actions">' +
      '<div class="rs-row">' +
      '<label class="rs-btn rs-btn-sm">选择图片<input type="file" accept="image/*" data-act="photo" hidden></label>' +
      (m.photo ? '<button type="button" class="rs-btn rs-btn-sm" data-act="remove-photo">移除</button>' : '') +
      '</div>' +
      photoHint(m) +
      '</div></div>');

    return card('meta', '基本信息', m.name ? '已填写' : '待填写', b.join(''));
  }

  /* ---------- 求职意向 ---------- */
  function cardIntent(d) {
    var it = d.intent || {};
    var b = [];
    b.push(areaLines('岗位方向（一行一条，界面上以「、」连接）', 'intent.positions', it.positions,
      '市场/用户研究\n社会调研与项目执行\n研究/运营助理', 3));
    b.push(areaLines('标签行（一行一条，**文字** 表示加粗）', 'intent.highlights', it.highlights,
      '社会学\n国家级企业调查 · 个人触达 **130+** 家', 3));
    var n = (it.positions || []).length;
    return card('intent', '求职意向', n ? n + ' 个方向' : '待填写', b.join(''));
  }

  /* ---------- 个人简介 ---------- */
  function cardSummary(d) {
    var b = areaText('简介正文（3–4 行最佳）', 'summary', d.summary,
      '社会学本科。参与 1 项国家级企业调查与 3 次区域田野调研……', 4);
    return card('summary', '个人简介', d.summary ? '已填写' : '可选', b);
  }

  /* ---------- 板块 ---------- */
  function itemBlock(sec, i, it, j) {
    var base = 'sections.' + i + '.items.' + j + '.';
    var b = [];
    b.push('<div class="rs-item">');
    b.push('<div class="rs-item-bar">' +
      '<span class="rs-item-no">' + (j + 1) + '</span>' +
      '<span class="rs-spacer"></span>' +
      '<button type="button" class="rs-icon" data-act="move-item-up" data-sec="' + esc(sec.id) + '" data-item="' + esc(it.id) + '" title="上移">↑</button>' +
      '<button type="button" class="rs-icon" data-act="move-item-down" data-sec="' + esc(sec.id) + '" data-item="' + esc(it.id) + '" title="下移">↓</button>' +
      '<button type="button" class="rs-icon" data-act="remove-item" data-sec="' + esc(sec.id) + '" data-item="' + esc(it.id) + '" title="删除">×</button>' +
      '</div>');
    b.push(field('条目名称', base + 'heading', it.heading, '某某大学 · 社会学（本科）'));
    b.push('<div class="rs-grid2">');
    b.push(field('时间', base + 'meta', it.meta, '2023.09 – 2027.06'));
    b.push(field('补充说明（可选）', base + 'sub', it.sub, '主修：社会研究方法、社会统计学'));
    b.push('</div>');
    b.push(areaLines('要点（一行一条，**文字** 表示加粗）', base + 'bullets', it.bullets,
      '独立触达 **130+** 家企业，面向中高层开展陌生拜访', 4));
    b.push('</div>');
    return b.join('');
  }

  function cardSection(d, sec, i) {
    var key = sec.id;
    var b = [];
    b.push(field('板块标题', 'sections.' + i + '.title', sec.title, '教育背景'));
    b.push(field('板块导语（可选，灰色小字）', 'sections.' + i + '.note', sec.note, '三次调研累计产出约 **3 万字**'));

    if (sec.type === 'entry') {
      (sec.items || []).forEach(function (it, j) { b.push(itemBlock(sec, i, it, j)); });
      b.push('<button type="button" class="rs-btn rs-btn-sm" data-act="add-item" data-sec="' + esc(sec.id) + '">＋ 添加条目</button>');
    } else if (sec.type === 'kv') {
      (sec.pairs || []).forEach(function (p, j) {
        b.push('<div class="rs-row">' +
          '<input class="rs-input rs-w-140" type="text" data-path="sections.' + i + '.pairs.' + j + '.key" value="' + esc(p.key) + '" placeholder="分类（如 研究方法）">' +
          '<input class="rs-input" type="text" data-path="sections.' + i + '.pairs.' + j + '.value" value="' + esc(p.value) + '" placeholder="内容">' +
          '<button type="button" class="rs-icon" data-act="remove-pair" data-sec="' + esc(sec.id) + '" data-index="' + j + '" title="删除">×</button>' +
          '</div>');
      });
      b.push('<button type="button" class="rs-btn rs-btn-sm" data-act="add-pair" data-sec="' + esc(sec.id) + '">＋ 添加一行</button>');
    } else if (sec.type === 'list') {
      b.push(areaLines('条目（一行一条）', 'sections.' + i + '.bullets', sec.bullets, '证明材料一\n证明材料二', 4));
    } else if (sec.type === 'text') {
      b.push(areaText('正文', 'sections.' + i + '.body', sec.body, '自我评价……', 4));
    }

    var hint = (sec.visible === false ? '已隐藏' : '显示中');
    var isCollapsed = collapsed[key] ? ' is-collapsed' : '';
    return '<section class="rs-card rs-sec' + isCollapsed + '" data-card="' + esc(key) + '" data-sec-id="' + esc(sec.id) + '">' +
      '<header class="rs-card-head">' +
      '<button type="button" class="rs-collapse" data-act="collapse" data-key="' + esc(key) + '" aria-label="折叠">▾</button>' +
      '<input class="rs-input rs-sec-title" type="text" data-path="sections.' + i + '.title" value="' + esc(sec.title) + '" aria-label="板块标题">' +
      '<span class="rs-card-hint">' + esc(hint) + '</span>' +
      '<select class="rs-select rs-select-sm" data-act="change-type" data-sec="' + esc(sec.id) + '" title="板块类型">' +
      RS.schema.SECTION_TYPES.map(function (t) {
        return '<option value="' + t + '"' + (t === sec.type ? ' selected' : '') + '>' + esc(t) + '</option>';
      }).join('') +
      '</select>' +
      '<label class="rs-switch" title="是否在简历中显示">' +
      '<input type="checkbox" data-act="toggle-visible" data-sec="' + esc(sec.id) + '"' + (sec.visible === false ? '' : ' checked') + '>' +
      '<span>显示</span></label>' +
      '<button type="button" class="rs-icon" data-act="move-sec-up" data-sec="' + esc(sec.id) + '" title="上移">↑</button>' +
      '<button type="button" class="rs-icon" data-act="move-sec-down" data-sec="' + esc(sec.id) + '" title="下移">↓</button>' +
      '<button type="button" class="rs-icon rs-danger" data-act="remove-sec" data-sec="' + esc(sec.id) + '" title="删除">×</button>' +
      '</header>' +
      '<div class="rs-card-body">' + b.join('') + '</div>' +
      '</section>';
  }

  function addSectionBar() {
    return '<div class="rs-addsec">' +
      '<select class="rs-select" id="rsAddPreset">' +
      RS.schema.SECTION_PRESETS.map(function (p, i) {
        return '<option value="' + i + '">' + esc(p.label) + '</option>';
      }).join('') +
      '</select>' +
      '<button type="button" class="rs-btn" data-act="add-section">＋ 添加板块</button>' +
      '</div>';
  }

  /* ---------- 总渲染 ---------- */
  function buildHtml(d) {
    var out = [];
    out.push(cardMeta(d));
    out.push(cardIntent(d));
    out.push(cardSummary(d));
    var visibleCount = (d.sections || []).filter(function (s) { return s.visible !== false; }).length;
    out.push('<div class="rs-block-title">内容板块 <span class="rs-count">' + visibleCount + ' / ' + (d.sections || []).length + ' 个显示中</span></div>');
    (d.sections || []).forEach(function (sec, i) { out.push(cardSection(d, sec, i)); });
    out.push(addSectionBar());
    return out.join('');
  }

  function render(data) {
    if (!root) return;
    var scroller = root.parentElement;
    var top = scroller ? scroller.scrollTop : 0;
    root.innerHTML = buildHtml(data);
    if (scroller) scroller.scrollTop = top;
  }

  /* ---------- 事件 ---------- */
  function onInput(e) {
    var el = e.target;
    if (!el || !el.dataset) return;
    if (el.dataset.path) {
      RS.store.set(el.dataset.path, el.value);
    } else if (el.dataset.array) {
      RS.store.set(el.dataset.array, lines(el.value));
    }
  }

  function onChange(e) {
    var el = e.target;
    if (!el || !el.dataset) return;
    var act = el.dataset.act;
    if (act === 'toggle-visible') {
      RS.sections.toggleVisible(el.dataset.sec);
    } else if (act === 'change-type') {
      RS.sections.changeType(el.dataset.sec, el.value);
    } else if (act === 'photo') {
      handlePhoto(el.files && el.files[0]);
    }
  }

  function onClick(e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el || !el.dataset) return;
    var act = el.dataset.act;
    if (act === 'collapse') {
      var key = el.dataset.key;
      collapsed[key] = !collapsed[key];
      var cardEl = root.querySelector('[data-card="' + key + '"]');
      if (cardEl) cardEl.classList.toggle('is-collapsed', !!collapsed[key]);
      return;
    }
    if (act === 'pick-photo') {
      var fileInput = root.querySelector('input[data-act="photo"]');
      if (fileInput) fileInput.click();
      return;
    }
    var sec = el.dataset.sec;
    switch (act) {
      case 'add-section': {
        var sel = root.querySelector('#rsAddPreset');
        var preset = RS.schema.SECTION_PRESETS[Number(sel && sel.value) || 0];
        RS.sections.addSection(preset.type, preset.title);
        break;
      }
      case 'remove-sec': RS.sections.removeSection(sec); break;
      case 'move-sec-up': RS.sections.moveSection(sec, 'up'); break;
      case 'move-sec-down': RS.sections.moveSection(sec, 'down'); break;
      case 'add-item': RS.sections.addItem(sec); break;
      case 'remove-item': RS.sections.removeItem(sec, el.dataset.item); break;
      case 'move-item-up': RS.sections.moveItem(sec, el.dataset.item, 'up'); break;
      case 'move-item-down': RS.sections.moveItem(sec, el.dataset.item, 'down'); break;
      case 'add-pair': RS.sections.addPair(sec); break;
      case 'remove-pair': RS.sections.removePair(sec, Number(el.dataset.index)); break;
      case 'add-contact': RS.store.mutate(function (d) { d.meta.contacts.push({ label: '', value: '' }); }); break;
      case 'remove-contact': RS.store.mutate(function (d) { d.meta.contacts.splice(Number(el.dataset.index), 1); }); break;
      case 'remove-photo': RS.store.set('meta.photo', ''); break;
      default: break;
    }
  }

  /* ---------- 拖拽与粘贴 ---------- */
  function notify(msg, kind) {
    if (RS.toolbar && RS.toolbar.toast) RS.toolbar.toast(msg, kind);
  }

  function photoBoxEl() { return root ? root.querySelector('[data-act="pick-photo"]') : null; }

  function setDropActive(on) {
    var box = photoBoxEl();
    if (box) box.classList.toggle('is-drop', !!on);
  }

  function onDragOver(e) {
    var dt = e.dataTransfer;
    if (!dt) return;
    var types = dt.types ? Array.prototype.slice.call(dt.types) : [];
    if (types.indexOf('Files') < 0) return;
    /* 阻止浏览器直接打开拖入的文件 */
    e.preventDefault();
    try { dt.dropEffect = 'copy'; } catch (err) { /* 部分浏览器只读 */ }
    setDropActive(true);
  }

  function onDragLeave(e) {
    if (!root || !e.relatedTarget || !root.contains(e.relatedTarget)) setDropActive(false);
  }

  function onDrop(e) {
    var dt = e.dataTransfer;
    if (!dt || !dt.files || !dt.files.length) return;
    e.preventDefault();
    setDropActive(false);
    var f = dt.files[0];
    if (/^image\//.test(f.type)) {
      handlePhoto(f);
    } else {
      notify('这里只接收图片。导入旧简历请用「更多 → 导入旧简历」', 'bad');
    }
  }

  function onPaste(e) {
    var items = (e.clipboardData && e.clipboardData.items) || [];
    for (var i = 0; i < items.length; i++) {
      if (String(items[i].type || '').indexOf('image') === 0) {
        var f = items[i].getAsFile();
        if (f) {
          e.preventDefault();
          handlePhoto(f);
          return;
        }
      }
    }
  }

  /* ---------- 照片压缩 ---------- */
  function handlePhoto(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { notify('请选择图片文件', 'bad'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var TW = 420, TH = 560;
        var canvas = document.createElement('canvas');
        canvas.width = TW;
        canvas.height = TH;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, TW, TH);
        /* 等比裁剪填充（证件照比例） */
        var scale = Math.max(TW / img.width, TH / img.height);
        var w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (TW - w) / 2, (TH - h) / 2, w, h);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.84);
        RS.store.set('meta.photo', dataUrl);
        var kb = Math.round(dataUrl.length * 0.75 / 1024);
        notify('证件照已插入 · 420×560 · 约 ' + kb + ' KB');
      };
      img.onerror = function () { notify('图片读取失败，换一张试试', 'bad'); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function init(el) {
    root = el;
    el.addEventListener('input', onInput);
    el.addEventListener('change', onChange);
    el.addEventListener('click', onClick);
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
    document.addEventListener('paste', onPaste);
  }

  RS.form = { init: init, render: render };
})();
