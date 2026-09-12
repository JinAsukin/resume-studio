/**
 * 简历工坊 Resume Studio · 自检脚本
 * 用途：在无浏览器环境下验证内核（schema / markup / render-html / lint / docx），
 *       并产出开发预览（dist/_preview.html）与测试文档（dist/_test.docx）。
 * 运行：node tools/selfcheck.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');
const coreDir = path.join(root, 'src', 'core');

['tokens.js', 'schema.js', 'markup.js', 'render-html.js', 'lint.js', 'zip.js', 'unzip.js', 'render-docx.js', 'parse-docx.js', 'parse-text.js'].forEach((f) => {
  const code = fs.readFileSync(path.join(coreDir, f), 'utf8');
  (0, eval)(code);
});

const RS = globalThis.RS;
const checks = [];
function check(name, cond, extra) {
  checks.push({ name, ok: !!cond, extra: extra || '' });
}

/* ---------- HTML ---------- */
const data = RS.schema.normalize(RS.schema.demo());
const docHtml = RS.renderHtml.render(data);
const tokens = RS.tokens.resolve(data.theme);
const cssVars = RS.tokens.toCssVars(tokens);
const docCss = fs.readFileSync(path.join(root, 'src', 'styles', 'document.css'), 'utf8');

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', '_preview.html'), [
  '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">',
  '<title>简历工坊 · 内核预览</title><style>',
  'html,body{margin:0;padding:0;background:#e9e9e7;}',
  'body{padding:24px 0;display:flex;justify-content:center;}',
  cssVars, docCss,
  '</style></head><body>', docHtml, '</body></html>'
].join('\n'), 'utf8');

check('渲染出文档容器', docHtml.includes('class="doc-page"'));
check('渲染出姓名', docHtml.includes('林知远'));
check('渲染出求职意向', docHtml.includes('求职意向'));
check('渲染出标签行', docHtml.includes('doc-tags'));
check('强调标记转为 <b>', docHtml.includes('<b>130+</b>'));
check('渲染出条目型板块', docHtml.includes('云岭大学'));
check('渲染出键值型板块', docHtml.includes('doc-kv-k'));
check('板块导语（note）被渲染', docHtml.includes('doc-note'));
check('隐藏板块不输出', !docHtml.includes('可提供的证明材料'));
check('section 标签配对', (docHtml.match(/<section/g) || []).length === (docHtml.match(/<\/section>/g) || []).length);
check('article 标签配对', (docHtml.match(/<article/g) || []).length === (docHtml.match(/<\/article>/g) || []).length);
check('令牌换算 px→半磅', RS.tokens.pxToHalfPoint(11.3) === 17);
check('令牌换算 px→twip', RS.tokens.pxToTwip(17) === 255);
check('内联标记纯文本化', RS.markup.toPlain('触达 **130+** 家') === '触达 130+ 家');
check('XSS 转义生效', RS.markup.toHtml('<img src=x onerror=1>').includes('&lt;img'));

/* ---------- 检查规则 ---------- */
const issues = RS.lint.run(data, { pages: 1, ratio: 0.9, heaviest: null });
check('检查规则可运行', Array.isArray(issues));
check('未触发必填缺失（示例数据完整）', !issues.some((i) => i.code === 'C2'));
const badData = RS.schema.blank();
const badIssues = RS.lint.run(badData, { pages: 2, ratio: 1.4, heaviest: { title: '实习经历' } });
check('空白数据触发 C1 页数预警', badIssues.some((i) => i.code === 'C1'));
check('空白数据触发 C2 必填缺失', badIssues.some((i) => i.code === 'C2'));
check('量化未强调可被识别', RS.lint.unemphasizedQuant('触达 130+ 家企业') === '130+');
check('已强调的量化不再报警', RS.lint.unemphasizedQuant('触达 **130+** 家企业') === null);

/* ---------- DOCX ---------- */
const files = RS.renderDocx.buildFiles(data);
check('DOCX 包含 document.xml', files.some((f) => f.name === 'word/document.xml'));
check('DOCX 包含 Content_Types', files.some((f) => f.name === '[Content_Types].xml'));
check('DOCX 段落数为正', (RS.renderDocx.documentXml(data, tokens).match(/<w:p>/g) || []).length > 10);

