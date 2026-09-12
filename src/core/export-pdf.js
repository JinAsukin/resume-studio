/**
 * 简历工坊 Resume Studio · PDF 导出（浏览器打印通道）
 * 说明：本机无头浏览器渲染不可用（详见可行性评估 R1），因此 PDF 交由用户浏览器打印，
 *       所见即所得。界面外壳的隐藏由 app.css 的 @media print 规则完成。
 */
(function () {
  var RS = (typeof window !== 'undefined' ? (window.RS = window.RS || {}) : (globalThis.RS = globalThis.RS || {}));

  var restoring = false;
  var prevTitle = null;

  function restoreTitle() {
    if (restoring && prevTitle !== null) {
      document.title = prevTitle;
      prevTitle = null;
      restoring = false;
    }
  }

  /** 触发打印；Chrome/Edge 会以 document.title 作为默认 PDF 文件名 */
  function print(data) {
    var name = (data && data.meta && data.meta.name ? data.meta.name + '-简历' : '简历');
    if (!restoring) {
      prevTitle = document.title;
      restoring = true;
    }
    document.title = name;

    var onAfter = function () {
      window.removeEventListener('afterprint', onAfter);
      restoreTitle();
    };
    window.addEventListener('afterprint', onAfter);
    setTimeout(restoreTitle, 90000);

    setTimeout(function () { window.print(); }, 80);
  }

  RS.exportPdf = { print: print };
})();
