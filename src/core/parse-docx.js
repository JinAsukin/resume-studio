/**
 * 简历工坊 Resume Studio · DOCX 文本提取
 * docx 本质是 ZIP + XML，这里把 word/document.xml 还原成「逐行文本」，
 * 交给 core/parse-text.js 做结构化。不依赖 DOMParser，浏览器与 Node 行为一致。
 */
(function () {
  var RS = (typeof window !== 'undefined' ? (window.RS = window.RS || {}) : (globalThis.RS = globalThis.RS || {}));

  function unescapeXml(s) {
    return String(s)
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, function (m, d) { return String.fromCharCode(Number(d)); })
      .replace(/&amp;/g, '&');
  }

  /** 抽取单个 w:p 内的文本（w:t 取文，w:tab 转换表符，w:br 转换行） */
  function paraText(pXml) {
    var out = '';
    var re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:t(?:\s[^>]*)?\/>|<w:tab(?:\s[^>]*)?\/>|<w:br(?:\s[^>]*)?\/>/g;
    var m;
    while ((m = re.exec(pXml)) !== null) {
      if (m[0].indexOf('<w:tab') === 0) out += '\t';
      else if (m[0].indexOf('<w:br') === 0) out += '\n';
      else if (m[1] !== undefined) out += unescapeXml(m[1]);
    }
    return out;
  }

  /** 把 document.xml 拆成段落文本数组（保持文档顺序） */
  function extractLines(xml) {
    var lines = [];
    var re = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>|<w:p(?:\s[^>]*)?\/>/g;
    var m;
    while ((m = re.exec(xml)) !== null) {
      var t = paraText(m[0]);
      /* 段落内的软换行拆成独立行，便于后续结构化 */
      String(t).split('\n').forEach(function (part) { lines.push(part); });
    }
    return lines;
  }

  /**
   * 解析 docx 文件
   * @param {ArrayBuffer} arrayBuffer
   * @returns {Promise<{lines: string[], source: string}>}
   */
  function parse(arrayBuffer) {
    return RS.unzip.read(arrayBuffer).then(function (zip) {
      var doc = zip.files['word/document.xml'];
      if (!doc) throw new Error('这不是 Word 文档（缺少 word/document.xml）');
      var xml = RS.unzip.decodeUtf8(doc);
      return { lines: extractLines(xml), source: 'docx' };
    });
  }

  RS.parseDocx = { parse: parse, extractLines: extractLines, paraText: paraText };
})();
