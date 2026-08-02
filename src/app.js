/* アプリ本体 — 画面遷移・ナビ・保存/読込 */

window.SB = window.SB || {};

(function (SB) {
  'use strict';

  var h = SB.h;
  var el = {};
  var currentKey = 'basic';

  /* ---------- ナビ ---------- */

  function renderNav() {
    SB.clear(el.navList);
    SB.SECTIONS.forEach(function (sec, i) {
      var st = sec.key === 'output' ? { done: false, count: 0 } : SB.sectionStatus(sec.key);
      var item = h('button', {
        class: 'nav-item' + (sec.key === currentKey ? ' is-active' : '') + (st.done ? ' is-filled' : ''),
        type: 'button',
        onclick: function () { go(sec.key); }
      }, [
        h('span', { class: 'nav-num' }, [st.done ? SB.icon('check') : String(i + 1)]),
        h('span', { class: 'nav-label', text: sec.label }),
        st.count ? h('span', { class: 'nav-count', text: String(st.count) }) : null
      ]);
      el.navList.appendChild(item);
    });

    var pct = SB.completion();
    el.progressFill.style.width = pct + '%';
    el.progressLabel.textContent = pct + '%';
  }

  /* ---------- 画面遷移 ---------- */

  function go(key) {
    if (SB.views.screensUnmount) SB.views.screensUnmount();
    currentKey = key;
    var sec = SB.SECTIONS.filter(function (s) { return s.key === key; })[0] || SB.SECTIONS[0];
    el.viewTitle.textContent = sec.label;
    el.viewHint.textContent = sec.hint;
    el.workspace.className = 'workspace' + (key === 'screens' ? ' is-editor' : '');
    SB.clear(el.workspace);
    el.workspace.scrollTop = 0;
    var view = SB.views[key];
    if (view) view(el.workspace);
    else el.workspace.appendChild(h('div', { class: 'sheet', text: '準備中です。' }));
    renderNav();
    try { location.hash = key; } catch (e) {}
  }

  SB.go = go;

  /* ---------- 変更通知 ---------- */

  SB.touch = function () {
    SB.save();
    renderNav();
  };

  SB.onSaved = function (iso) {
    var d = new Date(iso);
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    el.autosave.textContent = '自動保存: ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  };

  SB.onSaveError = function () {
    el.autosave.textContent = '自動保存に失敗しました';
  };

  /* ---------- 入出力 ---------- */

  function exportJson() {
    var name = SB.safeFileName(SB.doc.basic.projectName, '指示書');
    SB.downloadBlob(JSON.stringify(SB.doc, null, 2), name + '.json', 'application/json;charset=utf-8');
  }

  function importJson(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var obj = JSON.parse(String(reader.result));
        SB.replaceDoc(obj);
        go(currentKey === 'screens' ? 'basic' : currentKey);
        SB.toast('読み込みました');
      } catch (e) {
        SB.toast('JSONを読み込めませんでした', true);
      }
    };
    reader.readAsText(file);
  }

  /* ---------- 起動 ---------- */

  function boot() {
    el.navList = document.getElementById('navList');
    el.progressFill = document.getElementById('progressFill');
    el.progressLabel = document.getElementById('progressLabel');
    el.viewTitle = document.getElementById('viewTitle');
    el.viewHint = document.getElementById('viewHint');
    el.workspace = document.getElementById('workspace');
    el.autosave = document.getElementById('autosave');
    el.fileInput = document.getElementById('fileInput');

    SB.initModal();
    SB.setTheme(SB.getTheme());
    SB.load();

    document.getElementById('btnTheme').addEventListener('click', function () {
      SB.setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });

    document.getElementById('btnExport').addEventListener('click', exportJson);

    document.getElementById('btnImport').addEventListener('click', function () { el.fileInput.click(); });
    el.fileInput.addEventListener('change', function () {
      if (el.fileInput.files && el.fileInput.files[0]) importJson(el.fileInput.files[0]);
      el.fileInput.value = '';
    });

    document.getElementById('btnNew').addEventListener('click', function () {
      SB.confirm('入力中の内容をすべて破棄して、新しい指示書を作成します。よろしいですか。', function () {
        SB.reset();
        go('basic');
        SB.toast('新しい指示書を作成しました');
      }, '破棄して新規作成');
    });

    document.getElementById('btnOutput').addEventListener('click', function () { go('output'); });

    var hash = (location.hash || '').replace('#', '');
    var valid = SB.SECTIONS.some(function (s) { return s.key === hash; });
    go(valid ? hash : 'basic');

    window.addEventListener('beforeunload', function () { SB.save(true); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window.SB);
