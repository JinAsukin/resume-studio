# -*- coding: utf-8 -*-
"""
简历工坊 Resume Studio · DOCX 产物校验
用标准库独立验证：ZIP 完整性、所有 XML 可解析、Word 关键结构存在。
用法：python tools/verify-docx.py dist/_test.docx dist/_test-photo.docx
"""
import sys
import zipfile
import xml.etree.ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
WP = '{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}'
REQUIRED = [
    '[Content_Types].xml',
    '_rels/.rels',
    'word/document.xml',
    'word/styles.xml',
    'word/numbering.xml',
    'word/_rels/document.xml.rels',
    'docProps/core.xml',
]


def verify(path):
    print('== %s ==' % path)
    ok = True
    z = zipfile.ZipFile(path)
    bad = z.testzip()
    if bad:
        print('  [FAIL] ZIP 条目损坏: %s' % bad)
        return False
    print('  [ok] ZIP 完整性')

    names = z.namelist()
    for req in REQUIRED:
        if req not in names:
            print('  [FAIL] 缺少 %s' % req)
            ok = False
    if ok:
        print('  [ok] 必需部件齐全 (%d 个)' % len(names))

    for n in names:
        if n.endswith('.xml') or n.endswith('.rels'):
            try:
                ET.fromstring(z.read(n))
            except Exception as e:
                print('  [FAIL] XML 解析失败 %s: %s' % (n, e))
                ok = False
    print('  [ok] 全部 XML 可解析')

    doc = ET.fromstring(z.read('word/document.xml'))
    paras = list(doc.iter(W + 'p'))
    tbls = list(doc.iter(W + 'tbl'))
    numer = list(doc.iter(W + 'numPr'))
    drawings = list(doc.iter(WP + 'inline'))
    print('  段落 %d · 表格 %d · 项目符号段 %d · 内嵌图片 %d' % (len(paras), len(tbls), len(numer), len(drawings)))

    if len(paras) < 15:
        print('  [FAIL] 段落数异常偏少')
        ok = False
    if numer == []:
        print('  [FAIL] 没有项目符号段落')
        ok = False

    # 图片关系与 media 一致性（有照片时必须使用「左图右文」表格承载版式）
    rels = ET.fromstring(z.read('word/_rels/document.xml.rels'))
    img_rels = [r.get('Target') for r in rels if 'image' in (r.get('Type') or '')]
    media = [n for n in names if n.startswith('word/media/')]
    if media:
        if tbls == []:
            print('  [FAIL] 有照片却缺少头部表格')
            ok = False
        if not img_rels:
            print('  [FAIL] 有 media 却无 image 关系')
            ok = False
        else:
            print('  [ok] 头部表格 %d 个；图片关系 -> %s；media -> %s' % (len(tbls), img_rels, media))
    else:
        print('  [ok] 无照片（纯文字版，不使用表格）')

    print('  结果: %s\n' % ('通过' if ok else '未通过'))
    return ok


if __name__ == '__main__':
    targets = sys.argv[1:] or ['dist/_test.docx']
    results = [verify(t) for t in targets]
    sys.exit(0 if all(results) else 1)
