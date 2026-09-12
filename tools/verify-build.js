#!/usr/bin/env node
/**
 * 简历工坊 Resume Studio · 构建产物校验
 * 校验 dist/resume-studio.html 的结构完整性、离线自足性与模块齐全度。
 * 用法：node tools/verify-build.js
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'dist', 'resume-studio.html');
if (!fs.existsSync(file)) {
  console.error('[FAIL] 未找到 dist/resume-studio.html，请先运行 node tools/build.js');
  process.exit(1);
}
const html = fs.readFileSync(file, 'utf8');
const checks = [];
const check = (name, cond, extra) => checks.push({ name, ok: !!cond, extra: extra || '' });

const openTags = (html.match(/<script>/g) || []).length;
const closeTags = (html.match(/<\/script>/g) || []).length;

check('script 标签配平', openTags === closeTags, openTags + ' 开 / ' + closeTags + ' 闭');
check('存在内联样式块', (html.match(/<style>/g) || []).length >= 1);
check('无外链 script', !/<script\s+src=/i.test(html));
check('无外链样式表', !/<link[^>]*stylesheet/i.test(html));
check('无网络请求代码', !/\bfetch\s*\(|XMLHttpRequest|\.ajax\s*\(/.test(html));
check('无 CDN 引用', !/https?:\/\/(cdn|unpkg|jsdelivr|esm\.sh)/i.test(html));

const modules = ['tokens', 'schema', 'markup', 'renderHtml', 'store', 'lint', 'zip', 'unzip', 'renderDocx', 'parseDocx', 'parseText', 'io', 'exportPdf', 'sections', 'form', 'preview', 'toolbar', 'importer'];
modules.forEach((m) => {
  check('模块已内联: RS.' + m, new RegExp('RS\\.' + m + '\\s*=').test(html));
});

check('内置示例人物为虚构', html.includes('林知远'));
check('模板中的 </script> 已转义', (html.match(/<\\\/script>/g) || []).length >= 1);

/* 隐私红线：产物中不得出现真实联系方式 */
const privatePatterns = [
  { name: '手机号', re: /1[3-9]\d{9}/ },
  { name: 'QQ 邮箱', re: /[1-9]\d{5,10}@qq\.com/ }
];
privatePatterns.forEach((p) => {
  const m = html.match(p.re);
  check('产物不含真实' + p.name, !m, m ? '命中 ' + m[0] : '');
});

const failed = checks.filter((c) => !c.ok);
checks.forEach((c) => console.log((c.ok ? '  [ok] ' : '  [FAIL] ') + c.name + (c.extra ? ' — ' + c.extra : '')));
console.log('\n体积: ' + (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1) + ' KB');
console.log(failed.length ? '\n结果: ' + failed.length + ' 项未通过' : '\n结果: 全部通过 (' + checks.length + ' 项)');
process.exit(failed.length ? 1 : 0);
