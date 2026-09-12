/**
 * 简历工坊 Resume Studio · 顶栏
 * 职责：版本切换与管理、主题自定义、成稿检查入口、导出菜单、存档状态、通用弹窗。
 */
(function () {
  var RS = (typeof window !== 'undefined' ? (window.RS = window.RS || {}) : (globalThis.RS = globalThis.RS || {}));

  var els = {};
  var currentData = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return RS.markup.escapeHtml(s === null || s === undefined ? '' : s); }

  /* ---------- 下拉菜单 ---------- */
  function closeMenus(except) {
    document.querySelectorAll('.rs-menu').forEach(function (m) {
      if (m !== except) m.hidden = true;
    });
  }

  function toggleMenu(menu, fill) {
    if (!menu) return;
    var willOpen = menu.hidden;
    closeMenus(menu);
    if (willOpen) {
      if (fill) fill(menu);
      menu.hidden = false;
    } else {
      menu.hidden = true;
    }
  }

  /* ---------- 弹窗 ---------- */
  function openModal(title, bodyHtml) {
    els.modalTitle.textContent = title;
    els.modalBody.innerHTML = bodyHtml;
    els.modal.hidden = false;
  }
  function closeModal() { els.modal.hidden = true; }

  function toast(msg, kind) {
    var t = document.createElement('div');
    t.className = 'rs-toast ' + (kind ? 'rs-toast-' + kind : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('is-in'); }, 10);
    setTimeout(function () {
      t.classList.remove('is-in');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 260);
    }, 2600);
  }

  /* ---------- 版本 ---------- */
  function fillVersionMenu(menu) {
    var versions = RS.store.versions();
    var idx = RS.store.versionIndex();
    var html = versions.map(function (v, i) {
      return '<button type="button" data-ver="' + i + '"' + (i === idx ? ' class="is-active"' : '') + '>' +
        esc(v.name) + (i === idx ? '<span class="rs-menu-note">当前</span>' : '') + '</button>';
    }).join('');
    html += '<div class="rs-menu-sep"></div>';
    html += '<button type="button" data-ver-act="new">＋ 新建版本（复制当前）</button>';
    html += '<button type="button" data-ver-act="manage">管理版本与差量…</button>';
    menu.innerHTML = html;
  }

  function openVersionManager() {
    var versions = RS.store.versions();
    var idx = RS.store.versionIndex();
    var b = [];
    b.push('<p class="rs-modal-tip">版本之间共享同一份主数据，只记录「差量字段」。在下方列出的是本版本的覆盖项。</p>');
    versions.forEach(function (v, i) {
      var names = Object.keys(v.overrides || {});
      b.push('<div class="rs-vrow' + (i === idx ? ' is-current' : '') + '">' +
        '<input class="rs-input" type="text" data-ver-name="' + i + '" value="' + esc(v.name) + '">' +
        (i === idx ? '<span class="rs-badge">当前</span>' : '<button class="rs-btn rs-btn-sm" data-ver-switch="' + i + '">切换</button>') +
        '<button class="rs-icon rs-danger" data-ver-del="' + i + '"' + (versions.length <= 1 ? ' disabled' : '') + ' title="删除">×</button>' +
        '</div>');
      if (names.length) {
        b.push('<ul class="rs-ovlist">' + names.map(function (n) {
          return '<li><code>' + esc(n) + '</code><button class="rs-icon rs-danger" data-ver-clear="' + i + '|' + esc(n) + '" title="移除该差量">×</button></li>';
        }).join('') + '</ul>');
      }
    });
    b.push('<div class="rs-modal-actions"><button class="rs-btn" data-ver-act="new2">＋ 新建版本</button></div>');
    openModal('版本与差量', b.join(''));
  }

  /* ---------- 主题 ---------- */
  function openThemePanel() {
    var t = RS.tokens.resolve(currentData.theme);
    var fonts = [
      { v: '"Microsoft YaHei","PingFang SC","Hiragino Sans GB","Source Han Sans CN",sans-serif', l: '微软雅黑 / 苹方（默认）' },
      { v: '"Source Han Serif CN","Songti SC","SimSun",serif', l: '思源宋体 / 宋体（正式）' },
      { v: '"Source Han Sans CN","PingFang SC","Microsoft YaHei",sans-serif', l: '思源黑体（现代）' },
      { v: 'system-ui,-apple-system,"Segoe UI",sans-serif', l: '系统默认无衬线' }
    ];
    var b = [];
    b.push('<div class="rs-tfield"><label>主题主色</label>' +
      '<input type="color" id="rsAccent" value="' + esc(t.accent) + '">' +
      '<span class="rs-hint">影响标题、强调与分隔线</span></div>');
    b.push('<div class="rs-tfield"><label>整体字号</label>' +
      '<input type="range" id="rsScale" min="0.88" max="1.14" step="0.01" value="' + esc(t.fontScale) + '">' +
      '<span class="rs-hint" id="rsScaleVal">' + Math.round(t.fontScale * 100) + '%</span></div>');
    b.push('<div class="rs-tfield"><label>正文字体</label>' +
      '<select class="rs-select" id="rsFont">' +
      fonts.map(function (f) { return '<option value="' + esc(f.v) + '"' + (f.v === t.fontFamily ? ' selected' : '') + '>' + esc(f.l) + '</option>'; }).join('') +
      '</select></div>');
    b.push('<div class="rs-tfield"><label>证件照尺寸</label>' +
      '<select class="rs-select" id="rsPhotoSize">' +
      RS.tokens.PHOTO_PRESETS.map(function (p) {
        var cur = Number(t.photoW) === p.w && Number(t.photoH) === p.h;
        return '<option value="' + p.w + 'x' + p.h + '"' + (cur ? ' selected' : '') + '>' + esc(p.label) + '</option>';
      }).join('') +
      '</select></div>');
    b.push('<div class="rs-modal-actions">' +
      '<button class="rs-btn" id="rsThemeReset">恢复默认</button>' +
      '<button class="rs-btn" id="rsThemeExport">导出主题</button>' +
      '<button class="rs-btn" id="rsThemeImport">导入主题</button>' +
      '</div>');
    openModal('主题自定义', b.join(''));
  }

  /* ---------- 检查 ---------- */
  function openCheckPanel() {
    if (!RS.lint) { toast('检查模块未加载', 'bad'); return; }
    var issues = RS.lint.run(currentData, RS.preview.metrics());
    var b = [];
    if (!issues.length) {
      b.push('<p class="rs-modal-tip">未发现明显问题。发布前建议再人工读一遍。</p>');
    } else {
      var order = { red: 0, yellow: 1, gray: 2 };
      issues.sort(function (a, c) { return order[a.level] - order[c.level]; });
      b.push('<ul class="rs-issuelist">' + issues.map(function (it) {
        return '<li class="rs-issue rs-issue-' + it.level + '">' +
          '<span class="rs-issue-code">' + esc(it.code) + '</span>' +
          '<span class="rs-issue-text">' + esc(it.message) + '</span></li>';
      }).join('') + '</ul>');
    }
    b.push('<p class="rs-modal-tip">规则可在 <code>src/core/lint.js</code> 中调整开关与阈值。</p>');
    openModal('成稿检查', b.join(''));
  }

  /* ---------- 导出 ---------- */
  function doExport(kind) {
    var data = currentData;
    if (kind === 'pdf') {
      RS.exportPdf.print(data);
    } else if (kind === 'html') {
      RS.io.exportHtml(data);
      toast('已导出网页文件');
    } else if (kind === 'json') {
      RS.io.exportJson(data);
      toast('已导出数据备份');
    } else if (kind === 'docx') {
      if (!RS.renderDocx) { toast('Word 模块未加载', 'bad'); return; }
      toast('正在生成 Word 文档…');
      RS.renderDocx.export(data).then(function () {
        toast('已导出 Word 文档');
      }).catch(function (e) {
        console.error(e);
        toast('Word 导出失败：' + e.message, 'bad');
      });
    }
  }

  /* ---------- 更多 ---------- */
  function doMore(kind) {
    if (kind === 'import-resume') {
      if (RS.importer) RS.importer.open();
      else toast('导入模块未加载', 'bad');
    } else if (kind === 'demo') {
      if (confirm('载入示例数据将覆盖当前内容，继续？')) { RS.store.loadDemo(); toast('已载入示例数据'); }
    } else if (kind === 'blank') {
      if (confirm('新建空白简历将覆盖当前内容，继续？')) { RS.store.resetEmpty(); toast('已新建空白简历'); }
    } else if (kind === 'import') {
      els.fileInput.click();
    } else if (kind === 'clear') {
      if (confirm('将清除本机浏览器中保存的所有简历数据，且不可恢复。建议先导出备份。继续？')) {
        RS.store.clearStorage();
        RS.store.resetEmpty();
        toast('本机数据已清除');
      }
    } else if (kind === 'shortcut') {
      openModal('快捷键与小贴士', [
        '<ul class="rs-tiplist">',
        '<li><b>**文字**</b> 表示加粗，写要点时用它强调数字与结果</li>',
        '<li>要点、标签、技能都支持<b>一行一条</b>，从旧简历整段粘贴最快</li>',
        '<li>证件照支持<b>点击选择 / 直接拖入 / Ctrl+V 粘贴</b>三种方式</li>',
        '<li>旧简历可用「更多 → 从旧简历导入」自动填表（支持 .docx 与粘贴文本）</li>',
        '<li>导出 PDF 时在打印窗口把「边距」选为<b>无</b>、勾选<b>背景图形</b></li>',
        '<li>打印目标选「另存为 PDF」，文件名会自动带上姓名</li>',
        '<li>所有数据只存在你自己电脑的浏览器里，不上传任何服务器</li>',
        '</ul>'
      ].join(''));
    }
  }

  function importJson(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = RS.schema.normalize(JSON.parse(reader.result));
        RS.store.replaceData(data);
        toast('已导入：' + (data.meta.name || '未命名'));
      } catch (e) {
        toast('导入失败：不是有效的数据文件', 'bad');
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  /* ---------- 同步 ---------- */
  function sync(data, reason) {
    currentData = data;
    if (!els.versionLabel) return;
    var versions = RS.store.versions();
    var v = versions[RS.store.versionIndex()];
    els.versionLabel.textContent = (v ? v.name : '默认版本');
    if (reason === 'saved' || reason === 'change' || reason === 'structure' || reason === 'version' || reason === 'replace') {
      els.savedNote.textContent = RS.store.storageOK() ? '已自动保存至本机' : '本机存储不可用，请及时导出备份';
      els.savedNote.classList.toggle('rs-danger-text', !RS.store.storageOK());
    }
  }

  /* ---------- 初始化 ---------- */
  function init() {
    els.versionLabel = $('rsVersionLabel');
    els.versionMenu = $('rsVersionMenu');
    els.exportMenu = $('rsExportMenu');
    els.moreMenu = $('rsMoreMenu');
    els.savedNote = $('rsSavedNote');
    els.modal = $('rsModal');
    els.modalTitle = $('rsModalTitle');
    els.modalBody = $('rsModalBody');
    els.fileInput = $('rsFileInput');

    document.getElementById('rsVersionBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      toggleMenu(els.versionMenu, fillVersionMenu);
    });
    document.getElementById('rsExportBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      toggleMenu(els.exportMenu);
    });
    document.getElementById('rsMoreBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      toggleMenu(els.moreMenu);
    });
    document.getElementById('rsThemeBtn').addEventListener('click', function (e) {
      e.stopPropagation(); closeMenus(); openThemePanel();
    });
    document.getElementById('rsCheckBtn').addEventListener('click', function (e) {
      e.stopPropagation(); closeMenus(); openCheckPanel();
    });
    document.getElementById('rsModalClose').addEventListener('click', closeModal);

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.rs-dd')) closeMenus();
      if (e.target === els.modal) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeMenus(); closeModal(); }
    });

    /* 菜单与弹窗内的委托 */
    els.versionMenu.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.ver !== undefined) { RS.store.setVersion(Number(b.dataset.ver)); closeMenus(); }
      else if (b.dataset.verAct === 'new') { RS.store.addVersion(); closeMenus(); toast('已新建版本'); }
      else if (b.dataset.verAct === 'manage') { closeMenus(); openVersionManager(); }
    });

    els.exportMenu.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || !b.dataset.export) return;
      closeMenus();
      doExport(b.dataset.export);
    });

    els.moreMenu.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || !b.dataset.more) return;
      closeMenus();
      doMore(b.dataset.more);
    });

    els.modalBody.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.verSwitch !== undefined) { RS.store.setVersion(Number(b.dataset.verSwitch)); openVersionManager(); }
      else if (b.dataset.verDel !== undefined) {
        if (confirm('删除该版本？差量设置将一并丢失。')) { RS.store.removeVersion(Number(b.dataset.verDel)); openVersionManager(); }
      } else if (b.dataset.verClear) {
        var parts = b.dataset.verClear.split('|');
        var vi = Number(parts[0]);
        var vname = parts.slice(1).join('|');
        if (vi === RS.store.versionIndex()) { RS.store.setOverride(vname, ''); }
        else { toast('请先切换到该版本再移除差量'); }
        openVersionManager();
      } else if (b.dataset.verAct === 'new' || b.dataset.verAct === 'new2') {
        RS.store.addVersion(); openVersionManager();
      } else if (b.id === 'rsThemeReset') {
        RS.store.mutate(function (d) { d.theme.tokens = {}; });
        openThemePanel(); toast('已恢复默认主题');
      } else if (b.id === 'rsThemeExport') {
        RS.io.downloadText('resume-studio-theme.json',
          JSON.stringify({ name: 'custom', tokens: RS.store.raw().theme.tokens || {} }, null, 2), 'application/json');
        toast('已导出主题');
      } else if (b.id === 'rsThemeImport') {
        els.themeFileInput.click();
      }
    });

    els.modalBody.addEventListener('input', function (e) {
      var el = e.target;
      if (el.id === 'rsAccent') RS.store.mutate(function (d) { d.theme.tokens.accent = el.value; });
      else if (el.id === 'rsScale') {
        RS.store.mutate(function (d) { d.theme.tokens.fontScale = Number(el.value); });
        var sv = document.getElementById('rsScaleVal');
        if (sv) sv.textContent = Math.round(Number(el.value) * 100) + '%';
      } else if (el.dataset && el.dataset.verName !== undefined) {
        RS.store.renameVersion(Number(el.dataset.verName), el.value);
      }
    });
    els.modalBody.addEventListener('change', function (e) {
      var el = e.target;
      if (el.id === 'rsFont') RS.store.mutate(function (d) { d.theme.tokens.fontFamily = el.value; });
      else if (el.id === 'rsPhotoSize') {
        var wh = String(el.value).split('x');
        RS.store.mutate(function (d) {
          d.theme.tokens.photoW = Number(wh[0]);
          d.theme.tokens.photoH = Number(wh[1]);
        });
      }
    });

    els.fileInput.addEventListener('change', function () { importJson(els.fileInput.files[0]); els.fileInput.value = ''; });
    els.themeFileInput = $('rsThemeFileInput');
    els.themeFileInput.addEventListener('change', function () {
      var f = els.themeFileInput.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          var obj = JSON.parse(r.result);
          RS.store.mutate(function (d) { d.theme.tokens = obj.tokens || obj || {}; });
          openThemePanel();
          toast('已导入主题');
        } catch (err) { toast('主题文件无效', 'bad'); }
      };
      r.readAsText(f, 'utf-8');
      els.themeFileInput.value = '';
    });
  }

  RS.toolbar = { init: init, sync: sync, toast: toast, openModal: openModal, closeModal: closeModal };
})();
