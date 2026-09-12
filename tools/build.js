#!/usr/bin/env node
/**
 * 简历工坊 Resume Studio · 单文件构建
 * 把 src/ 下的 HTML / CSS / JS 内联打包成 dist/resume-studio.html（双击即用，零依赖）。
 * 用法：node tools/build.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'src');
const distDir = path.join(root, 'dist');
const outFile = path.join(distDir, 'resume-studio.html');

/* 先同步 document.css → document.css.js，保证导出功能拿到最新样式 */
require('./sync-css.js');

let html = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf8');
const inlinedStyles = [];
const inlinedScripts = [];

html = html.replace(/<link[^>]*href="([^"]+\.css)"[^>]*>/g, (m, href) => {
  const css = fs.readFileSync(path.join(srcDir, href), 'utf8');
  inlinedStyles.push(href);
  return '<style>\n' + css + '\n</style>';
});

html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const js = fs.readFileSync(path.join(srcDir, src), 'utf8');
  inlinedScripts.push(src);
  /* 关键：转义脚本内的 </script>，否则会提前闭合标签 */
  return '<script>\n' + js.replace(/<\/script>/gi, '<\\/script>') + '\n</script>';
});

const banner = [
  '<!--',
  '  简历工坊 Resume Studio · 单文件构建产物',
  '  生成时间：' + new Date().toISOString(),
  '  由 tools/build.js 从 src/ 内联打包，请勿直接编辑本文件。',
  '  数据只保存在你自己的浏览器里，本文件不含任何网络请求。',
  '-->'
].join('\n');

html = html.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n' + banner);

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(outFile, html, 'utf8');

/* ---------- 构建后校验 ---------- */
const problems = [];
if (/<script\s+src=/i.test(html)) problems.push('残留外链 script');
if (/<link[^>]*stylesheet/i.test(html)) problems.push('残留外链 stylesheet');
/* 只检查真正的相对路径资源引用（JS 里的模板字符串片段不算） */
const relRef = html.match(/["'](?:\.\/)?(?:styles|core|ui|themes)\/[A-Za-z0-9._-]+["']/);
if (relRef) problems.push('残留相对路径引用: ' + relRef[0]);
const scriptCount = (html.match(/<script>/g) || []).length;
if (scriptCount !== inlinedScripts.length) {
  problems.push('script 标签数不匹配：' + scriptCount + ' vs ' + inlinedScripts.length);
}

const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log('\n构建产物: dist/resume-studio.html');
console.log('内联样式: ' + inlinedStyles.join(', '));
console.log('内联脚本: ' + inlinedScripts.length + ' 个');
console.log('体积: ' + kb + ' KB');
if (problems.length) {
  console.error('\n[FAIL] 构建校验未通过：\n - ' + problems.join('\n - '));
  process.exit(1);
}
console.log('构建校验: 通过（无外链、无外部请求）');
