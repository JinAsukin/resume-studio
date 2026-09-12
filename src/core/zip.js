/**
 * 简历工坊 Resume Studio · 极简 ZIP 打包
 * 只实现 OOXML 需要的部分：本地文件头 + 数据 + 中央目录 + EOCD。
 * 有 CompressionStream 时使用 deflate-raw（方式 8），否则退回 store（方式 0）——两者都是合法 ZIP。
 */
(function () {
  var RS = (typeof window !== 'undefined' ? (window.RS = window.RS || {}) : (globalThis.RS = globalThis.RS || {}));

  var CRC_TABLE = (function () {
    var t = new Int32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = -1;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  }

  function toBytes(data) {
    if (data instanceof Uint8Array) return data;
    if (typeof data === 'string') {
      if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(data);
      var arr = [];
      for (var i = 0; i < data.length; i++) arr.push(data.charCodeAt(i) & 0xFF);
      return new Uint8Array(arr);
    }
    return new Uint8Array(data || []);
  }

  function deflateRaw(bytes) {
    if (typeof CompressionStream === 'undefined') return Promise.resolve(null);
    try {
      var cs = new CompressionStream('deflate-raw');
      var stream = new Blob([bytes]).stream().pipeThrough(cs);
      return new Response(stream).arrayBuffer().then(function (buf) {
        return new Uint8Array(buf);
      }).catch(function () { return null; });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  /* DOS 时间：固定为 2024-01-01 00:00，避免不同机器产出不同字节 */
  var DOS_TIME = 0;
  var DOS_DATE = ((2024 - 1980) << 9) | (1 << 5) | 1;

  function writeU16(a, off, v) { a[off] = v & 0xFF; a[off + 1] = (v >>> 8) & 0xFF; }
  function writeU32(a, off, v) {
    a[off] = v & 0xFF;
    a[off + 1] = (v >>> 8) & 0xFF;
    a[off + 2] = (v >>> 16) & 0xFF;
    a[off + 3] = (v >>> 24) & 0xFF;
  }

  /**
   * @param {Array<{name:string, data:string|Uint8Array, store?:boolean}>} files
   * @returns {Promise<Uint8Array>}
   */
  function build(files) {
    var entries = [];
    return Promise.all(files.map(function (f) {
      var raw = toBytes(f.data);
      var crc = crc32(raw);
      if (f.store) {
        return { nameBytes: toBytes(f.name), raw: raw, body: raw, method: 0, crc: crc };
      }
      return deflateRaw(raw).then(function (packed) {
        if (packed && packed.length < raw.length) {
          return { nameBytes: toBytes(f.name), raw: raw, body: packed, method: 8, crc: crc };
        }
        return { nameBytes: toBytes(f.name), raw: raw, body: raw, method: 0, crc: crc };
      });
    })).then(function (list) {
      var chunks = [];
      var offset = 0;

      list.forEach(function (e) {
        var head = new Uint8Array(30 + e.nameBytes.length);
        writeU32(head, 0, 0x04034b50);
        writeU16(head, 4, 20);
        writeU16(head, 6, 0x0800);          /* UTF-8 文件名 */
        writeU16(head, 8, e.method);
        writeU16(head, 10, DOS_TIME);
        writeU16(head, 12, DOS_DATE);
        writeU32(head, 14, e.crc);
        writeU32(head, 18, e.body.length);
        writeU32(head, 22, e.raw.length);
        writeU16(head, 26, e.nameBytes.length);
        writeU16(head, 28, 0);
        head.set(e.nameBytes, 30);

        entries.push({ e: e, offset: offset });
        chunks.push(head);
        chunks.push(e.body);
        offset += head.length + e.body.length;
      });

      var cdStart = offset;
      list.forEach(function (e, i) {
        var rec = entries[i];
        var cd = new Uint8Array(46 + e.nameBytes.length);
        writeU32(cd, 0, 0x02014b50);
        writeU16(cd, 4, 20);
        writeU16(cd, 6, 20);
        writeU16(cd, 8, 0x0800);
        writeU16(cd, 10, e.method);
        writeU16(cd, 12, DOS_TIME);
        writeU16(cd, 14, DOS_DATE);
        writeU32(cd, 16, e.crc);
        writeU32(cd, 20, e.body.length);
        writeU32(cd, 24, e.raw.length);
        writeU16(cd, 28, e.nameBytes.length);
        writeU16(cd, 30, 0);
        writeU16(cd, 32, 0);
        writeU16(cd, 34, 0);
        writeU16(cd, 36, 0);
        writeU32(cd, 38, 0);
        writeU32(cd, 42, rec.offset);
        cd.set(e.nameBytes, 46);
        chunks.push(cd);
        offset += cd.length;
      });

      var eocd = new Uint8Array(22);
      writeU32(eocd, 0, 0x06054b50);
      writeU16(eocd, 4, 0);
      writeU16(eocd, 6, 0);
      writeU16(eocd, 8, list.length);
      writeU16(eocd, 10, list.length);
      writeU32(eocd, 12, offset - cdStart);
      writeU32(eocd, 16, cdStart);
      writeU16(eocd, 20, 0);
      chunks.push(eocd);

      var total = chunks.reduce(function (s, c) { return s + c.length; }, 0);
      var out = new Uint8Array(total);
      var p = 0;
      chunks.forEach(function (c) { out.set(c, p); p += c.length; });
      return out;
    });
  }

  RS.zip = { build: build, crc32: crc32, toBytes: toBytes };
})();
