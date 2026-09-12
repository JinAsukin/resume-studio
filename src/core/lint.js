/**
 * 简历工坊 Resume Studio · 成稿检查规则引擎
 * C1–C8 通用默认开启；C9（敏感低分项）、C10（板块顺序）默认关闭，避免把个人策略硬编进工具。
 */
(function () {
  var RS = (typeof window !== 'undefined' ? (window.RS = window.RS || {}) : (globalThis.RS = globalThis.RS || {}));

  var config = {
    enabled: {
      C1: true, C2: true, C3: true, C4: true, C5: true,
      C6: true, C7: true, C8: true, C9: false, C10: false
    },
    maxBulletLen: 60,
    maxBulletsPerItem: 5,
    photoMaxKB: 300,
    /* C9：命中即提示「是否确要写在纸上」，默认空表 */
    keywords: []
  };

  /* 量化成果：数字 + 单位/符号 */
  var QUANT_RE = /(\d[\d,.]*\s*(?:\+|%|万|千|余|家|人次|份|个|次|人|篇|字|条|项|名|所|支))/;

  function plain(s) { return RS.markup.toPlain(s); }

  /** 返回文本中「未被 ** 强调」的量化词 */
  function unemphasizedQuant(text) {
    var parts = String(text === null || text === undefined ? '' : text).split(/\*\*/);
    for (var i = 0; i < parts.length; i += 2) {
      var m = parts[i].match(QUANT_RE);
      if (m) return m[1].trim();
    }
    return null;
  }

  function eachBullet(data, fn) {
    (data.sections || []).forEach(function (sec) {
      if (sec.type === 'entry') {
        (sec.items || []).forEach(function (it) {
          (it.bullets || []).forEach(function (b, k) {
            fn(b, { section: sec, item: it, title: sec.title, index: k });
          });
        });
      } else if (sec.type === 'list') {
        (sec.bullets || []).forEach(function (b, k) {
          fn(b, { section: sec, title: sec.title, index: k });
        });
      } else if (sec.type === 'kv') {
        (sec.pairs || []).forEach(function (p, k) {
          fn((p.key ? p.key + '：' : '') + (p.value || ''), { section: sec, title: sec.title, index: k, isKv: true });
        });
      }
    });
  }

  function isSectionEmpty(sec) {
    if (sec.type === 'entry') {
      return !(sec.items || []).some(function (it) {
        return String(it.heading || '').trim() ||
          String(it.sub || '').trim() ||
          (it.bullets || []).some(function (b) { return String(b).trim(); });
      });
    }
    if (sec.type === 'kv') return !(sec.pairs || []).some(function (p) { return String(p.value || '').trim(); });
    if (sec.type === 'list') return !(sec.bullets || []).some(function (b) { return String(b).trim(); });
    if (sec.type === 'text') return !String(sec.body || '').trim();
    return true;
  }

  function run(data, metrics) {
    var out = [];
    var E = config.enabled;

    /* C1 页数溢出 */
    if (E.C1 && metrics && metrics.pages > 1) {
      var heavy = metrics.heaviest && metrics.heaviest.title;
      out.push({
        code: 'C1', level: 'red',
        message: '内容超出 1 页（约占 ' + Number(metrics.ratio || 0).toFixed(2) + ' 页）' +
          (heavy ? '，建议优先精简「' + heavy + '」' : '') + '。简历单页是硬规矩。'
      });
    }

    /* C2 必填项 */
    if (E.C2) {
      var missing = [];
      if (!String(data.meta.name || '').trim()) missing.push('姓名');
      var hasContact = (data.meta.contacts || []).some(function (c) { return String(c.value || '').trim(); });
      if (!hasContact) missing.push('至少一项联系方式');
      if (!(data.intent.positions || []).length) missing.push('求职意向');
      if (missing.length) {
        out.push({ code: 'C2', level: 'red', message: '缺少必填内容：' + missing.join('、') + '。' });
      }
    }

    /* C3 量化成果未强调 */
    if (E.C3) {
      var quantHits = [];
      eachBullet(data, function (b, ctx) {
        var q = unemphasizedQuant(b);
        if (q) quantHits.push({ q: q, title: ctx.title });
      });
      if (quantHits.length) {
        var sample = quantHits.slice(0, 3).map(function (x) { return x.q + '（' + x.title + '）'; }).join('、');
        out.push({
          code: 'C3', level: 'yellow',
          message: '有 ' + quantHits.length + ' 处量化成果没加粗：' + sample +
            '。用 **' + quantHits[0].q + '** 包起来，HR 扫一眼就能看见。'
        });
      }
    }

    /* C4 时间格式不统一 */
    if (E.C4) {
      var dotStyle = 0, cnStyle = 0;
      (data.sections || []).forEach(function (sec) {
        (sec.items || []).forEach(function (it) {
          var t = String(it.meta || '');
          if (/\d{4}\s*\.\s*\d{1,2}/.test(t)) dotStyle++;
          if (/\d{4}\s*年/.test(t)) cnStyle++;
        });
      });
      if (dotStyle && cnStyle) {
        out.push({ code: 'C4', level: 'yellow', message: '时间格式两种写法混用（如 2023.09 与 2023 年 9 月），建议统一。' });
      }
    }

    /* C5 单条要点过长 */
    if (E.C5) {
      var longs = [];
      eachBullet(data, function (b, ctx) {
        if (ctx.isKv) return;
        var len = plain(b).length;
        if (len > config.maxBulletLen) longs.push({ len: len, title: ctx.title });
      });
      if (longs.length) {
        out.push({
          code: 'C5', level: 'yellow',
          message: '有 ' + longs.length + ' 条要点超过 ' + config.maxBulletLen + ' 字（最长 ' +
            Math.max.apply(null, longs.map(function (l) { return l.len; })) + ' 字），建议拆成两条或删掉修饰词。'
        });
      }
    }

    /* C6 单条目要点过多 */
    if (E.C6) {
      var crowded = [];
      (data.sections || []).forEach(function (sec) {
        (sec.items || []).forEach(function (it) {
          var n = (it.bullets || []).filter(function (b) { return String(b).trim(); }).length;
          if (n > config.maxBulletsPerItem) crowded.push(sec.title + '（' + n + ' 条）');
        });
      });
      if (crowded.length) {
        out.push({
          code: 'C6', level: 'yellow',
          message: '这些条目要点偏多：' + crowded.join('、') + '。建议每条最多 ' + config.maxBulletsPerItem + ' 条，留下最能打的。'
        });
      }
    }

    /* C7 显示中但内容为空的板块 */
    if (E.C7) {
      var empties = (data.sections || []).filter(function (s) { return s.visible !== false && isSectionEmpty(s); });
      if (empties.length) {
        out.push({
          code: 'C7', level: 'yellow',
          message: '有 ' + empties.length + ' 个板块显示中但没有任何内容：' +
            empties.map(function (s) { return '「' + s.title + '」'; }).join('') + '，建议填上或关掉显示。'
        });
      }
    }

    /* C8 照片体积 */
    if (E.C8) {
      var photo = String(data.meta.photo || '');
      if (photo.indexOf('data:') === 0) {
        var kb = Math.round(photo.length * 0.75 / 1024);
        if (kb > config.photoMaxKB) {
          out.push({ code: 'C8', level: 'yellow', message: '证件照约 ' + kb + 'KB，偏大。重新上传一次会自动压缩，或换张小图。' });
        }
      } else if (!photo) {
        out.push({ code: 'C8', level: 'gray', message: '未上传证件照（部分岗位不要求，可忽略）。' });
      }
    }

    /* C9 敏感低分项关键词 */
    if (E.C9 && config.keywords.length) {
      var hits = [];
      var allText = JSON.stringify(data);
      config.keywords.forEach(function (kw) {
        if (kw && allText.indexOf(kw) >= 0) hits.push(kw);
      });
      if (hits.length) {
        out.push({
          code: 'C9', level: 'gray',
          message: '命中你的敏感词表：' + hits.join('、') + '。确认这些是否真要写在纸上——纸上做减法，被问再坦诚答。'
        });
      }
    }

    /* C10 板块顺序建议 */
    if (E.C10) {
      var visible = (data.sections || []).filter(function (s) { return s.visible !== false; });
      var eduIdx = -1;
      visible.forEach(function (s, i) { if (String(s.title).indexOf('教育') >= 0 && eduIdx < 0) eduIdx = i; });
      var isStudent = /届|在读|应届/.test(String(data.meta.headline || ''));
      if (isStudent && eduIdx > 0) {
        out.push({ code: 'C10', level: 'gray', message: '应届生简历通常「教育背景」放第一位，当前它在第 ' + (eduIdx + 1) + ' 位。' });
      }
    }

    return out;
  }

  RS.lint = {
    run: run,
    config: config,
    isSectionEmpty: isSectionEmpty,
    unemphasizedQuant: unemphasizedQuant
  };
})();
