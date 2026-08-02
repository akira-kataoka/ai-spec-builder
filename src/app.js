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

  var syncingHash = false;

  function go(key) {
    if (SB.views.screensUnmount) SB.views.screensUnmount();
    currentKey = key;
    closeNav();
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
    if (!syncingHash) {
      syncingHash = true;
      try { if (location.hash.replace('#', '') !== key) location.hash = key; } catch (e) {}
      setTimeout(function () { syncingHash = false; }, 0);
    }
  }

  SB.go = go;

  /* ---------- 狭い画面用のメニュー ---------- */

  function openNav() {
    document.body.classList.add('nav-open');
    if (el.navToggle) el.navToggle.setAttribute('aria-expanded', 'true');
  }
  function closeNav() {
    document.body.classList.remove('nav-open');
    if (el.navToggle) el.navToggle.setAttribute('aria-expanded', 'false');
  }
  function toggleNav() {
    if (document.body.classList.contains('nav-open')) closeNav(); else openNav();
  }

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

  SB.onSaveError = function (e, first) {
    el.autosave.textContent = '自動保存に失敗しています';
    el.autosave.style.color = 'var(--danger)';
    if (first) {
      SB.toast('自動保存に失敗しました。「保存(JSON)」でファイルに書き出してください', true);
    }
  };

  /* ---------- 入出力 ---------- */

  function exportJson() {
    var name = SB.safeFileName(SB.doc.basic.projectName, '指示書');
    SB.downloadBlob(JSON.stringify(SB.doc, null, 2), name + '.json', 'application/json;charset=utf-8');
  }

  function isDocEmpty() {
    return SB.completion() === 0 && !SB.nodeCount();
  }

  // 元に戻せる操作の直後に、取り消しの導線を出す
  function offerUndo(message) {
    if (!SB.hasBackup()) { SB.toast(message); return; }
    SB.toastAction(message, '元に戻す', function () {
      if (SB.restoreBackup()) {
        go(currentKey === 'screens' ? 'basic' : currentKey);
        SB.toast('元に戻しました');
      } else {
        SB.toast('元に戻せませんでした', true);
      }
    });
  }

  function importJson(file) {
    var reader = new FileReader();
    reader.onerror = function () { SB.toast('ファイルを読み取れませんでした', true); };
    reader.onload = function () {
      var obj;
      try {
        obj = JSON.parse(String(reader.result));
      } catch (e) {
        SB.toast('JSONとして読み取れないファイルです', true);
        return;
      }
      if (!SB.looksLikeDoc(obj)) {
        SB.toast('この指示書ビルダーで保存したJSONではないようです', true);
        return;
      }
      var apply = function () {
        SB.replaceDoc(obj);
        go(currentKey === 'screens' ? 'basic' : currentKey);
        offerUndo('読み込みました');
      };
      if (isDocEmpty()) apply();
      else SB.confirm('入力中の内容を、読み込んだ内容で置き換えます。よろしいですか。' +
                      '（直前の内容は1回だけ元に戻せます）', apply, '置き換える');
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
      if (isDocEmpty()) { SB.toast('すでに新しい指示書です'); return; }
      SB.confirm('入力中の内容をすべて破棄して、新しい指示書を作成します。よろしいですか。' +
                 '（直前の内容は1回だけ元に戻せます）', function () {
        SB.reset();
        go('basic');
        offerUndo('新しい指示書を作成しました');
      }, '破棄して新規作成');
    });

    document.getElementById('btnOutput').addEventListener('click', function () { go('output'); });

    el.navToggle = document.getElementById('btnNav');
    if (el.navToggle) el.navToggle.addEventListener('click', toggleNav);
    var scrim = document.getElementById('navScrim');
    if (scrim) scrim.addEventListener('click', closeNav);

    var hash = (location.hash || '').replace('#', '');
    var valid = SB.SECTIONS.some(function (s) { return s.key === hash; });
    go(valid ? hash : 'basic');

    // ブラウザの戻る/進むでセクションを合わせる
    window.addEventListener('hashchange', function () {
      var k = (location.hash || '').replace('#', '');
      if (!SB.SECTIONS.some(function (s) { return s.key === k; })) return;
      if (k === currentKey) return;
      syncingHash = true;
      go(k);
      syncingHash = false;
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeNav();
    });

    if (!SB.storageAvailable) {
      SB.toast('このブラウザでは自動保存が使えません。「保存(JSON)」でこまめに書き出してください', true);
    }

    // 保存待ちがあるときだけ書き出す（別タブの新しい内容を古い内容で潰さないため）
    window.addEventListener('beforeunload', function () { SB.flush(); });
    window.addEventListener('pagehide', function () { SB.flush(); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') SB.flush();
    });

    // 別タブで編集されたことを検知する
    var warnedOtherTab = false;
    window.addEventListener('storage', function (e) {
      if (e.key !== SB.STORAGE_KEY || !e.newValue) return;
      if (warnedOtherTab) return;
      warnedOtherTab = true;
      SB.toast('別のタブでこの指示書が編集されました。両方で編集すると片方が失われます', true);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window.SB);
