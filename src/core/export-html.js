/**
 * 简历工坊 Resume Studio · 文件产出
 * 职责：安全文件名、下载、生成「干净 HTML」（自包含、可直接分享）。
 * 同时暴露通用下载工具 RS.io.download。
 */
(function () {
  var RS = (typeof window !== 'undefined' ? (window.RS = window.RS || {}) : (globalThis.RS = globalThis.RS || {}));

  function safeFileName(name, ext) {
    var base = String(name === null || name === undefined ? '' : name)
      .replace(/[\\/:*?"<>|\r\n\t]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (!base) base = 'resume';
    return base + (ext || '');
  }

  function download(filename, blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 400);
  }

  function downloadText(filename, text, mime) {
    download(filename, new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' }));
  }

  /** 把数据安全嵌进 HTML（防止 </script> 截断） */
  function embedData(data) {
    return JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '');
  }

  /** 生成自包含的干净 HTML（单文件，可分享、可打印） */
  function buildDocument(data) {
    var tokens = RS.tokens.resolve(data.theme);
    var vars = RS.tokens.toCssVars(tokens);
    var css = RS.documentCss || '';
    var inner = RS.renderHtml.render(data);
    var title = (data.meta && data.meta.name ? data.meta.name : '简历') + ' · 简历';

    return [
      '<!DOCTYPE html>',
      '<html lang="zh-CN">',
      '<head>',
      '<meta charset="UTF-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<title>' + RS.markup.escapeHtml(title) + '</title>',
      '<style>',
      vars,
      css,
      'html,body{margin:0;padding:0;background:#f3f4f6;}',
      'body{display:flex;justify-content:center;padding:20px 0;}',
      '.doc-page{box-shadow:0 1px 4px rgba(0,0,0,.12);}',
      '@media print{html,body{background:#fff;}body{display:block;padding:0;}.doc-page{box-shadow:none;margin:0 auto;}}',
      '</style>',
      '</head>',
      '<body>',
      inner,
      '<script type="application/json" id="rs-data">' + embedData(data) + '<\/script>',
      '</body>',
      '</html>'
    ].join('\n');
  }

  function exportHtml(data) {
    var html = buildDocument(data);
    var name = (data.meta && data.meta.name ? data.meta.name + '-简历' : 'resume');
    download(safeFileName(name, '.html'), new Blob([html], { type: 'text/html;charset=utf-8' }));
  }

  /** 备份 / 恢复（内部存档格式，不占对外主按钮） */
  function exportJson(data) {
    var name = (data.meta && data.meta.name ? data.meta.name + '-简历数据' : 'resume-data');
    downloadText(safeFileName(name, '.json'), JSON.stringify(data, null, 2), 'application/json');
  }

  RS.io = {
    safeFileName: safeFileName,
    download: download,
    downloadText: downloadText,
    buildDocument: buildDocument,
    exportHtml: exportHtml,
    exportJson: exportJson
  };
})();
