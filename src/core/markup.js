/**
 * 简历工坊 Resume Studio · 内联标记解析
 * 语法：**文字** → 加粗；换行 → <br> / 独立 run。
 * 为什么不用结构化 emphasis 数组：手写方便、导入导出无损、迁移友好。
 */
(function () {
  var RS = (typeof window !== 'undefined' ? (window.RS = window.RS || {}) : (globalThis.RS = globalThis.RS || {}));

  function escapeHtml(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var BOLD_RE = /\*\*([\s\S]+?)\*\*/g;

  /** 解析为 run 列表：[{ text, bold }] */
  function toRuns(text) {
    var s = String(text === null || text === undefined ? '' : text);
    var runs = [];
    var last = 0;
    var m;
    BOLD_RE.lastIndex = 0;
    while ((m = BOLD_RE.exec(s)) !== null) {
      if (m.index > last) runs.push({ text: s.slice(last, m.index), bold: false });
      runs.push({ text: m[1], bold: true });
      last = m.index + m[0].length;
    }
    if (last < s.length) runs.push({ text: s.slice(last), bold: false });
    if (!runs.length) runs.push({ text: '', bold: false });
    return runs;
  }

  /** 转义后的安全 HTML */
  function toHtml(text) {
    return toRuns(text).map(function (r) {
      var t = escapeHtml(r.text).replace(/\n/g, '<br>');
      return r.bold ? '<b>' + t + '</b>' : t;
    }).join('');
  }

  /** 去掉标记的纯文本（用于长度统计、DOCX 文本） */
  function toPlain(text) {
    return String(text === null || text === undefined ? '' : text).replace(/\*\*/g, '');
  }

  /** 是否含有强调标记 */
  function hasBold(text) { return /\*\*[\s\S]+?\*\*/.test(String(text || '')); }

  RS.markup = {
    escapeHtml: escapeHtml,
    toRuns: toRuns,
    toHtml: toHtml,
    toPlain: toPlain,
    hasBold: hasBold
  };
})();
