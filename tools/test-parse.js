#!/usr/bin/env node
/**
 * 简历工坊 Resume Studio · 解析器测试
 * 用法：
 *   node tools/test-parse.js                      # 用内置样例文本自测
 *   node tools/test-parse.js <文件.docx> [更多…]   # 解析真实 docx
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
['tokens.js', 'schema.js', 'markup.js', 'unzip.js', 'parse-docx.js', 'parse-text.js'].forEach((f) => {
  (0, eval)(fs.readFileSync(path.join(root, 'src', 'core', f), 'utf8'));
});
const RS = globalThis.RS;

const SAMPLE = [
  '张三',
  '2027 届本科应届生 · 某某大学 社会学',
  '电话：13800000000    邮箱：zhangsan@example.com    GitHub：github.com/example',
  '求职意向：市场/用户研究、社会调研与项目执行',
  '',
  '教育背景',
  '某某大学 · 社会学（本科）\t2023.09 – 2027.06',
  '主修：社会研究方法、社会统计学、社会学概论',
  '',
  '实习经历',
  '北京大学中国社会科学调查中心 · ESIEC 企业调查 — 调查访问员\t2025.07 – 2025.08',
  '• 独立触达 130+ 家企业，面向企业负责人与中高层开展陌生拜访',
  '• 在企业调查高拒访背景下，参与完成小组 20 余份有效问卷',
  '• 严格执行标准化访问流程，保障数据真实、完整、可追溯',
  '',
  '田野调研经历',
  '恩施宣恩「贡茶产业」调研（2026.06）',
  '· 走访 4 个乡镇，对农户/合作社/茶企实施半结构访谈 5 人次',
  '潜江江汉油田「油田小镇」调研（2026.01）',
  '· 调查资源型企业与周边社区共生关系',
  '',
  '专业技能',
  '研究方法：问卷设计、半结构化访谈、定性编码',
  '数据与分析：Excel、问卷星、SPSS（基础统计分析）',
  '语言：CET-4；普通话二级甲等',
  '',
  '荣誉奖项',
  '校级一等奖学金（2024）',
  '优秀学生干部（2025）',
  '',
  '自我评价',
  '做事踏实，能快速上手新任务，愿意从基础做起。'
].join('\n');

function summarize(res, label) {
  const d = res.data;
  const r = res.report;
  console.log('\n=========== ' + label + ' ===========');
  console.log('读入行数: ' + r.lineCount);
  console.log('姓名: ' + (d.meta.name || '（未识别）'));
  console.log('一句话: ' + (d.meta.headline || '（未识别）'));
  console.log('标签  : ' + (d.meta.facts.join(' / ') || '（无）'));
  console.log('联系方式: ' + (r.contacts.map((c) => c.label + '=' + c.value).join('  ') || '（未识别）'));
  console.log('求职意向: ' + (d.intent.positions.join('、') || '（未识别）'));
  console.log('板块:');
  d.sections.forEach((s, i) => {
    let n = 0, extra = '';
    if (s.type === 'entry') {
      n = s.items.length;
      extra = s.items.slice(0, 2).map((it) =>
        '\n        · [' + (it.meta || '无时间') + '] ' + (it.heading || '（无标题）') +
        (it.bullets.length ? ' → ' + it.bullets.length + ' 要点' : '')).join('');
    } else if (s.type === 'kv') {
      n = s.pairs.length;
      extra = '\n        · ' + s.pairs.slice(0, 2).map((p) => (p.key || '') + '：' + p.value.slice(0, 28)).join('\n        · ');
    } else if (s.type === 'list') {
      n = s.bullets.length;
      extra = '\n        · ' + s.bullets.slice(0, 2).join('\n        · ');
    } else {
      n = (s.body || '').replace(/\s/g, '').length;
      extra = '\n        · ' + (s.body || '').slice(0, 40) + (s.body && s.body.length > 40 ? '…' : '');
    }
    console.log('  ' + (i + 1) + '. ' + s.title + ' [' + s.type + '] — ' + n + (s.type === 'text' ? ' 字' : ' 项') + extra);
  });
  if (r.warnings.length) console.log('提示: ' + r.warnings.join('；'));
}

(async () => {
  const targets = process.argv.slice(2).filter((a) => !a.startsWith('-'));

  summarize(RS.parseText.resume(SAMPLE), '内置样例文本（模拟从 PDF 复制的简历）');

  for (const t of targets) {
    if (!fs.existsSync(t)) {
      console.log('\n[跳过] 文件不存在: ' + t);
      continue;
    }
    try {
      const buf = fs.readFileSync(t);
      const { lines } = await RS.parseDocx.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
      console.log('\n--- docx 原始提取（前 24 行）---');
      lines.filter((l) => l.trim()).slice(0, 24).forEach((l, i) => console.log('  ' + String(i + 1).padStart(2) + '| ' + l));
      summarize(RS.parseText.resume(lines), path.basename(t));
    } catch (e) {
      console.log('\n[失败] ' + path.basename(t) + ': ' + e.message);
    }
  }
})();
