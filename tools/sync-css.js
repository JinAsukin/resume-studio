#!/usr/bin/env node
/**
 * 把 src/styles/document.css 同步为 JS 常量（src/styles/document.css.js）。
 * 原因：导出「干净 HTML」需要拿到 CSS 文本，而 file:// 下无法 fetch 本地文件。
 * 因此 CSS 的唯一真相仍是 document.css，本脚本负责编译；改动 CSS 后请重跑。
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcFile = path.join(root, 'src', 'styles', 'document.css');
const outFile = path.join(root, 'src', 'styles', 'document.css.js');

const css = fs.readFileSync(srcFile, 'utf8');

const header = [
  '/**',
  ' * 本文件由 tools/sync-css.js 自动生成，请勿直接编辑。',
  ' * 源文件：src/styles/document.css',
  ' */'
].join('\n');

const body = [
  header,
  '(function () {',
  "  var RS = (typeof window !== 'undefined' ? (window.RS = window.RS || {}) : (globalThis.RS = globalThis.RS || {}));",
  '  RS.documentCss = ' + JSON.stringify(css) + ';',
  '})();',
  ''
].join('\n');

fs.writeFileSync(outFile, body, 'utf8');
console.log('已同步: src/styles/document.css -> src/styles/document.css.js (' + css.length + ' 字符)');
