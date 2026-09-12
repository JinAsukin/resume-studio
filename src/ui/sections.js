/**
 * 简历工坊 Resume Studio · 板块操作（纯数据逻辑，不产生 DOM）
 * 渲染由 ui/form.js 负责，本文件只负责改动数据。
 */
(function () {
  var RS = (typeof window !== 'undefined' ? (window.RS = window.RS || {}) : (globalThis.RS = globalThis.RS || {}));

  function indexOfSection(data, id) {
    var list = data.sections || [];
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) return i; }
    return -1;
  }

  function indexOfItem(data, secId, itemId) {
    var i = indexOfSection(data, secId);
    if (i < 0) return -1;
    var items = data.sections[i].items || [];
    for (var j = 0; j < items.length; j++) { if (items[j].id === itemId) return j; }
    return -1;
  }

  function addSection(type, title) {
    RS.store.mutate(function (d) { d.sections.push(RS.schema.blankSection(type, title)); });
  }

  function removeSection(id) {
    RS.store.mutate(function (d) {
      var i = indexOfSection(d, id);
      if (i >= 0) d.sections.splice(i, 1);
    });
  }

  function moveSection(id, dir) {
    RS.store.mutate(function (d) {
      var i = indexOfSection(d, id);
      var j = i + (dir === 'up' ? -1 : 1);
      if (i < 0 || j < 0 || j >= d.sections.length) return;
      var tmp = d.sections[i];
      d.sections[i] = d.sections[j];
      d.sections[j] = tmp;
    });
  }

  function toggleVisible(id) {
    RS.store.mutate(function (d) {
      var i = indexOfSection(d, id);
      if (i >= 0) d.sections[i].visible = d.sections[i].visible === false;
    });
  }

  /** 切换板块类型（保留标题，内容重置为该类型默认值） */
  function changeType(id, type) {
    RS.store.mutate(function (d) {
      var i = indexOfSection(d, id);
      if (i < 0) return;
      var old = d.sections[i];
      var next = RS.schema.blankSection(type, old.title);
      next.id = old.id;
      next.visible = old.visible;
      next.note = old.note;
      d.sections[i] = next;
    });
  }

  function addItem(secId) {
    RS.store.mutate(function (d) {
      var i = indexOfSection(d, secId);
      if (i < 0) return;
      var sec = d.sections[i];
      if (!sec.items) sec.items = [];
      sec.items.push(RS.schema.blankItem());
    });
  }

  function removeItem(secId, itemId) {
    RS.store.mutate(function (d) {
      var i = indexOfSection(d, secId);
      var j = indexOfItem(d, secId, itemId);
      if (i < 0 || j < 0) return;
      d.sections[i].items.splice(j, 1);
      if (!d.sections[i].items.length) d.sections[i].items.push(RS.schema.blankItem());
    });
  }

  function moveItem(secId, itemId, dir) {
    RS.store.mutate(function (d) {
      var i = indexOfSection(d, secId);
      var j = indexOfItem(d, secId, itemId);
      if (i < 0 || j < 0) return;
      var items = d.sections[i].items;
      var k = j + (dir === 'up' ? -1 : 1);
      if (k < 0 || k >= items.length) return;
      var tmp = items[j];
      items[j] = items[k];
      items[k] = tmp;
    });
  }

  function addPair(secId) {
    RS.store.mutate(function (d) {
      var i = indexOfSection(d, secId);
      if (i < 0) return;
      var sec = d.sections[i];
      if (!sec.pairs) sec.pairs = [];
      sec.pairs.push({ key: '', value: '' });
    });
  }

  function removePair(secId, pairIndex) {
    RS.store.mutate(function (d) {
      var i = indexOfSection(d, secId);
      if (i < 0) return;
      var pairs = d.sections[i].pairs || [];
      pairs.splice(pairIndex, 1);
      if (!pairs.length) pairs.push({ key: '', value: '' });
    });
  }

  RS.sections = {
    indexOfSection: indexOfSection,
    indexOfItem: indexOfItem,
    addSection: addSection,
    removeSection: removeSection,
    moveSection: moveSection,
    toggleVisible: toggleVisible,
    changeType: changeType,
    addItem: addItem,
    removeItem: removeItem,
    moveItem: moveItem,
    addPair: addPair,
    removePair: removePair
  };
})();
