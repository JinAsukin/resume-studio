/**
 * 简历工坊 Resume Studio · 文本结构化解析
 * 把「逐行文本」（来自 docx 或直接粘贴）启发式还原成 ResumeJSON。
 * 设计原则：宁少勿错 —— 拿不准的就不填，用户改比重填容易。
 */
(function () {
  var RS = (typeof window !== 'undefined' ? (window.RS = window.RS || {}) : (globalThis.RS = globalThis.RS || {}));

  /* ---------- 规则表 ---------- */
  var SECTION_KEYS = [
    { re: /^(教育背景|教育经历|学习经历|教育情况|教育与培训|教育)$/, type: 'entry', title: '教育背景' },
    { re: /^(实习经历|实习经验|工作经历|工作经验|职业经历|任职经历|实践经历)$/, type: 'entry', title: '实习经历' },
    { re: /^(项目经历|项目经验|科研经历|研究经历|竞赛经历|比赛经历|获奖项目)$/, type: 'entry', title: '项目 · 竞赛 · 实践' },
    { re: /^(校园经历|在校经历|学生工作|社团经历|社会实践|社会活动|组织经历)$/, type: 'entry', title: '校园经历' },
    { re: /^(专业技能|技能特长|技能证书|技能|计算机能力|语言能力|证书|资质)$/, type: 'kv', title: '专业技能' },
    { re: /^(荣誉奖项|获奖情况|奖项荣誉|奖学金|获奖|荣誉|表彰)$/, type: 'list', title: '荣誉奖项' },
    { re: /^(自我评价|个人评价|个人简介|自我介绍|关于我|个人优势|自我描述)$/, type: 'text', title: '自我评价' },
    { re: /^(?:可提供的|可提供|相关|其他|补充)?(?:证明材料|证明|作品集|作品|附件|补充材料)$/, type: 'list', title: '可提供的证明材料' }
  ];

  /* 兜底：形如「田野调研经历 / 志愿活动 / 项目 · 竞赛 · 在校实践 / 技术实践 · AI 与开源」的自定义板块名 */
  var LOOSE_SECTION_RE = /^[\u4e00-\u9fa5A-Za-z·\s]{2,14}(?:经历|实践|调研|调查|活动|开源|成果|作品|特长)$/;

  var TIME_RE = /(\d{4}\s*[.\-/年]\s*\d{0,2}\s*月?)\s*[–—\-~至到]+\s*(\d{4}\s*[.\-/年]\s*\d{0,2}\s*月?|至今|现在|今|present|now)/i;
  var SINGLE_TIME_RE = /[（(]\s*(\d{4}\s*[.\-/年]\s*\d{1,2}\s*月?)\s*[）)]/;
  var PHONE_RE = /1[3-9]\d[\s-]?\d{4}[\s-]?\d{4}/g;
  var EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  var LINK_RE = /(?:https?:\/\/)?(?:www\.)?(?:github\.com|gitee\.com|gitlab\.com|[\w-]+\.(?:com|cn|net|org|io|me|dev|top))(?:\/[\w\-.#?=&%]+)*/gi;
  var BULLET_RE = /^[\s]*[•·▪◦‣∙*＊\-–—○●]+\s*/;
  /* 板块导语特征：明显的总结性表述，例如「三次调研累计产出约 3 万字」 */
  var NOTE_HINT_RE = /累计|共计|合计|总计|共\s*\d|约\s*\d|累计产出|累计完成/;
  /* 补充说明特征：课程/培养方向这类文字更适合放在条目下方的小字里 */
  var SUB_HINT_RE = /^(主修|课程|专业课程|核心课程|所学课程|研究方向|培养方向|主要课程)/;
  var NAME_BAD_RE = /简历|个人|应聘|求职|电话|手机|邮箱|地址|大学|学院|学校|专业|本科|硕士|博士|应届|届|@|\d|：|:/;
  var FACT_RULES = [
    { label: '', re: /\d{1,2}\s*岁/ },
    { label: '', re: /^(男|女)$/ },
    { label: '', re: /^(汉族|回族|满族|壮族|苗族|土家族|彝族|藏族|蒙古族)$/ },
    { label: '', re: /^(中共党员|中共预备党员|共青团员|群众|民主党派)$/ }
  ];

  function uid(p) { return RS.schema.uid(p); }

  /** 联系方式去重（同一个 GitHub 链接常在简历里出现多次） */
  function dedupe(list) {
    var seen = {};
    return (list || []).filter(function (c) {
      var k = c.label + '|' + c.value;
      if (seen[k]) return false;
      seen[k] = 1;
      return true;
    });
  }

  /* ---------- 预处理 ---------- */
  function preprocess(input) {
    var raw = Array.isArray(input) ? input : String(input === null || input === undefined ? '' : input).split(/\r?\n/);
    return raw.map(function (l) {
      return String(l).replace(/\u00a0/g, ' ').replace(/[ ]{2,}/g, ' ').replace(/^[\s]+|[\s]+$/g, '');
    });
  }

  function cleanTitle(line) {
    return String(line)
      .replace(/^[\s（(【\[]*/, '')
      .replace(/^[一二三四五六七八九十\d]{1,2}\s*[、.．)）】\]]\s*/, '')
      .replace(/[:：\s]+$/, '')
      .replace(/[（(【\[].*?[）)】\]]/g, '')
      .replace(/[\s]+/g, '')
      .trim();
  }

  function stripBullet(line) {
    return String(line).replace(BULLET_RE, '').trim();
  }

  function cleanHeading(s) {
    return String(s)
      .replace(/\t/g, ' ')
      .replace(/[（(]\s*[）)]/g, ' ')
      .replace(/[\s]{2,}/g, ' ')
      .replace(/^[\s\-–—·、,，:：|｜]+/, '')
      .replace(/[\s\-–—·、,，:：|｜]+$/, '')
      .trim();
  }

  function matchSection(line) {
    var t = cleanTitle(line);
    if (!t || t.length > 14) return null;
    for (var i = 0; i < SECTION_KEYS.length; i++) {
      if (SECTION_KEYS[i].re.test(t)) return SECTION_KEYS[i];
    }
    if (t.length <= 14 && LOOSE_SECTION_RE.test(t)) {
      var raw = String(line).replace(/\t[\s\S]*$/, '').trim();
      return { type: 'entry', title: raw || t, loose: true };
    }
    return null;
  }

  /* ---------- 联系方式收割 ---------- */
  function harvest(line, acc) {
    var rest = String(line);
    function take(re) {
      var g = new RegExp(re.source, re.flags.indexOf('g') >= 0 ? re.flags : re.flags + 'g');
      var hits = rest.match(g) || [];
      hits.forEach(function (h) { rest = rest.replace(h, ' '); });
      return hits;
    }
    var emails = take(EMAIL_RE);
    var phones = take(PHONE_RE);
    var wx = /(?:微信|WeChat|wechat)\s*[:：]?\s*([A-Za-z0-9_.\-]{4,})/.exec(rest);
    if (wx) rest = rest.replace(wx[0], ' ');
    var qq = /QQ\s*[:：]?\s*([0-9]{5,12})/i.exec(rest);
    if (qq) rest = rest.replace(qq[0], ' ');

    var links = [];
    var lm;
    var linkRe = new RegExp(LINK_RE.source, 'gi');
    while ((lm = linkRe.exec(rest)) !== null) {
      /* 已在本行出现过的邮箱域名不算链接 */
      if (emails.some(function (e) { return e.indexOf(lm[0]) >= 0; })) continue;
      links.push(lm[0]);
      rest = rest.replace(lm[0], ' ');
    }

    emails.forEach(function (e) { acc.contacts.push({ label: '邮箱', value: e }); });
    phones.forEach(function (p) { acc.contacts.push({ label: '电话', value: p.replace(/[\s-]/g, '') }); });
    links.forEach(function (l) { acc.contacts.push({ label: '链接', value: l.replace(/^https?:\/\//, '') }); });
    if (wx) acc.contacts.push({ label: '微信', value: wx[1] });
    if (qq) acc.contacts.push({ label: 'QQ', value: qq[1] });

    return rest.replace(/[（(]\s*[）)]/g, ' ').replace(/[\s]{2,}/g, ' ').replace(/^[:：、,，|｜\s]+|[:：、,，|｜\s]+$/g, '').trim();
  }

  /* ---------- 头部信息 ---------- */
  function detectName(lines) {
    for (var i = 0; i < Math.min(lines.length, 10); i++) {
      var l = lines[i];
      var m = /^(?:姓名|名字)\s*[:：]\s*(.+)$/.exec(l);
      if (m) return cleanHeading(m[1]).replace(/[\s]/g, '');
      /* 姓名常被排版成「王 坤 森」，先去空格再判断 */
      var t = String(l).replace(/\s|\t/g, '');
      if (!/^[\u4e00-\u9fa5·]{2,4}$/.test(t)) continue;
      if (NAME_BAD_RE.test(t)) continue;
      if (matchSection(l)) continue;   /* 别把「教育背景」这种板块标题当姓名 */
      return t;
    }
    return '';
  }

  function detectHeadline(lines, name) {
    for (var i = 0; i < Math.min(lines.length, 12); i++) {
      var t = lines[i];
      if (!t || t === name) continue;
      if (/届|应届|在读|本科|硕士|博士|研究生|大学|学院/.test(t) && t.length <= 60) {
        var plain = t.replace(/\t/g, ' ｜ ').trim();
        if (plain) return plain;
      }
    }
    return '';
  }

  function detectIntent(lines) {
    for (var i = 0; i < lines.length; i++) {
      var m = /^(?:求职意向|应聘职位|意向岗位|目标岗位|求职目标|应聘意向)\s*[:：]?\s*(.+)$/.exec(lines[i]);
      if (m) {
        /* 注意：不要把「/」当分隔符 —— 「市场/用户研究」是一个整体 */
        return m[1].split(/[、,，|｜；;]/).map(function (s) { return s.trim(); }).filter(Boolean);
      }
    }
    return [];
  }

  function detectFacts(lines) {
    var facts = [];
    lines.slice(0, 14).forEach(function (l) {
      var parts = l.split(/[\s｜|·、]+/);
      parts.forEach(function (p) {
        var t = p.trim();
        if (!t || t.length > 8) return;
        for (var i = 0; i < FACT_RULES.length; i++) {
          if (FACT_RULES[i].re.test(t) && facts.indexOf(t) < 0) { facts.push(t); return; }
        }
      });
    });
    return facts.slice(0, 6);
  }

  /* ---------- 条目切分 ---------- */
  function splitHeadingTime(line) {
    var meta = '';
    var heading = line;
    var m = TIME_RE.exec(line);
    if (m) {
      meta = m[0].replace(/\s*[–—\-~至到]+\s*/, ' – ').replace(/\s{2,}/g, ' ').trim();
      heading = (line.slice(0, m.index) + ' ' + line.slice(m.index + m[0].length));
    } else {
      var m2 = SINGLE_TIME_RE.exec(line);
      if (m2) {
        meta = m2[1];
        heading = line.replace(m2[0], ' ');
      }
    }
    return { heading: cleanHeading(heading), meta: meta };
  }

  /* 组织/机构特征词：用于区分「XX大学XX协会 — 部长：职责」与「严格执行流程：甲乙丙丁」 */
  var ORG_HINT_RE = /大学|学院|学校|公司|集团|协会|中心|研究院|研究所|实验室|社团|委员会|部门|机构|银行|医院|中学|工作室|基金会/;

  function looksLikeHeading(line, curItem) {
    var t = stripBullet(line);
    if (!t) return false;
    if (TIME_RE.test(line) || SINGLE_TIME_RE.test(line)) return true;

    /* 「单位 — 职位：职责」格式：冒号前必须带组织名或破折号，才认定是新条目标题 */
    var m = /^(.{4,34}?)\s*[:：]\s*(.{8,})$/.exec(t);
    if (m && !/[。；;]/.test(m[1]) && (ORG_HINT_RE.test(m[1]) || /[—–-]/.test(m[1]))) return true;

    /* 短行 + 当前条目已有要点 → 新条目标题 */
    if (t.length <= 24 && !/[。；;]$/.test(t) && curItem && curItem.bullets.length > 0) return true;
    return false;
  }

  function parseEntrySection(lines) {
    var items = [];
    var note = '';
    var cur = null;

    function pushItem(heading, meta) {
      var h = heading || '';
      var first = '';
      /* 长句里「：」之后通常是要点，不该算作标题的一部分 */
      var m = /^(.{4,34}?)\s*[:：]\s*(.{8,})$/.exec(h);
      if (m) { h = m[1]; first = m[2].trim(); }
      cur = {
        id: uid('item'), heading: cleanHeading(h), meta: meta || '',
        sub: '', bullets: first ? [first] : []
      };
      items.push(cur);
      return cur;
    }

    lines.forEach(function (rawLine) {
      var line = rawLine.trim();
      if (!line) return;

      var isBullet = BULLET_RE.test(line);
      var body = stripBullet(line);
      if (!body) return;

      /* 板块开头的总结句 → 板块导语（note）。必须带总结词，否则会把首个条目吃掉 */
      if (!items.length && !note && !isBullet && NOTE_HINT_RE.test(body) &&
        body.length >= 18 && !TIME_RE.test(body) && !SINGLE_TIME_RE.test(body)) {
        note = body;
        return;
      }

      if (isBullet) {
        if (!cur) pushItem('', '');
        cur.bullets.push(body);
        return;
      }

      if (looksLikeHeading(line, cur)) {
        var st = splitHeadingTime(line);
        pushItem(st.heading, st.meta);
        return;
      }

      if (!cur) {
        var st0 = splitHeadingTime(line);
        /* 首行若是一整句长文（无标题特征、无时间），当作要点而不是标题 */
        if (st0.heading.length > 34 && !st0.meta) {
          pushItem('', '');
          cur.bullets.push(body);
          return;
        }
        pushItem(st0.heading, st0.meta);
        return;
      }

      /* 条目已有标题但还没有要点，且本行像补充说明 → 放到条目的 sub 里 */
      if (!cur.bullets.length && !cur.sub && (body.length <= 40 || SUB_HINT_RE.test(body))) {
        cur.sub = body;
        return;
      }

      cur.bullets.push(body);
    });

    return {
      items: items.filter(function (it) { return it.heading || it.sub || it.bullets.length; }),
      note: note
    };
  }

  function parseKvSection(lines) {
    var pairs = [];
    lines.forEach(function (rawLine) {
      var line = stripBullet(rawLine.trim());
      if (!line) return;
      var m = /^(.{2,14}?)\s*[:：]\s*(.+)$/.exec(line);
      if (m) pairs.push({ key: m[1].trim(), value: m[2].trim() });
      else pairs.push({ key: '', value: line });
    });
    return pairs;
  }

  function parseListSection(lines) {
    return lines.map(function (l) { return stripBullet(l.trim()); }).filter(Boolean);
  }

  /* ---------- 主入口 ---------- */
  function resume(input) {
    var warnings = [];
    var lines = preprocess(input).filter(function (l) { return l !== ''; });

    if (!lines.length) {
      warnings.push('没有读到任何文本内容');
      return { data: RS.schema.blank(), report: { name: '', contacts: [], sections: [], warnings: warnings, lineCount: 0 } };
    }

    /* 1) 收割联系方式，得到"清洗后"的行 */
    var acc = { contacts: [] };
    var cleaned = lines.map(function (l) { return harvest(l, acc); });

    /* 2) 头部信息 */
    var name = detectName(cleaned);
    var headline = detectHeadline(cleaned, name);
    var positions = detectIntent(cleaned);
    var facts = detectFacts(cleaned);

    /* 3) 按板块标题切分 */
    var buckets = [];
    var current = null;
    cleaned.forEach(function (line, idx) {
      if (!line) return;
      var hit = matchSection(line);
      if (hit) {
        current = { meta: hit, lines: [] };
        buckets.push(current);
        return;
      }
      if (current) current.lines.push(line);
      else if (idx > 8) {
        /* 头部区域之后的散落内容，先攒着，最后归入"其他" */
        if (!buckets.length || buckets[0].meta.type !== '__head__') {
          /* 不新建 bucket，直接忽略以避免噪音 */
        }
      }
    });

    /* 4) 逐板块解析 */
    var sections = [];
    var report = [];
    buckets.forEach(function (b) {
      var body = b.lines.filter(function (l) { return l !== ''; });
      if (!body.length) return;
      var sec = {
        id: uid('sec'), type: b.meta.type, title: b.meta.title, visible: true, note: ''
      };
      var count = 0;
      if (b.meta.type === 'entry') {
        var parsed = parseEntrySection(body);
        var only = parsed.items[0];
        if (parsed.items.length === 1 && only && !only.heading && !only.meta && only.bullets.length) {
          /* 整块只有一个「无标题纯要点」条目 → 降级为纯列表，版式更自然 */
          sec.type = 'list';
          sec.bullets = only.bullets.slice();
          count = sec.bullets.length;
        } else {
          sec.items = parsed.items.length ? parsed.items : [RS.schema.blankItem()];
          count = parsed.items.length;
        }
        sec.note = parsed.note || '';
      } else if (b.meta.type === 'kv') {
        sec.pairs = parseKvSection(body);
        count = sec.pairs.length;
      } else if (b.meta.type === 'list') {
        sec.bullets = parseListSection(body);
        count = sec.bullets.length;
      } else {
        sec.body = body.join('\n');
        count = 1;
      }
      if (!count) return;
      sections.push(sec);
      report.push({ title: sec.title, type: sec.type, count: count });
    });

    /* 5) 组装 */
    var contacts = dedupe(acc.contacts);
    var data = RS.schema.normalize({
      schemaVersion: RS.schema.SCHEMA_VERSION,
      meta: {
        name: name,
        nameEn: '',
        photo: '',
        headline: headline,
        facts: facts,
        contacts: contacts.length ? contacts : [{ label: '电话', value: '' }, { label: '邮箱', value: '' }]
      },
      intent: { positions: positions, highlights: [] },
      summary: '',
      sections: sections.length ? sections : [RS.schema.blankSection('entry', '教育背景')],
      theme: { name: 'classic-blue', tokens: {} },
      versions: [{ name: '默认版本', overrides: {} }]
    });

    /* 6) 体检提示 */
    if (!name) warnings.push('没识别出姓名，请手动填写');
    if (!acc.contacts.length) warnings.push('没识别出联系方式，请手动填写');
    if (!sections.length) warnings.push('没识别出任何板块，可能简历结构比较特殊，建议手动整理');
    if (!positions.length) warnings.push('没识别出求职意向，请手动填写');

    return {
      data: data,
      report: {
        name: name,
        headline: headline,
        contacts: contacts,
        sections: report,
        warnings: warnings,
        lineCount: lines.length
      }
    };
  }

  RS.parseText = {
    resume: resume,
    matchSection: matchSection,
    splitHeadingTime: splitHeadingTime,
    parseEntrySection: parseEntrySection,
    cleanTitle: cleanTitle
  };
})();
