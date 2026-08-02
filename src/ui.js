/* UI ヘルパ — DOM 生成・アイコン・フォーム部品・モーダル・トースト */

window.SB = window.SB || {};

(function (SB) {
  'use strict';

  /* ---------- DOM ---------- */

  SB.h = function (tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'style') el.setAttribute('style', v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      });
    }
    (Array.isArray(children) ? children : children ? [children] : []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return el;
  };

  SB.esc = function (s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  SB.clear = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  /* ---------- アイコン（線画・絵文字不使用） ---------- */

  var PATHS = {
    plus: 'M12 5v14M5 12h14',
    trash: 'M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13M10 11v6M14 11v6',
    copy: 'M9 9h10v10H9zM5 15V5h10',
    download: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14',
    upload: 'M12 16V5M7.5 9.5L12 5l4.5 4.5M5 19h14',
    up: 'M12 18V6M6.5 11.5L12 6l5.5 5.5',
    down: 'M12 6v12M6.5 12.5L12 18l5.5-5.5',
    undo: 'M9 8H5V4M5.6 8a8 8 0 1 1-1.3 6',
    redo: 'M15 8h4V4M18.4 8a8 8 0 1 0 1.3 6',
    grid: 'M4 9h16M4 15h16M9 4v16M15 4v16',
    zoomIn: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4M11 8.5v5M8.5 11h5',
    zoomOut: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4M8.5 11h5',
    front: 'M4 8l8-4 8 4-8 4-8-4zM4 14l8 4 8-4',
    back: 'M4 16l8 4 8-4M4 10l8-4 8 4-8 4-8-4z',
    check: 'M5 12.5l4.5 4.5L19 7',
    image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9.5 9.5a1 1 0 1 0 0-.001z',
    code: 'M9 7l-5 5 5 5M15 7l5 5-5 5',
    doc: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
    eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z',
    close: 'M6 6l12 12M18 6L6 18',
    dup: 'M8 8h12v12H8zM4 16V4h12'
  };

  SB.icon = function (name) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', PATHS[name] || PATHS.doc);
    svg.appendChild(p);
    return svg;
  };

  SB.iconBtn = function (name, title, onClick, cls) {
    var b = SB.h('button', {
      class: 'btn btn-ghost icon-btn btn-sm' + (cls ? ' ' + cls : ''),
      type: 'button', title: title, 'aria-label': title, onclick: onClick
    });
    b.appendChild(SB.icon(name));
    return b;
  };

  SB.btn = function (label, onClick, cls, iconName) {
    var b = SB.h('button', { class: 'btn ' + (cls || 'btn-ghost'), type: 'button', onclick: onClick });
    if (iconName) b.appendChild(SB.icon(iconName));
    b.appendChild(document.createTextNode(label));
    return b;
  };

  /* ---------- フォーム部品 ---------- */

  function labelEl(text, required) {
    return SB.h('span', { class: 'field-label' }, [text, required ? SB.h('span', { class: 'req', text: '必須' }) : null]);
  }

  SB.field = function (o) {
    var input;
    if (o.multiline) {
      input = SB.h('textarea', {
        placeholder: o.placeholder || '', rows: o.rows || 3,
        style: o.minHeight ? 'min-height:' + o.minHeight + 'px' : null
      });
      input.value = o.value || '';
    } else if (o.options) {
      input = SB.h('select');
      (o.placeholder ? [{ value: '', label: o.placeholder }] : []).concat(
        o.options.map(function (x) { return typeof x === 'string' ? { value: x, label: x } : x; })
      ).forEach(function (op) {
        input.appendChild(SB.h('option', { value: op.value, text: op.label }));
      });
      input.value = o.value || '';
    } else {
      input = SB.h('input', { type: o.type || 'text', placeholder: o.placeholder || '' });
      input.value = o.value || '';
    }
    var ev = (o.options || o.type === 'date') ? 'change' : 'input';
    input.addEventListener(ev, function () { o.onChange(input.value); });

    return SB.h('label', { class: 'field' }, [
      o.label ? labelEl(o.label, o.required) : null,
      input,
      o.hint ? SB.h('span', { class: 'field-hint', text: o.hint }) : null
    ]);
  };

  var groupSeq = 0;

  SB.chipsField = function (o) {
    var gid = 'chips-' + (++groupSeq);
    var wrap = SB.h('div', { class: 'chips', role: 'group', 'aria-labelledby': gid });
    o.options.forEach(function (opt) {
      var on = o.values.indexOf(opt) >= 0;
      var b = SB.h('button', {
        class: 'chip' + (on ? ' is-on' : ''), type: 'button', text: opt,
        'aria-pressed': on ? 'true' : 'false'
      });
      b.addEventListener('click', function () {
        var i = o.values.indexOf(opt);
        if (i >= 0) o.values.splice(i, 1); else o.values.push(opt);
        b.classList.toggle('is-on');
        b.setAttribute('aria-pressed', b.classList.contains('is-on') ? 'true' : 'false');
        o.onChange();
      });
      wrap.appendChild(b);
    });
    var lab = o.label ? labelEl(o.label) : null;
    if (lab) lab.id = gid;
    return SB.h('div', { class: 'field' }, [
      lab,
      wrap,
      o.hint ? SB.h('span', { class: 'field-hint', text: o.hint }) : null
    ]);
  };

  SB.checkList = function (o) {
    var wrap = SB.h('div', {});
    o.options.forEach(function (opt) {
      var cb = SB.h('input', { type: 'checkbox' });
      cb.checked = o.values.indexOf(opt) >= 0;
      cb.addEventListener('change', function () {
        var i = o.values.indexOf(opt);
        if (cb.checked && i < 0) o.values.push(opt);
        if (!cb.checked && i >= 0) o.values.splice(i, 1);
        o.onChange();
      });
      wrap.appendChild(SB.h('label', { class: 'check' }, [cb, SB.h('span', { text: opt })]));
    });
    return SB.h('div', { class: 'field' }, [o.label ? labelEl(o.label) : null, wrap]);
  };

  /* 1行テキストの可変長リスト */
  SB.lineList = function (o) {
    var box = SB.h('div', { class: 'lines' });

    function render() {
      SB.clear(box);
      if (!o.values.length) {
        box.appendChild(SB.h('div', { class: 'empty-state', text: o.empty || 'まだ項目がありません。' }));
      }
      o.values.forEach(function (v, i) {
        var input = SB.h('input', {
          type: 'text', placeholder: o.placeholder || '',
          'aria-label': (o.label || '項目') + ' ' + (i + 1)
        });
        input.value = v;
        input.addEventListener('input', function () { o.values[i] = input.value; o.onChange(); });
        var focusRow = function (idx) {
          var inputs = box.querySelectorAll('input');
          var t = inputs[Math.max(0, Math.min(idx, inputs.length - 1))];
          if (t) t.focus();
        };
        var swap = function (a, b) {
          var t = o.values[a]; o.values[a] = o.values[b]; o.values[b] = t;
          o.onChange(); render(); focusRow(b);
        };
        var row = SB.h('div', { class: 'line-row' }, [
          input,
          SB.iconBtn('up', '上へ', function () { if (i > 0) swap(i, i - 1); }),
          SB.iconBtn('down', '下へ', function () { if (i < o.values.length - 1) swap(i, i + 1); }),
          SB.iconBtn('trash', '削除', function () {
            o.values.splice(i, 1); o.onChange(); render(); focusRow(i);
          }, 'btn-danger')
        ]);
        box.appendChild(row);
      });
      box.appendChild(SB.h('div', { class: 'row-actions' }, [
        SB.btn(o.addLabel || '項目を追加', function () {
          o.values.push(''); o.onChange(); render();
          var inputs = box.querySelectorAll('input');
          if (inputs.length) inputs[inputs.length - 1].focus();
        }, 'btn btn-sm', 'plus')
      ]));
    }
    render();

    return SB.h('div', { class: 'field' }, [
      o.label ? labelEl(o.label) : null,
      o.hint ? SB.h('span', { class: 'field-hint', text: o.hint }) : null,
      box
    ]);
  };

  SB.card = function (title, desc, children) {
    return SB.h('section', { class: 'card' }, [
      title ? SB.h('div', { class: 'card-head' }, [
        SB.h('h2', { text: title }),
        desc ? SB.h('p', { text: desc }) : null
      ]) : null
    ].concat(Array.isArray(children) ? children : [children]));
  };

  // カード全体を作り直さずに見出しだけ差し替える（入力中のフォーカスを失わないため）
  SB.setItemTitle = function (card, children) {
    var t = card && card.querySelector('.item-title');
    if (!t) return;
    SB.clear(t);
    (Array.isArray(children) ? children : [children]).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      t.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
  };

  SB.itemCard = function (o) {
    return SB.h('div', { class: 'item' }, [
      SB.h('div', { class: 'item-head' }, [
        SB.h('span', { class: 'item-idx', text: String(o.index) }),
        SB.h('span', { class: 'item-title' }, o.titleNode || [o.title || SB.h('span', { class: 'muted', text: '(未設定)' })]),
        SB.h('div', { class: 'item-tools' }, o.tools || [])
      ]),
      SB.h('div', { class: 'item-body' }, o.body)
    ]);
  };

  /* ---------- トースト ---------- */

  function showToast(node, ms) {
    var stack = document.getElementById('toastStack');
    stack.appendChild(node);
    setTimeout(function () {
      node.style.transition = 'opacity .2s ease';
      node.style.opacity = '0';
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 220);
    }, ms);
  }

  SB.toast = function (msg, isError) {
    showToast(SB.h('div', { class: 'toast' + (isError ? ' is-err' : ''), text: msg }), isError ? 4200 : 2200);
  };

  // 取り消しなどの操作を添えたトースト
  SB.toastAction = function (msg, actionLabel, onAction) {
    var t = SB.h('div', { class: 'toast has-action' });
    t.appendChild(SB.h('span', { text: msg }));
    t.appendChild(SB.h('button', {
      class: 'toast-btn', type: 'button', text: actionLabel,
      onclick: function () {
        if (t.parentNode) t.parentNode.removeChild(t);
        onAction();
      }
    }));
    showToast(t, 8000);
  };

  /* ---------- モーダル ---------- */

  var modalRoot, modalBody, modalFoot, modalTitle;

  SB.initModal = function () {
    modalRoot = document.getElementById('modalRoot');
    modalBody = document.getElementById('modalBody');
    modalFoot = document.getElementById('modalFoot');
    modalTitle = document.getElementById('modalTitle');
    document.getElementById('modalClose').addEventListener('click', SB.closeModal);
    modalRoot.addEventListener('mousedown', function (e) {
      if (e.target.dataset.close) SB.closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modalRoot.hidden) SB.closeModal();
    });
  };

  var lastFocus = null;

  SB.isModalOpen = function () { return !!modalRoot && !modalRoot.hidden; };

  SB.openModal = function (o) {
    lastFocus = document.activeElement;
    modalTitle.textContent = o.title || '';
    SB.clear(modalBody);
    SB.clear(modalFoot);
    (Array.isArray(o.body) ? o.body : [o.body]).forEach(function (n) { if (n) modalBody.appendChild(n); });
    (o.footer || []).forEach(function (n) { if (n) modalFoot.appendChild(n); });
    modalRoot.hidden = false;
    var target = modalFoot.querySelector('.btn-primary') || modalFoot.querySelector('button') ||
                 modalBody.querySelector('button, input, textarea, select');
    if (target && target.focus) target.focus();
  };

  SB.closeModal = function () {
    if (!modalRoot || modalRoot.hidden) return;
    modalRoot.hidden = true;
    if (lastFocus && lastFocus.focus && document.contains(lastFocus)) {
      try { lastFocus.focus(); } catch (e) {}
    }
    lastFocus = null;
  };

  SB.confirm = function (message, onYes, yesLabel) {
    var cancel = SB.btn('キャンセル', SB.closeModal, 'btn');
    SB.openModal({
      title: '確認',
      body: SB.h('div', { style: 'padding:22px 24px;font-size:13.5px;line-height:1.8', text: message }),
      footer: [
        SB.h('div', { class: 'spacer' }),
        cancel,
        SB.btn(yesLabel || '実行する', function () { SB.closeModal(); onYes(); }, 'btn btn-primary')
      ]
    });
    // Enter 連打で消してしまわないよう、初期フォーカスはキャンセル側に置く
    cancel.focus();
  };

  /* ---------- クリップボード / ダウンロード ---------- */

  /* クリックと同じ処理の中で execCommand を試す。
     navigator.clipboard の失敗を待ってから実行すると、
     Safari などでは「ユーザー操作の直後」ではなくなり弾かれるため。 */
  SB.copyText = function (text) {
    var done = false;
    try {
      var ta = SB.h('textarea', {
        readonly: true,
        style: 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none'
      });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      done = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e) { done = false; }

    if (done) { SB.toast('クリップボードにコピーしました'); return; }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { SB.toast('クリップボードにコピーしました'); },
        function () { SB.toast('コピーできませんでした。下の本文を選択してコピーしてください', true); }
      );
    } else {
      SB.toast('コピーできませんでした。下の本文を選択してコピーしてください', true);
    }
  };

  SB.downloadBlob = function (content, filename, mime) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = SB.h('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    SB.toast(filename + ' を保存しました');
  };

  SB.safeFileName = function (s, fallback) {
    var base = String(s || '').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_');
    return base || fallback || 'spec';
  };

})(window.SB);