/* ---------- 解析：文本 → 结构化 ---------- */
const sampleText = [
  '张三',
  '2027 届本科应届生 · 某某大学 社会学',
  '电话：13800000000    邮箱：zhangsan@example.com',
  '求职意向：市场/用户研究、社会调研与项目执行',
  '',
  '教育背景',
  '某某大学 · 社会学（本科）\t2023.09 – 2027.06',
  '主修：社会研究方法、社会统计学',
  '',
  '实习经历',
  '某某机构 调查中心 — 研究助理\t2025.07 – 2025.08',
  '• 独立完成 30 份深度访谈并整理录音稿',
  '• 参与撰写调研报告约 2 万字',
  '',
  '专业技能',
  '研究方法：问卷设计、半结构化访谈',
  '数据与分析：Excel、SPSS'
].join('\n');
const parsed = RS.parseText.resume(sampleText);
check('解析出姓名', parsed.data.meta.name === '张三', parsed.data.meta.name);
check('解析出电话', parsed.report.contacts.some((c) => c.value === '13800000000'));
check('解析出邮箱', parsed.report.contacts.some((c) => c.label === '邮箱'));
check('解析出求职意向', parsed.data.intent.positions.length >= 1, parsed.data.intent.positions.join('/'));
check('解析出多个板块', parsed.data.sections.length >= 3, '共 ' + parsed.data.sections.length + ' 个');
check('解析出条目与时间', parsed.data.sections.some((s) =>
  s.type === 'entry' && s.items.some((it) => it.meta && /2023/.test(it.meta))));
check('解析出要点', parsed.data.sections.some((s) =>
  s.type === 'entry' && s.items.some((it) => it.bullets.length >= 2)));
check('解析出键值型板块', parsed.data.sections.some((s) => s.type === 'kv' && s.pairs.length >= 2));
check('解析结果可被渲染器消化', RS.renderHtml.render(parsed.data).includes('doc-page'));

RS.renderDocx.build(data).then((bytes) => {
  fs.writeFileSync(path.join(root, 'dist', '_test.docx'), Buffer.from(bytes));
  const head = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  check('DOCX 以 ZIP 魔数开头', head === 'PK\u0003\u0004');
  check('DOCX 体积合理（2KB–2MB）', bytes.length > 2 * 1024 && bytes.length < 2 * 1024 * 1024,
    '实际 ' + (bytes.length / 1024).toFixed(1) + ' KB');

  /* ---------- 含证件照的用例 ---------- */
  const withPhoto = RS.schema.normalize(RS.schema.demo());
  withPhoto.meta.photo = 'data:image/png;base64,' + makeTinyPng().toString('base64');
  return RS.renderDocx.build(withPhoto).then((b2) => {
    fs.writeFileSync(path.join(root, 'dist', '_test-photo.docx'), Buffer.from(b2));
    const files2 = RS.renderDocx.buildFiles(withPhoto);
    check('含照片时写入 media/photo.png', files2.some((f) => f.name === 'word/media/photo.png'));
    check('含照片时 Content_Types 声明 png',
      files2.find((f) => f.name === '[Content_Types].xml').data.includes('image/png'));
    check('含照片时 rels 含图片关系',
      files2.find((f) => f.name === 'word/_rels/document.xml.rels').data.includes('media/photo.png'));
    check('含照片 DOCX 体积更大', b2.length > bytes.length,
      (bytes.length / 1024).toFixed(1) + ' KB → ' + (b2.length / 1024).toFixed(1) + ' KB');

    /* ---------- docx 往返：自己生成的文档，应该能被自己的解析器读回来 ---------- */
    return RS.parseDocx.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
      .then((rt) => ({ rt, bytes }));
  }).then((ctx) => {
    const rtParsed = RS.parseText.resume(ctx.rt.lines);
    check('DOCX 往返：读得回姓名', rtParsed.data.meta.name === '林知远', rtParsed.data.meta.name);
    check('DOCX 往返：读得回板块', rtParsed.data.sections.filter((s) => s.visible).length >= 3,
      '共 ' + rtParsed.data.sections.length + ' 个');
    check('DOCX 往返：读得回要点', rtParsed.data.sections.some((s) =>
      s.type === 'entry' && s.items.some((it) => it.bullets.length > 0)));

    const failed = checks.filter((c) => !c.ok);
    checks.forEach((c) => console.log((c.ok ? '  [ok] ' : '  [FAIL] ') + c.name + (c.extra ? ' — ' + c.extra : '')));
    console.log('\n文档 HTML 长度: ' + docHtml.length + ' 字符');
    console.log('可见板块数: ' + data.sections.filter((s) => s.visible).length + ' / 总板块 ' + data.sections.length);
    console.log('检查规则命中: ' + issues.length + ' 条（示例数据）');
    console.log('产物: dist/_preview.html · dist/_test.docx · dist/_test-photo.docx');
    console.log(failed.length ? '\n结果: ' + failed.length + ' 项未通过' : '\n结果: 全部通过 (' + checks.length + ' 项)');
    process.exit(failed.length ? 1 : 0);
  });
}).catch((e) => {
  console.error('[FAIL] DOCX 生成异常:', e);
  process.exit(1);
});

/** 生成 1×1 白色 PNG，用于验证含图分支（不引入任何真实图片） */
function makeTinyPng() {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const idat = zlib.deflateSync(Buffer.from([0, 200, 220, 255]));
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(RS.zip.crc32(Buffer.concat([typeBuf, data])) >>> 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
