/**
 * 简历工坊 Resume Studio · 数据模型（ResumeJSON）
 * 设计要点：
 *  1) 板块只有四种类型 —— entry / kv / list / text，通用性全靠这个；
 *  2) 强调用内联标记 **文字**，不用结构化数组；
 *  3) 多版本用 overrides 差量，不复制整份数据。
 */
(function () {
  var RS = (typeof window !== 'undefined' ? (window.RS = window.RS || {}) : (globalThis.RS = globalThis.RS || {}));

  var SCHEMA_VERSION = '1.0';
  var SECTION_TYPES = ['entry', 'kv', 'list', 'text'];

  var TYPE_LABEL = {
    entry: '条目型（教育 / 实习 / 项目 / 竞赛…）',
    kv: '键值型（技能 / 证书 / 语言…）',
    list: '纯列表（证明材料 / 成果清单…）',
    text: '纯文本（自我评价 / 补充说明…）'
  };

  var _seq = 0;
  function uid(prefix) {
    _seq += 1;
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + _seq.toString(36);
  }

  function blankItem() {
    return { id: uid('item'), heading: '', meta: '', sub: '', bullets: [] };
  }

  function blankSection(type, title) {
    var s = {
      id: uid('sec'),
      type: SECTION_TYPES.indexOf(type) >= 0 ? type : 'entry',
      title: title || '新板块',
      visible: true,
      note: ''
    };
    if (s.type === 'entry') s.items = [blankItem()];
    if (s.type === 'kv') s.pairs = [{ key: '', value: '' }];
    if (s.type === 'list') s.bullets = [];
    if (s.type === 'text') s.body = '';
    return s;
  }

  /** 添加板块时的可选预设 */
  var SECTION_PRESETS = [
    { key: 'entry-education', label: '教育背景', type: 'entry', title: '教育背景' },
    { key: 'entry-experience', label: '实习 / 工作经历', type: 'entry', title: '实习经历' },
    { key: 'entry-project', label: '项目 · 竞赛 · 实践', type: 'entry', title: '项目 · 竞赛 · 实践' },
    { key: 'entry-custom', label: '自定义条目板块', type: 'entry', title: '自定义板块' },
    { key: 'kv-skills', label: '专业技能', type: 'kv', title: '专业技能' },
    { key: 'list-proof', label: '证明材料 / 成果清单', type: 'list', title: '证明材料' },
    { key: 'text-about', label: '自我评价 / 补充说明', type: 'text', title: '自我评价' }
  ];

  function blank() {
    return {
      schemaVersion: SCHEMA_VERSION,
      meta: {
        name: '',
        nameEn: '',
        photo: '',
        headline: '',
        facts: [],
        contacts: [
          { label: '电话', value: '' },
          { label: '邮箱', value: '' }
        ]
      },
      intent: { positions: [], highlights: [] },
      summary: '',
      sections: [blankSection('entry', '教育背景')],
      theme: { name: 'classic-blue', tokens: {} },
      versions: [{ name: '默认版本', overrides: {} }]
    };
  }

  /** 虚构人物示例数据（人物、学校、机构均为虚构） */
  function demo() {
    return {
      schemaVersion: SCHEMA_VERSION,
      meta: {
        name: '林知远',
        nameEn: 'Lin Zhiyuan',
        photo: '',
        headline: '2027 届本科应届生 · 云岭大学 社会学',
        facts: ['20 岁', '男', '汉族'],
        contacts: [
          { label: '电话', value: '138 0000 0000' },
          { label: '邮箱', value: 'linzhiyuan@example.com' },
          { label: 'GitHub', value: 'github.com/example' }
        ]
      },
      intent: {
        positions: ['市场/用户研究', '社会调研与项目执行', '研究/运营助理'],
        highlights: ['社会学', '国家级企业调查 · 个人触达 **130+** 家', '3 次田野约 **3 万字**']
      },
      summary: '社会学本科。参与 1 项国家级企业调查与 3 次区域田野调研，具备「问卷—访谈—编码—报告」全链条研究能力。熟练运用 AI agent 辅助检索、文档处理与流程自动化，执行力经实战验证。',
      sections: [
        {
          id: uid('sec'), type: 'entry', title: '教育背景', visible: true, note: '',
          items: [{
            id: uid('item'),
            heading: '云岭大学 · 社会学（本科）',
            meta: '2023.09 – 2027.06',
            sub: '主修：社会研究方法、社会统计学、社会学概论、社会心理学、发展社会学',
            bullets: []
          }]
        },
        {
          id: uid('sec'), type: 'entry', title: '实习经历', visible: true, note: '',
          items: [{
            id: uid('item'),
            heading: '某某机构 社会调查中心 · 企业调查项目 — 调查访问员',
            meta: '2025.07 – 2025.08',
            sub: '',
            bullets: [
              '独立触达 **130+** 家企业，面向企业负责人与中高层开展陌生拜访，积累拒访转化与敏感问题追问经验',
              '在企业调查高拒访背景下，参与完成小组 20 余份有效问卷',
              '严格执行标准化访问流程：信息核验、填答引导、追问澄清、逻辑矛盾复核，保障数据真实可追溯'
            ]
          }]
        },
        {
          id: uid('sec'), type: 'entry', title: '田野调研经历', visible: true,
          note: '三次调研累计产出调研报告约 **3 万字**（含团队与个人产出）',
          items: [
            {
              id: uid('item'),
              heading: '恩施州宣恩县 · 农村发展与「贡茶产业」调研',
              meta: '2026.06',
              sub: '',
              bullets: ['走访 **4 个乡镇**，对农户 / 合作社 / 茶企三类主体实施半结构访谈 **5 人次**，聚焦茶旅融合模式']
            },
            {
              id: uid('item'),
              heading: '潜江市 · 江汉油田「油田小镇」专题调研',
              meta: '2026.01',
              sub: '',
              bullets: ['调查资源型企业与周边社区共生关系，分析企业—地方互动机制']
            },
            {
              id: uid('item'),
              heading: '黄冈市 ·「神峰山庄」新型循环农业调研',
              meta: '2024.12',
              sub: '',
              bullets: ['梳理「种植—养殖—加工—销售」循环产业链，评估农户增收带动机制']
            }
          ]
        },
        {
          id: uid('sec'), type: 'entry', title: '项目 · 竞赛 · 在校实践', visible: true, note: '',
          items: [
            {
              id: uid('item'),
              heading: 'AI 智能体大赛 — **队长**',
              meta: '',
              sub: '',
              bullets: ['带队围绕「中华民族共同体」主题搭建 RAG 知识库与 AI Agent，完成语料整理、知识库构建与问答流程设计']
            },
            {
              id: uid('item'),
              heading: '全国大学生电子商务「三创赛」· 二手交易平台项目 — **队长**',
              meta: '2024.12 – 2025.03',
              sub: '',
              bullets: ['带队 **5 人** 完成市场调研、商业模式设计与商业计划书撰写；独立完成路演答辩']
            }
          ]
        },
        {
          id: uid('sec'), type: 'kv', title: '专业技能', visible: true, note: '',
          pairs: [
            { key: '研究方法', value: '问卷设计、半结构化访谈、实地调查、定性编码与主题归纳、文献综述' },
            { key: '数据与分析', value: 'Excel、问卷星、SPSS（数据清洗与基础统计分析）' },
            { key: 'AI 工具', value: 'Agent 工作流、RAG 知识库搭建、文档与流程自动化' },
            { key: '语言 / 办公', value: 'CET-4；Word 长报告、PPT 汇报' }
          ]
        },
        {
          id: uid('sec'), type: 'list', title: '可提供的证明材料', visible: false,
          bullets: ['企业调查项目实习证明（原件随身携带，被问再给）', 'GitHub 开源项目代码与 README'],
          note: ''
        }
      ],
      theme: { name: 'classic-blue', tokens: {} },
      versions: [
        { name: '通吃版', overrides: {} },
        { name: 'AI 方向版', overrides: { 'intent.positions': ['产品运营', 'AI 应用助理', '用户研究'] } }
      ]
    };
  }

  /* ---------- 路径读写 ---------- */
  function getPath(obj, path) {
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function setPath(obj, path, value) {
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      var k = parts[i];
      if (cur[k] === null || cur[k] === undefined || typeof cur[k] !== 'object') {
        cur[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      }
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
    return obj;
  }

  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

  /** 归一化：补全缺失字段，保证渲染器不会拿到 undefined */
  function normalize(input) {
    var base = blank();
    var d = (input && typeof input === 'object') ? input : {};
    var out = deepClone(base);

    out.schemaVersion = SCHEMA_VERSION;
    out.meta = Object.assign({}, base.meta, d.meta || {});
    out.meta.facts = Array.isArray(out.meta.facts) ? out.meta.facts.filter(Boolean) : [];
    out.meta.contacts = Array.isArray(out.meta.contacts) ? out.meta.contacts : base.meta.contacts;
    out.intent = Object.assign({}, base.intent, d.intent || {});
    out.intent.positions = Array.isArray(out.intent.positions) ? out.intent.positions : [];
    out.intent.highlights = Array.isArray(out.intent.highlights) ? out.intent.highlights : [];
    out.summary = typeof d.summary === 'string' ? d.summary : '';
    out.theme = Object.assign({}, base.theme, d.theme || {});
    out.theme.tokens = (d.theme && d.theme.tokens) || {};
    out.versions = Array.isArray(d.versions) && d.versions.length ? d.versions : base.versions;

    var secs = Array.isArray(d.sections) ? d.sections : [];
    out.sections = secs.map(function (s) {
      var t = SECTION_TYPES.indexOf(s.type) >= 0 ? s.type : 'entry';
      var o = {
        id: s.id || uid('sec'),
        type: t,
        title: typeof s.title === 'string' ? s.title : '未命名板块',
        visible: s.visible !== false,
        note: typeof s.note === 'string' ? s.note : ''
      };
      if (t === 'entry') {
        o.items = (Array.isArray(s.items) ? s.items : []).map(function (it) {
          return {
            id: it.id || uid('item'),
            heading: it.heading || '',
            meta: it.meta || '',
            sub: it.sub || '',
            bullets: (Array.isArray(it.bullets) ? it.bullets : []).filter(function (b) { return String(b).trim() !== ''; })
          };
        });
      }
      if (t === 'kv') {
        o.pairs = (Array.isArray(s.pairs) ? s.pairs : []).map(function (p) {
          return { key: p.key || '', value: p.value || '' };
        });
      }
      if (t === 'list') o.bullets = Array.isArray(s.bullets) ? s.bullets : [];
      if (t === 'text') o.body = typeof s.body === 'string' ? s.body : '';
      return o;
    });

    return out;
  }

  /** 应用版本差量，返回新数据对象 */
  function applyOverrides(data, overrides) {
    var out = deepClone(data);
    var ov = overrides || {};
    Object.keys(ov).forEach(function (path) {
      setPath(out, path, deepClone(ov[path]));
    });
    return out;
  }

  RS.schema = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    SECTION_TYPES: SECTION_TYPES,
    TYPE_LABEL: TYPE_LABEL,
    SECTION_PRESETS: SECTION_PRESETS,
    uid: uid,
    blank: blank,
    blankItem: blankItem,
    blankSection: blankSection,
    demo: demo,
    normalize: normalize,
    getPath: getPath,
    setPath: setPath,
    deepClone: deepClone,
    applyOverrides: applyOverrides
  };
})();
