/**
 * 简历工坊 Resume Studio · 设计令牌
 * 唯一的视觉真相源：HTML 渲染与 DOCX 渲染共用此表。
 */
(function () {
  var RS = (typeof window !== 'undefined' ? (window.RS = window.RS || {}) : (globalThis.RS = globalThis.RS || {}));

  var BASE = {
    name: 'classic-blue',
    displayName: '经典蓝 · 通用',
    /* 色彩 */
    accent: '#1F3A5F',
    accentSoft: '#F0F5FA',
    tagSoft: '#F8FAFC',
    textStrong: '#111827',
    textBody: '#1F2937',
    textSub: '#374151',
    textMuted: '#6B7280',
    textMeta: '#4B5563',
    /* 字号（px） */
    fsName: 25,
    fsSub: 12,
    fsContact: 11,
    fsIntent: 11.3,
    fsSection: 12.5,
    fsItem: 11.6,
    fsBody: 11.3,
    fsBullet: 11.1,
    fsNote: 10.8,
    /* 版式 */
    lh: 1.45,
    gapSection: 9,
    pagePadTop: 24,
    pagePadX: 46,
    pagePadBottom: 22,
    pageW: 820,
    pageH: 1160,
    photoW: 102,
    photoH: 136,
    /* 字体 */
    fontFamily: '"Microsoft YaHei","PingFang SC","Hiragino Sans GB","Source Han Sans CN",sans-serif',
    /* 整体字号缩放（主题可调，1 = 原始大小） */
    fontScale: 1,
    /* DOCX 专用 */
    docxFont: 'Microsoft YaHei',
    docxMarginTop: 900,
    docxMarginX: 1080,
    docxMarginBottom: 900,
    /* 证件照在 Word 中的尺寸（EMU）由 photoW/photoH 派生，见 resolve() */
    docxPhotoW: 971550,
    docxPhotoH: 1295400,
    /* DOCX 字号（半磅；Word 与浏览器排版密度不同，故独立成组，不直接由 px 换算） */
    docxFsName: 40,
    docxFsSub: 22,
    docxFsContact: 21,
    docxFsSection: 27,
    docxFsItem: 22,
    docxFsBullet: 22,
    docxFsNote: 20
  };

  var FS_KEYS = ['fsName', 'fsSub', 'fsContact', 'fsIntent', 'fsSection', 'fsItem', 'fsBody', 'fsBullet', 'fsNote'];
  var DOCX_FS_KEYS = ['docxFsName', 'docxFsSub', 'docxFsContact', 'docxFsSection', 'docxFsItem', 'docxFsBullet', 'docxFsNote'];

  /** 合并基础令牌与主题覆盖（过滤空值与未知键） */
  function resolve(theme) {
    var out = {};
    Object.keys(BASE).forEach(function (k) { out[k] = BASE[k]; });
    if (theme && typeof theme === 'object') {
      var t = theme.tokens || theme;
      Object.keys(t || {}).forEach(function (k) {
        var v = t[k];
        if (v === '' || v === null || v === undefined) return;
        if (!(k in BASE)) return;
        out[k] = v;
      });
    }
    if (theme && theme.name) out.name = theme.name;
    /* 整体字号缩放：只影响字号，不影响版式 */
    var sc = Number(out.fontScale);
    if (sc && sc !== 1) {
      FS_KEYS.forEach(function (k) { out[k] = Math.round(Number(out[k]) * sc * 10) / 10; });
      DOCX_FS_KEYS.forEach(function (k) { out[k] = Math.max(12, Math.round(Number(out[k]) * sc)); });
    }
    out.fontScale = 1;
    /* 照片尺寸以 HTML 端 photoW/photoH 为准，换算成 Word 的 EMU，保证两端观感一致 */
    out.docxPhotoW = pxToEmu(out.photoW);
    out.docxPhotoH = pxToEmu(out.photoH);
    return out;
  }

  /** 证件照可选档位（宽 × 高，比例 3:4） */
  var PHOTO_PRESETS = [
    { key: 's', label: '小（86 × 115）', w: 86, h: 115 },
    { key: 'm', label: '中（102 × 136，默认）', w: 102, h: 136 },
    { key: 'l', label: '大（118 × 157）', w: 118, h: 157 }
  ];

  /** 生成 CSS 变量块：主题切换只需替换这段 */
  function toCssVars(t) {
    var map = {
      '--rs-accent': t.accent,
      '--rs-accent-soft': t.accentSoft,
      '--rs-tag-soft': t.tagSoft,
      '--rs-text-strong': t.textStrong,
      '--rs-text-body': t.textBody,
      '--rs-text-sub': t.textSub,
      '--rs-text-muted': t.textMuted,
      '--rs-text-meta': t.textMeta,
      '--rs-fs-name': t.fsName + 'px',
      '--rs-fs-sub': t.fsSub + 'px',
      '--rs-fs-contact': t.fsContact + 'px',
      '--rs-fs-intent': t.fsIntent + 'px',
      '--rs-fs-section': t.fsSection + 'px',
      '--rs-fs-item': t.fsItem + 'px',
      '--rs-fs-body': t.fsBody + 'px',
      '--rs-fs-bullet': t.fsBullet + 'px',
      '--rs-fs-note': t.fsNote + 'px',
      '--rs-lh': String(t.lh),
      '--rs-gap-section': t.gapSection + 'px',
      '--rs-pad-top': t.pagePadTop + 'px',
      '--rs-pad-x': t.pagePadX + 'px',
      '--rs-pad-bottom': t.pagePadBottom + 'px',
      '--rs-page-w': t.pageW + 'px',
      '--rs-page-h': t.pageH + 'px',
      '--rs-photo-w': t.photoW + 'px',
      '--rs-photo-h': t.photoH + 'px',
      '--rs-font': t.fontFamily
    };
    var lines = Object.keys(map).map(function (k) { return k + ':' + map[k] + ';'; });
    return ':root{' + lines.join('') + '}';
  }

  /** px → Word 半磅值（w:sz） */
  function pxToHalfPoint(px) { return Math.round(Number(px) * 1.5); }

  /** px → Word twip（w:ind / w:spacing 等） */
  function pxToTwip(px) { return Math.round(Number(px) * 15); }

  /** px → Word EMU（图片尺寸；1 英寸 = 914400 EMU，CSS 96dpi） */
  function pxToEmu(px) { return Math.round(Number(px) / 96 * 914400); }

  /** #RRGGBB → RRGGBB */
  function toHex(color) { return String(color || '').replace('#', '').toUpperCase(); }

  RS.tokens = {
    BASE: BASE,
    PHOTO_PRESETS: PHOTO_PRESETS,
    resolve: resolve,
    toCssVars: toCssVars,
    pxToHalfPoint: pxToHalfPoint,
    pxToTwip: pxToTwip,
    pxToEmu: pxToEmu,
    toHex: toHex
  };
})();
