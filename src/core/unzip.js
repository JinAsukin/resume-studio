/**
 * 简历工坊 Resume Studio · 极简 ZIP 读取
 * 只做 OOXML（docx）解析需要的事：读中央目录 → 定位条目 → 按需解压。
 * 支持 store（方式 0）与 deflate（方式 8，用原生 DecompressionStream）。
 */
(function () {
  var RS = (typeof window !== 'undefined' ? (window.RS = window.RS || {}) : (globalThis.RS = globalThis.RS || {}));

  function readU16(a, p) { return a[p] | (a[p + 1] << 8); }
  function readU32(a, p) { return (a[p] | (a[p + 1] << 8) | (a[p + 2] << 16) | (a[p + 3] << 24)) >>> 0; }

  function decodeUtf8(bytes) {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(bytes);
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return decodeURIComponent(escape(s));
  }

  /** 从尾部寻找 EOCD（0x06054b50） */
  function findEOCD(bytes) {
    var start = Math.max(0, bytes.length - 22 - 65535);
    for (var i = bytes.length - 22; i >= start; i--) {
      if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) return i;
    }
    return -1;
  }

  function readCentral(bytes, eocd) {
    var count = readU16(bytes, eocd + 10);
    var cdOffset = readU32(bytes, eocd + 16);
    var entries = [];
    var p = cdOffset;
    for (var i = 0; i < count; i++) {
      if (p + 46 > bytes.length || readU32(bytes, p) !== 0x02014b50) break;
      var method = readU16(bytes, p + 10);
      var crc = readU32(bytes, p + 16);
      var compSize = readU32(bytes, p + 20);
      var uncompSize = readU32(bytes, p + 24);
      var nameLen = readU16(bytes, p + 28);
      var extraLen = readU16(bytes, p + 30);
      var commentLen = readU16(bytes, p + 32);
      var localOffset = readU32(bytes, p + 42);
      var name = nameLen ? decodeUtf8(bytes.subarray(p + 46, p + 46 + nameLen)) : '';
      entries.push({
        name: name, method: method, crc: crc,
        compSize: compSize, uncompSize: uncompSize, localOffset: localOffset
      });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  /** 从本地文件头定位真实数据起点（名称/额外字段长度可能与中央目录不同） */
  function dataSlice(bytes, entry) {
    var p = entry.localOffset;
    if (readU32(bytes, p) !== 0x04034b50) throw new Error('ZIP 本地文件头损坏');
    var nameLen = readU16(bytes, p + 26);
    var extraLen = readU16(bytes, p + 28);
    var start = p + 30 + nameLen + extraLen;
    return bytes.subarray(start, start + entry.compSize);
  }

  function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') {
      return Promise.reject(new Error('当前浏览器不支持解压（缺少 DecompressionStream）'));
    }
    try {
      var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(stream).arrayBuffer().then(function (buf) { return new Uint8Array(buf); });
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * 读取整个 ZIP。
   * @param {ArrayBuffer|Uint8Array} input
   * @returns {Promise<{entries: Array, files: Object, text: Function}>}
   */
  function read(input) {
    var bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    var eocd = findEOCD(bytes);
    if (eocd < 0) return Promise.reject(new Error('不是有效的 docx / zip 文件'));

    var entries = readCentral(bytes, eocd);
    if (!entries.length) return Promise.reject(new Error('压缩包内没有可读条目'));

    var files = {};
    var jobs = entries.map(function (e) {
      var raw;
      try {
        raw = dataSlice(bytes, e);
      } catch (err) {
        return Promise.resolve();
      }
      if (e.method === 0) {
        files[e.name] = raw;
        return Promise.resolve();
      }
      if (e.method === 8) {
        return inflateRaw(raw).then(function (d) { files[e.name] = d; }).catch(function () { /* 跳过坏条目 */ });
      }
      return Promise.resolve();
    });

    return Promise.all(jobs).then(function () {
      return { entries: entries, files: files, text: toText };
    });
  }

  function toText(bytes) { return decodeUtf8(bytes); }

  RS.unzip = { read: read, decodeUtf8: decodeUtf8 };
})();
