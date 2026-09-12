/**
 * 简历工坊 Resume Studio · 状态层
 * 职责：数据持有、本地自动存档、版本差量、变更广播。
 * 不碰 DOM，UI 通过 subscribe 订阅变更。
 */
(function () {
  var RS = (typeof window !== 'undefined' ? (window.RS = window.RS || {}) : (globalThis.RS = globalThis.RS || {}));

  var KEY = 'resume-studio:data:v1';
  var CHANGE_MS = 120;
  var SAVE_MS = 500;

  var state = { data: null, versionIndex: 0, storageOK: true, savedAt: 0 };
  var listeners = [];
  var changeTimer = null;
  var saveTimer = null;

  var _ls;
  /** 探测并缓存 localStorage 可用性（file:// 或隐私模式下可能不可用） */
  function storage() {
    if (_ls !== undefined) return _ls;
    _ls = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('resume-studio:probe', '1');
        window.localStorage.removeItem('resume-studio:probe');
        _ls = window.localStorage;
      }
    } catch (e) {
      _ls = null;
    }
    if (!_ls) state.storageOK = false;
    return _ls;
  }

  function read() {
    var ls = storage();
    if (!ls) return null;
    try {
      var raw = ls.getItem(KEY);
      if (!raw) return null;
      return RS.schema.normalize(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  }

  function writeNow() {
    var ls = storage();
    if (!ls) return;
    try {
      ls.setItem(KEY, JSON.stringify(state.data));
      state.savedAt = Date.now();
    } catch (e) {
      state.storageOK = false;
    }
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { writeNow(); emit('saved'); }, SAVE_MS);
  }

  /** 当前生效数据 = 主数据 + 当前版本差量 */
  function current() {
    if (!state.data) return null;
    var versions = state.data.versions || [];
    var v = versions[state.versionIndex] || versions[0];
    return RS.schema.applyOverrides(state.data, v ? v.overrides : {});
  }

  function emit(reason) {
    var d = current();
    listeners.forEach(function (fn) {
      try { fn(d, reason || 'change'); } catch (e) { console.error('[rs] listener error', e); }
    });
  }

  function scheduleChange() {
    if (changeTimer) clearTimeout(changeTimer);
    changeTimer = setTimeout(function () { emit('change'); }, CHANGE_MS);
  }

  function init(opts) {
    var loaded = read();
    if (loaded) {
      state.data = loaded;
    } else if (opts && opts.empty) {
      state.data = RS.schema.blank();
      writeNow();
    } else {
      state.data = RS.schema.demo();
      writeNow();
    }
    if (state.versionIndex >= state.data.versions.length) state.versionIndex = 0;
    return state.data;
  }

  /**
   * 写入字段。规则：若该路径在当前版本中已有差量，则写入差量（否则用户会「改了没反应」）；
   * 否则写入主数据，所有版本共享。
   */
  function set(path, value) {
    if (hasOverride(path)) {
      applyOverride(path, value, 'change');
      return;
    }
    RS.schema.setPath(state.data, path, value);
    scheduleChange();
    scheduleSave();
  }

  function hasOverride(path) {
    var v = versions()[state.versionIndex];
    return !!(v && v.overrides && Object.prototype.hasOwnProperty.call(v.overrides, path));
  }

  function get(path) { return RS.schema.getPath(state.data, path); }

  /** 结构性变更（增删板块/条目）：立即广播 */
  function mutate(fn) {
    fn(state.data);
    emit('structure');
    scheduleSave();
  }

  function replaceData(next) {
    state.data = RS.schema.normalize(next);
    state.versionIndex = 0;
    emit('replace');
    scheduleSave();
  }

  function resetEmpty() { replaceData(RS.schema.blank()); }
  function loadDemo() { replaceData(RS.schema.demo()); }
  function clearStorage() {
    var ls = storage();
    if (ls) ls.removeItem(KEY);
  }

  /* ---------- 版本 ---------- */
  function versions() { return state.data.versions || []; }
  function versionIndex() { return state.versionIndex; }

  function setVersion(i) {
    if (i < 0 || i >= versions().length) return;
    state.versionIndex = i;
    emit('version');
    scheduleSave();
  }

  function addVersion(name) {
    var n = (name || '').trim() || ('版本 ' + (versions().length + 1));
    state.data.versions.push({ name: n, overrides: {} });
    state.versionIndex = state.data.versions.length - 1;
    emit('version');
    scheduleSave();
  }

  function renameVersion(i, name) {
    if (!versions()[i]) return;
    versions()[i].name = name;
    emit('version');
    scheduleSave();
  }

  function removeVersion(i) {
    if (versions().length <= 1) return;
    state.data.versions.splice(i, 1);
    if (state.versionIndex >= state.data.versions.length) state.versionIndex = state.data.versions.length - 1;
    emit('version');
    scheduleSave();
  }

  /** 为当前版本设置差量字段；value 为空则移除该差量 */
  function applyOverride(path, value, reason) {
    var v = versions()[state.versionIndex];
    if (!v) return;
    v.overrides = v.overrides || {};
    var empty = value === '' || value === null || value === undefined ||
      (Array.isArray(value) && value.filter(Boolean).length === 0);
    if (empty) delete v.overrides[path];
    else v.overrides[path] = value;
    emit(reason || 'version');
    scheduleSave();
  }

  function setOverride(path, value) { applyOverride(path, value, 'version'); }

  function getOverride(path) {
    var v = versions()[state.versionIndex];
    if (!v || !v.overrides) return undefined;
    return Object.prototype.hasOwnProperty.call(v.overrides, path) ? v.overrides[path] : undefined;
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function unsubscribe() {
      var i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  function flush() {
    if (changeTimer) { clearTimeout(changeTimer); changeTimer = null; }
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    writeNow();
    emit('change');
  }

  RS.store = {
    init: init,
    current: current,
    raw: function () { return state.data; },
    set: set,
    get: get,
    mutate: mutate,
    replaceData: replaceData,
    resetEmpty: resetEmpty,
    loadDemo: loadDemo,
    clearStorage: clearStorage,
    subscribe: subscribe,
    flush: flush,
    versions: versions,
    versionIndex: versionIndex,
    setVersion: setVersion,
    addVersion: addVersion,
    renameVersion: renameVersion,
    removeVersion: removeVersion,
    setOverride: setOverride,
    getOverride: getOverride,
    storageOK: function () { return state.storageOK; },
    savedAt: function () { return state.savedAt; }
  };
})();
