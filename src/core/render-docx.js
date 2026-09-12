/**
 * 简历工坊 Resume Studio · DOCX 渲染器（自研 OOXML）
 * 移植自既有验证过的直写 OOXML 方案：不依赖 python-docx / docx.js，结构完全可控。
 * 字号、颜色、页边距全部来自设计令牌，与 HTML 渲染器共用一份真相。
 */
(function () {
  var RS = (typeof window !== 'undefined' ? (window.RS = window.RS || {}) : (globalThis.RS = globalThis.RS || {}));

  var W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  var PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
  var DOC = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  var CP = 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties';
  var DC = 'http://purl.org/dc/elements/1.1/';
  var EP = 'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties';
  var VT = 'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes';
  var A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  var PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
  var WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
  var R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

  var PAGE_W = 11906;
  var PAGE_H = 16838;
  var CONTENT_W = 9746;   /* 11906 - 1080 × 2 */

  /* ---------- 基础工具 ---------- */
  function escX(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function run(text, o, font) {
    o = o || {};
    var F = font || 'Microsoft YaHei';
    var rpr = '<w:rFonts w:ascii="' + F + '" w:hAnsi="' + F + '" w:eastAsia="' + F + '" w:cs="' + F + '"/>';
    if (o.bold) rpr += '<w:b/>';
    if (o.italic) rpr += '<w:i/>';
    if (o.color) rpr += '<w:color w:val="' + o.color + '"/>';
    if (o.size) rpr += '<w:sz w:val="' + o.size + '"/><w:szCs w:val="' + o.size + '"/>';
    var parts = escX(text).split('\n');
    var inner = parts.map(function (p, i) {
      return (i ? '<w:br/>' : '') + '<w:t xml:space="preserve">' + p + '</w:t>';
    }).join('');
    return '<w:r><w:rPr>' + rpr + '</w:rPr>' + inner + '</w:r>';
  }

  /** 按内联标记生成多个 run（**重点** → 加粗） */
  function runsFromMarkup(text, o, font) {
    return RS.markup.toRuns(text).map(function (r) {
      var oo = {};
      Object.keys(o || {}).forEach(function (k) { oo[k] = o[k]; });
      if (r.bold) oo.bold = true;
      return run(r.text, oo, font);
    }).join('');
  }

  function para(runsHtml, o) {
    o = o || {};
    var ppr = '';
    if (o.tabs) ppr += '<w:tabs><w:tab w:val="right" w:pos="' + CONTENT_W + '"/></w:tabs>';
    if (o.border) ppr += '<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="2" w:color="' + o.border + '"/></w:pBdr>';
    if (o.shade) ppr += '<w:shd w:val="clear" w:color="auto" w:fill="' + o.shade + '"/>';
    if (o.indentLeft) ppr += '<w:ind w:left="' + o.indentLeft + '" w:hanging="' + (o.hanging || 0) + '"/>';
    var sp = '';
    if (o.before !== undefined) sp += ' w:before="' + o.before + '"';
    if (o.after !== undefined) sp += ' w:after="' + o.after + '"';
    sp += ' w:line="276" w:lineRule="auto"';
    ppr += '<w:spacing' + sp + '/>';
    if (o.align) ppr += '<w:jc w:val="' + o.align + '"/>';
    return '<w:p><w:pPr>' + ppr + '</w:pPr>' + runsHtml + '</w:p>';
  }

  function bulletPara(runsHtml, after) {
    var ppr = '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' +
      '<w:spacing w:after="' + (after === undefined ? 40 : after) + '" w:line="276" w:lineRule="auto"/>' +
      '<w:ind w:left="360" w:hanging="220"/>';
    return '<w:p><w:pPr>' + ppr + '</w:pPr>' + runsHtml + '</w:p>';
  }

  function h2(text, t) {
    return para(run(text, { bold: true, size: t.docxFsSection, color: RS.tokens.toHex(t.accent) }, t.docxFont),
      { before: 150, after: 60, border: RS.tokens.toHex(t.accent) });
  }

  /* ---------- 证件照 ---------- */
  function photoRun(t, rId) {
    return '<w:r><w:drawing>' +
      '<wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="' + WP + '" xmlns:r="' + R + '" xmlns:a="' + A + '" xmlns:pic="' + PIC + '">' +
      '<wp:extent cx="' + t.docxPhotoW + '" cy="' + t.docxPhotoH + '"/>' +
      '<wp:effectExtent l="0" t="0" r="0" b="0"/>' +
      '<wp:docPr id="100" name="photo"/>' +
      '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
      '<a:graphic xmlns:a="' + A + '"><a:graphicData uri="' + PIC + '">' +
      '<pic:pic xmlns:pic="' + PIC + '">' +
      '<pic:nvPicPr><pic:cNvPr id="0" name="photo.jpg"/><pic:cNvPicPr/></pic:nvPicPr>' +
      '<pic:blipFill><a:blip r:embed="' + rId + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
      '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + t.docxPhotoW + '" cy="' + t.docxPhotoH + '"/></a:xfrm>' +
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
      '</pic:pic></a:graphicData></a:graphic>' +
      '</wp:inline></w:drawing></w:r>';
  }

  function headerBlock(data, t, hasPhoto) {
    var m = data.meta || {};
    var bits = [];
    if (String(m.headline || '').trim()) bits.push(RS.markup.toPlain(m.headline));
    if ((m.facts || []).length) bits.push(m.facts.join(' · '));

    var who = [];
    if (String(m.name || '').trim()) {
      who.push(para(runsFromMarkup(m.name, { size: t.docxFsName, bold: true, color: RS.tokens.toHex(t.accent) }, t.docxFont), { after: 20 }));
    }
    if (bits.length) {
      who.push(para(run(bits.join(' ｜ '), { size: t.docxFsSub, color: '374151' }, t.docxFont), { after: 20 }));
    }
    var contacts = (m.contacts || []).filter(function (c) { return String(c.value || '').trim(); });
    if (contacts.length) {
      var ct = contacts.map(function (c) {
        return RS.markup.toPlain((String(c.label || '').trim() ? String(c.label).trim() + '：' : '') + String(c.value).trim());
      }).join('    ');
      who.push(para(run(ct, { size: t.docxFsContact, color: '374151' }, t.docxFont), { after: 0 }));
    }

    if (!hasPhoto) {
      return who.join('') + para('', { after: 0, border: RS.tokens.toHex(t.accent) });
    }

    /* 左列宽度随照片尺寸走，避免大图溢出单元格 */
    var leftW = Math.round(t.photoW / 96 * 1440) + 30;
    var rightW = CONTENT_W - leftW;
    return '<w:tbl><w:tblPr>' +
      '<w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="fixed"/>' +
      '<w:tblBorders>' +
      '<w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>' +
      '<w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>' +
      '<w:bottom w:val="single" w:sz="8" w:space="2" w:color="' + RS.tokens.toHex(t.accent) + '"/>' +
      '<w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>' +
      '</w:tblBorders>' +
      '<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tblCellMar>' +
      '</w:tblPr>' +
      '<w:tblGrid><w:gridCol w:w="' + leftW + '"/><w:gridCol w:w="' + rightW + '"/></w:tblGrid>' +
      '<w:tr>' +
      '<w:tc><w:tcPr><w:tcW w:w="' + leftW + '" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>' + photoRun(t, 'rId3') + '</w:p>' +
      '</w:tc>' +
      '<w:tc><w:tcPr><w:tcW w:w="' + rightW + '" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>' +
      who.join('') +
      '</w:tc></w:tr></w:tbl>';
  }

  /* ---------- 主体 ---------- */
  function intentBlock(data, t) {
    var out = [];
    var it = data.intent || {};
    var positions = (it.positions || []).filter(Boolean);
    if (positions.length) {
      out.push(para(
        run('求职意向：', { bold: true, size: t.docxFsBullet, color: RS.tokens.toHex(t.accent) }, t.docxFont) +
        run(positions.join('、'), { size: t.docxFsBullet, color: RS.tokens.toHex(t.accent) }, t.docxFont),
        { after: 60, shade: RS.tokens.toHex(t.accentSoft) }));
    }
    var tags = (it.highlights || []).filter(Boolean);
    if (tags.length) {
      out.push(para(runsFromMarkup(tags.join(' ｜ '), { size: t.docxFsContact, color: '374151' }, t.docxFont),
        { after: 110, shade: RS.tokens.toHex(t.tagSoft) }));
    }
    return out.join('');
  }

  function summaryBlock(data, t) {
    var s = String(data.summary || '').trim();
    if (!s) return '';
    return para(runsFromMarkup(s, { size: t.docxFsBullet, color: '374151' }, t.docxFont), { after: 80 });
  }

  function sectionBlock(sec, t) {
    if (sec.visible === false) return '';
    var title = String(sec.title || '').trim();
    var body = [];
    var hasBody = false;

    if (sec.type === 'entry') {
      (sec.items || []).forEach(function (it) {
        var head = String(it.heading || '').trim();
        var metaT = String(it.meta || '').trim();
        var sub = String(it.sub || '').trim();
        var bullets = (it.bullets || []).filter(function (b) { return String(b).trim(); });
        if (!head && !sub && !bullets.length) return;
        hasBody = true;

        if (head || metaT) {
          var runs = runsFromMarkup(head, { size: t.docxFsItem, bold: true, color: '111827' }, t.docxFont);
          if (metaT) {
            runs += run('\t', { size: t.docxFsNote }, t.docxFont);
            runs += run(metaT, { size: t.docxFsNote, color: '4B5563' }, t.docxFont);
          }
          body.push(para(runs, { after: 20, tabs: true }));
        }
        if (sub) body.push(para(runsFromMarkup(sub, { size: t.docxFsNote, color: '6B7280' }, t.docxFont), { after: 20 }));
        bullets.forEach(function (b) {
          body.push(bulletPara(runsFromMarkup(b, { size: t.docxFsBullet }, t.docxFont)));
        });
      });
    } else if (sec.type === 'kv') {
      (sec.pairs || []).forEach(function (p) {
        var key = String(p.key || '').trim();
        var val = String(p.value || '').trim();
        if (!key && !val) return;
        hasBody = true;
        var runs = key ? run(key + '：', { bold: true, size: t.docxFsBullet, color: RS.tokens.toHex(t.accent) }, t.docxFont) : '';
        runs += runsFromMarkup(val, { size: t.docxFsBullet }, t.docxFont);
        body.push(bulletPara(runs, 30));
      });
    } else if (sec.type === 'list') {
      (sec.bullets || []).filter(function (b) { return String(b).trim(); }).forEach(function (b) {
        hasBody = true;
        body.push(bulletPara(runsFromMarkup(b, { size: t.docxFsBullet }, t.docxFont)));
      });
    } else if (sec.type === 'text') {
      var txt = String(sec.body || '').trim();
      if (txt) {
        hasBody = true;
        body.push(para(runsFromMarkup(txt, { size: t.docxFsBullet }, t.docxFont), { after: 60 }));
      }
    }

    if (!hasBody) return '';
    var out = title ? h2(title, t) : '';
    var note = String(sec.note || '').trim();
    if (note) {
      out += para(runsFromMarkup(note, { size: t.docxFsNote, italic: true, color: '6B7280' }, t.docxFont), { after: 40 });
    }
    return out + body.join('');
  }

  function documentXml(data, t) {
    var m = data.meta || {};
    var hasPhoto = isDataImage(m.photo);
    var body = [];
    body.push(headerBlock(data, t, hasPhoto));
    body.push(intentBlock(data, t));
    body.push(summaryBlock(data, t));
    (data.sections || []).forEach(function (sec) { body.push(sectionBlock(sec, t)); });

    var sectPr = '<w:sectPr><w:pgSz w:w="' + PAGE_W + '" w:h="' + PAGE_H + '"/>' +
      '<w:pgMar w:top="' + t.docxMarginTop + '" w:right="' + t.docxMarginX + '" w:bottom="' + t.docxMarginBottom +
      '" w:left="' + t.docxMarginX + '" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>';

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="' + W + '"><w:body>' + body.join('') + sectPr + '</w:body></w:document>';
  }

  function isDataImage(src) {
    return /^data:image\//.test(String(src || ''));
  }

  function parseDataImage(src) {
    var m = /^data:(image\/[a-zA-Z+]+);base64,(.*)$/.exec(String(src || ''));
    if (!m) return null;
    var mime = m[1];
    var ext = mime === 'image/png' ? 'png' : (mime === 'image/gif' ? 'gif' : 'jpg');
    var bin = (typeof atob === 'function' ? atob(m[2]) : Buffer.from(m[2], 'base64').toString('binary'));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes: bytes, mime: mime, ext: ext };
  }

  /* ---------- 包结构 ---------- */
  function stylesXml(t) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="' + W + '">' +
      '<w:docDefaults><w:rPrDefault><w:rPr>' +
      '<w:rFonts w:ascii="' + t.docxFont + '" w:hAnsi="' + t.docxFont + '" w:eastAsia="' + t.docxFont + '" w:cs="' + t.docxFont + '"/>' +
      '<w:sz w:val="' + t.docxFsBullet + '"/><w:szCs w:val="' + t.docxFsBullet + '"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault>' +
      '</w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
      '</w:styles>';
  }

  function numberingXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:numbering xmlns:w="' + W + '">' +
      '<w:abstractNum w:abstractNumId="0">' +
      '<w:multiLevelType w:val="hybridMultilevel"/>' +
      '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="\u2022"/>' +
      '<w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="220"/></w:pPr>' +
      '<w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr></w:lvl>' +
      '</w:abstractNum>' +
      '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
      '</w:numbering>';
  }

  function contentTypesXml(imgExt) {
    var img = imgExt
      ? '<Override PartName="/word/media/photo.' + imgExt + '" ContentType="image/' +
        (imgExt === 'png' ? 'png' : (imgExt === 'gif' ? 'gif' : 'jpeg')) + '"/>'
      : '';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="' + PKG + '">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      img +
      '</Types>';
  }

  function rootRelsXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="' + PKG + '">' +
      '<Relationship Id="rId1" Type="' + DOC + '/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="' + PKG + '/metadata/core-properties" Target="docProps/core.xml"/>' +
      '<Relationship Id="rId3" Type="' + DOC + '/extended-properties" Target="docProps/app.xml"/>' +
      '</Relationships>';
  }

  function docRelsXml(hasPhoto, imgExt) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="' + PKG + '">' +
      '<Relationship Id="rId1" Type="' + DOC + '/styles" Target="styles.xml"/>' +
      '<Relationship Id="rId2" Type="' + DOC + '/numbering" Target="numbering.xml"/>' +
      (hasPhoto ? '<Relationship Id="rId3" Type="' + DOC + '/image" Target="media/photo.' + imgExt + '"/>' : '') +
      '</Relationships>';
  }

  function coreXml(data) {
    var name = String((data.meta && data.meta.name) || '').trim() || '简历';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="' + CP + '" xmlns:dc="' + DC + '" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>' + escX(name + ' 简历') + '</dc:title>' +
      '<dc:creator>' + escX(name) + '</dc:creator>' +
      '</cp:coreProperties>';
  }

  function appXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Properties xmlns="' + EP + '" xmlns:vt="' + VT + '"><Application>简历工坊 Resume Studio</Application></Properties>';
  }

  /* ---------- 打包 ---------- */
  function buildFiles(data) {
    var t = RS.tokens.resolve(data.theme || {});
    var img = isDataImage(data.meta && data.meta.photo) ? parseDataImage(data.meta.photo) : null;
    var files = [
      { name: '[Content_Types].xml', data: contentTypesXml(img ? img.ext : null) },
      { name: '_rels/.rels', data: rootRelsXml() },
      { name: 'word/document.xml', data: documentXml(data, t) },
      { name: 'word/styles.xml', data: stylesXml(t) },
      { name: 'word/numbering.xml', data: numberingXml() },
      { name: 'word/_rels/document.xml.rels', data: docRelsXml(!!img, img ? img.ext : 'jpg') },
      { name: 'docProps/core.xml', data: coreXml(data) },
      { name: 'docProps/app.xml', data: appXml() }
    ];
    if (img) files.push({ name: 'word/media/photo.' + img.ext, data: img.bytes, store: true });
    return files;
  }

  function build(data) {
    return RS.zip.build(buildFiles(data));
  }

  function exportDocx(data) {
    var name = RS.io.safeFileName(((data.meta && data.meta.name) || 'resume') + '-简历', '.docx');
    return build(data).then(function (bytes) {
      RS.io.download(name, new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }));
      return bytes.length;
    });
  }

  RS.renderDocx = {
    build: build,
    buildFiles: buildFiles,
    documentXml: documentXml,
    export: exportDocx
  };
})();
