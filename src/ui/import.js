/**
 * 简历工坊 Resume Studio · 旧简历导入
 * 支持：.docx（本地解析）、.txt/.md、直接粘贴文本（覆盖 PDF / 网页 / 微信来源）。
 * 全程本地完成，文件不上传。
 */
(function () {
  var RS = (typeof window !== 'undefined' ? (window.RS = window.RS || {}) : (globalThis.RS = globalThis.RS || {}));

  var pending = null;

  function esc(s) { return RS.markup.escapeHtml(s === null || s === undefined ? '' : s); }
  function id(x) { return document.getElementById(x); }

  /* ---------- 弹窗骨架 ---------- */
  function panelHtml() {
    return [
      '<p class="rs-modal-tip">在这里导入你的旧简历，自动填进编辑器。' +
      '支持 <b>.docx</b> 文件，或直接粘贴文本（从 PDF、网页、微信里复制都行）。' +
      '<b>解析全部在本机完成，文件不会上传。</b></p>',

      '<div class="rs-drop" id="rsDropZone">',
      '<div class="rs-drop-main">把 .docx 拖到这里</div>',
      '<div class="rs-drop-sub">或 <button type="button" class="rs-btn rs-btn-sm" id="rsPickFile">选择文件</button></div>',
      '</div>',
      '<input type="file" id="rsImportFile" accept=".docx,.txt,.md,.markdown,text/plain" hidden>',

      '<div class="rs-subhead">或者，粘贴简历文本</div>',
      '<textarea class="rs-area" id="rsPasteText" rows="5" ' +
      'placeholder="在 PDF / Word / 网页里 Ctrl+A 全选、Ctrl+C 复制，粘贴到这里，然后点「解析文本」"></textarea>',
      '<div class="rs-modal-actions">',
      '<button type="button" class="rs-btn rs-btn-primary" id="rsParseBtn">解析文本</button>',
      '<span class="rs-hint" id="rsParseHint">PDF 直接拖进来无效，请复制文本粘贴</span>',
      '</div>',

      '<div id="rsParseResult"></div>'
    ].join('');
  }

  /* ---------- 结果区 ---------- */
  function setStatus(msg, isErr) {
    var box = id('rsParseResult');
    if (box) box.innerHTML = '<div class="rs-parsestatus' + (isErr ? ' is-err' : '') + '">' + esc(msg) + '</div>';
    pending = null;
  }

  function renderResult(res) {
    pending = res;
    var r = res.report;
    var b = [];

    b.push('<div class="rs-result">');
    b.push('<div class="rs-subhead">识别结果</div>');
    b.push('<div class="rs-kvline"><span>姓名</span><b>' + esc(r.name || '未识别') + '</b></div>');
    if (r.headline) b.push('<div class="rs-kvline"><span>一句话</span><b>' + esc(r.headline) + '</b></div>');
    b.push('<div class="rs-kvline"><span>联系方式</span><b>' +
      (r.contacts.length ? esc(r.contacts.map(function (c) { return c.label + '=' + c.value; }).join('　')) : '未识别') +
      '</b></div>');
    b.push('<div class="rs-kvline"><span>文本行数</span><b>' + r.lineCount + '</b></div>');

    if (r.sections.length) {
      b.push('<div class="rs-subhead">识别到的板块（' + r.sections.length + ' 个）</div>');
      b.push('<ul class="rs-seclist">' + r.sections.map(function (s) {
        return '<li><span class="rs-secname">' + esc(s.title) + '</span>' +
          '<span class="rs-sectype">' + esc(s.type) + '</span>' +
          '<span class="rs-seccount">' + s.count + (s.type === 'text' ? ' 字' : ' 项') + '</span></li>';
      }).join('') + '</ul>');
    }

    if (r.warnings.length) {
      b.push('<div class="rs-warnbox-list">' + r.warnings.map(function (w) {
        return '<div class="rs-warnline">' + esc(w) + '</div>';
      }).join('') + '</div>');
    }

    b.push('<p class="rs-modal-tip">解析是启发式的，结构复杂的简历可能需要手动微调 —— ' +
      '但比对着空白表单从零填快得多。</p>');
    b.push('<div class="rs-modal-actions">' +
      '<button type="button" class="rs-btn rs-btn-primary" id="rsApplyBtn">应用到编辑器</button>' +
      '<button type="button" class="rs-btn" id="rsCancelBtn">取消</button>' +
      '</div>');
    b.push('</div>');

    id('rsParseResult').innerHTML = b.join('');
  }

  /* ---------- 文件处理 ---------- */
  function handleFile(f) {
    if (!f) return;
    var name = String(f.name || '').toLowerCase();

    if (/\.docx$/.test(name)) {
      setStatus('正在读取 ' + f.name + ' …');
      var reader = new FileReader();
      reader.onload = function () {
        RS.parseDocx.parse(reader.result).then(function (r) {
          if (!r.lines.filter(function (l) { return l.trim(); }).length) {
            setStatus('这个文档里没有读到文字（可能是纯图片排版），建议手动填写', true);
            return;
          }
          renderResult(RS.parseText.resume(r.lines));
        }).catch(function (e) {
          setStatus('解析失败：' + e.message, true);
        });
      };
      reader.onerror = function () { setStatus('文件读取失败，换一个文件试试', true); };
      reader.readAsArrayBuffer(f);
      return;
    }

    if (/\.(txt|md|markdown)$/.test(name) || String(f.type || '').indexOf('text/') === 0) {
      var tr = new FileReader();
      tr.onload = function () { renderResult(RS.parseText.resume(tr.result)); };
      tr.onerror = function () { setStatus('文件读取失败', true); };
      tr.readAsText(f, 'utf-8');
      return;
    }

    if (/\.doc$/.test(name)) {
      setStatus('旧版 .doc 无法直接解析：请用 Word 另存为 .docx，或全选复制文本粘贴到下面', true);
      return;
    }
    if (/\.pdf$/.test(name)) {
      setStatus('PDF 不直接解析（中文 PDF 编码复杂，容易出错）：请打开 PDF 全选复制，粘贴到下面 —— 这样反而更准', true);
      return;
    }
    setStatus('不认识这种文件，请用 .docx 或直接粘贴文本', true);
  }

  /* ---------- 应用 ---------- */
  function apply() {
    if (!pending) return;
    if (!confirm('将用导入结果替换当前编辑器里的内容（你已上传的证件照会保留）。继续？')) return;
    var next = RS.schema.deepClone(pending.data);
    var oldPhoto = RS.store.raw().meta && RS.store.raw().meta.photo;
    if (!next.meta.photo && oldPhoto) next.meta.photo = oldPhoto;
    RS.store.replaceData(next);
    RS.toolbar.closeModal();
    RS.toolbar.toast('已导入，请核对姓名、联系方式与板块归属');
  }

  /* ---------- 打开与绑定 ---------- */
  function bind() {
    var zone = id('rsDropZone');
    var file = id('rsImportFile');

    zone.addEventListener('click', function () { file.click(); });
    zone.addEventListener('dragover', function (e) {
      e.preventDefault();
      zone.classList.add('is-over');
    });
    zone.addEventListener('dragleave', function () { zone.classList.remove('is-over'); });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.classList.remove('is-over');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleFile(f);
    });
    file.addEventListener('change', function () {
      if (file.files && file.files[0]) handleFile(file.files[0]);
      file.value = '';
    });

    id('rsParseBtn').addEventListener('click', function () {
      var text = id('rsPasteText').value;
      if (!String(text).trim()) { RS.toolbar.toast('先粘贴一些文本再解析', 'bad'); return; }
      renderResult(RS.parseText.resume(text));
    });

    id('rsParseResult').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b) return;
      if (b.id === 'rsApplyBtn') apply();
      else if (b.id === 'rsCancelBtn') RS.toolbar.closeModal();
    });
  }

  function open() {
    pending = null;
    RS.toolbar.openModal('从旧简历导入', panelHtml());
    bind();
  }

  RS.importer = { open: open };
})();
