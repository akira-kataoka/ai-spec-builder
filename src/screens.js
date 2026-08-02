/* 画面設計エディタ — SVG キャンバスに部品を置いて画面を組み立てる */

window.SB = window.SB || {};

(function (SB) {
  'use strict';

  var h = SB.h;
  var NS = 'http://www.w3.org/2000/svg';

  SB.views = SB.views || {};

  var ui = {};          // DOM 参照
  var current = 0;      // 表示中の画面 index
  var selection = [];   // 選択中ノード id
  var zoom = 1;
  var snapOn = true;
  var GRID = 8;
  var undoStacks = {};  // screenId -> { past: [], future: [] }
  var drag = null;      // ドラッグ中の状態
  var mounted = false;

  /* ---------- 便利関数 ---------- */

  function screens() { return SB.doc.screens; }
  function scr() { return screens()[current]; }
  function snap(v) { return snapOn ? Math.round(v / GRID) * GRID : Math.round(v); }
  function nodeById(id) {
    var s = scr(); if (!s) return null;
    for (var i = 0; i < s.nodes.length; i++) if (s.nodes[i].id === id) return s.nodes[i];
    return null;
  }
  function selectedNodes() {
    return selection.map(nodeById).filter(Boolean);
  }
  function shapeDef(type) {
    return (SB.shapes && SB.shapes[type]) || null;
  }

  /* ---------- 取り消し / やり直し ---------- */

  function stack() {
    var s = scr();
    if (!s) return { past: [], future: [] };
    if (!undoStacks[s.id]) undoStacks[s.id] = { past: [], future: [] };
    return undoStacks[s.id];
  }
  function pushUndo() {
    var s = scr(); if (!s) return;
    var st = stack();
    st.past.push(JSON.stringify(s.nodes));
    if (st.past.length > 60) st.past.shift();
    st.future.length = 0;
  }
  function undo() {
    var s = scr(); if (!s) return;
    var st = stack();
    if (!st.past.length) return;
    st.future.push(JSON.stringify(s.nodes));
    s.nodes = JSON.parse(st.past.pop());
    selection = [];
    commit();
  }
  function redo() {
    var s = scr(); if (!s) return;
    var st = stack();
    if (!st.future.length) return;
    st.past.push(JSON.stringify(s.nodes));
    s.nodes = JSON.parse(st.future.pop());
    selection = [];
    commit();
  }

  function commit() {
    SB.touch();
    renderCanvas();
    renderInspector();
    renderTabs();
  }

  /* ---------- ノード操作 ---------- */

  function addNode(type, cx, cy) {
    var def = shapeDef(type);
    if (!def) return;
    var s = scr(); if (!s) return;
    pushUndo();
    var n = {
      id: SB.uid('n'), type: type,
      x: snap((cx === undefined ? s.width / 2 : cx) - def.w / 2),
      y: snap((cy === undefined ? 120 : cy) - def.h / 2),
      w: def.w, h: def.h,
      label: '', note: '', link: '', props: {}
    };
    n.x = Math.max(0, Math.min(n.x, s.width - 16));
    n.y = Math.max(0, Math.min(n.y, s.height - 16));
    s.nodes.push(n);
    selection = [n.id];
    commit();
  }

  function deleteSelected() {
    var s = scr(); if (!s || !selection.length) return;
    pushUndo();
    s.nodes = s.nodes.filter(function (n) { return selection.indexOf(n.id) < 0; });
    selection = [];
    commit();
  }

  function duplicateSelected() {
    var s = scr(); if (!s || !selection.length) return;
    pushUndo();
    var copies = selectedNodes().map(function (n) {
      var c = SB.clone(n);
      c.id = SB.uid('n');
      c.x = snap(n.x + 16); c.y = snap(n.y + 16);
      return c;
    });
    s.nodes = s.nodes.concat(copies);
    selection = copies.map(function (c) { return c.id; });
    commit();
  }

  function reorder(toFront) {
    var s = scr(); if (!s || !selection.length) return;
    pushUndo();
    var picked = s.nodes.filter(function (n) { return selection.indexOf(n.id) >= 0; });
    var rest = s.nodes.filter(function (n) { return selection.indexOf(n.id) < 0; });
    s.nodes = toFront ? rest.concat(picked) : picked.concat(rest);
    commit();
  }

  function alignSelected(mode) {
    var ns = selectedNodes();
    if (ns.length < 2) return;
    pushUndo();
    var minX = Math.min.apply(null, ns.map(function (n) { return n.x; }));
    var maxX = Math.max.apply(null, ns.map(function (n) { return n.x + n.w; }));
    var minY = Math.min.apply(null, ns.map(function (n) { return n.y; }));
    var maxY = Math.max.apply(null, ns.map(function (n) { return n.y + n.h; }));
    ns.forEach(function (n) {
      if (mode === 'left') n.x = minX;
      if (mode === 'centerX') n.x = snap((minX + maxX) / 2 - n.w / 2);
      if (mode === 'right') n.x = maxX - n.w;
      if (mode === 'top') n.y = minY;
      if (mode === 'centerY') n.y = snap((minY + maxY) / 2 - n.h / 2);
      if (mode === 'bottom') n.y = maxY - n.h;
    });
    commit();
  }

  /* ---------- SVG 生成 ---------- */

  function drawNode(n) {
    var def = shapeDef(n.type);
    var inner;
    if (def && typeof def.draw === 'function') {
      try { inner = def.draw(n); } catch (e) { inner = ''; }
    }
    // 極端に小さいサイズなど、部品側が何も描けなかった場合の保険
    if (!inner || !String(inner).trim()) inner = fallbackDraw(n);
    return '<g class="node" data-id="' + SB.esc(n.id) + '" transform="translate(' + n.x + ',' + n.y + ')">' +
      inner +
      '<rect class="node-hit" x="0" y="0" width="' + n.w + '" height="' + n.h + '" fill="transparent" data-id="' + SB.esc(n.id) + '"></rect>' +
      '</g>';
  }

  function fallbackDraw(n) {
    var def = shapeDef(n.type);
    var name = n.label || (def && def.name) || n.type;
    var fs = 11;
    var max = Math.max(1, Math.floor((n.w - 10) / (fs * 0.9)));
    var shown = name.length > max ? name.slice(0, Math.max(1, max - 1)) + '…' : name;
    return '<rect x="0.5" y="0.5" width="' + Math.max(1, n.w - 1) + '" height="' + Math.max(1, n.h - 1) +
      '" rx="4" fill="#f5f5f5" stroke="#bdbdbd" stroke-dasharray="4 3"></rect>' +
      (n.h >= 16 ? '<text x="5" y="' + (n.h / 2 + 4) + '" font-size="' + fs + '" fill="#757575" ' +
        'font-family="system-ui, -apple-system, \'Segoe UI\', \'Yu Gothic UI\', \'Hiragino Sans\', Meiryo, sans-serif">' +
        SB.esc(shown) + '</text>' : '');
  }

  /* 画面全体の SVG（エクスポート用・選択表示なし） */
  SB.screenToSvg = function (s) {
    var body = (s.nodes || []).map(drawNode).join('');
    body = body.replace(/<rect class="node-hit"[^>]*><\/rect>/g, '');
    return '<svg xmlns="' + NS + '" width="' + s.width + '" height="' + s.height + '" viewBox="0 0 ' + s.width + ' ' + s.height + '">' +
      '<rect width="' + s.width + '" height="' + s.height + '" fill="#ffffff"></rect>' +
      body + '</svg>';
  };

  function renderCanvas() {
    var s = scr();
    if (!ui.svg) return;
    if (!s) { ui.svg.innerHTML = ''; return; }

    ui.svg.setAttribute('width', s.width);
    ui.svg.setAttribute('height', s.height);
    ui.svg.setAttribute('viewBox', '0 0 ' + s.width + ' ' + s.height);
    ui.wrap.style.transform = 'scale(' + zoom + ')';
    ui.wrap.style.width = s.width + 'px';
    ui.wrap.style.height = s.height + 'px';
    ui.wrap.style.marginBottom = (s.height * (zoom - 1)) + 'px';

    var parts = [];

    // 背景グリッド
    if (snapOn) {
      parts.push('<defs><pattern id="gridPat" width="' + (GRID * 2) + '" height="' + (GRID * 2) +
        '" patternUnits="userSpaceOnUse"><path d="M ' + (GRID * 2) + ' 0 L 0 0 0 ' + (GRID * 2) +
        '" fill="none" stroke="#eef2f7" stroke-width="1"></path></pattern></defs>' +
        '<rect width="' + s.width + '" height="' + s.height + '" fill="url(#gridPat)"></rect>');
    }

    if (!s.nodes.length) {
      parts.push('<text x="' + (s.width / 2) + '" y="' + (s.height / 2) + '" text-anchor="middle" ' +
        'font-size="14" fill="#9aa5a2" font-family="system-ui, sans-serif">' +
        '左の部品をクリック、またはここへドラッグして配置します</text>');
    }

    parts.push(s.nodes.map(drawNode).join(''));

    // 選択表示
    var sel = selectedNodes();
    if (sel.length) {
      var hs = Math.max(5, 8 / zoom);
      sel.forEach(function (n) {
        parts.push('<rect class="sel-outline" x="' + (n.x - 1) + '" y="' + (n.y - 1) +
          '" width="' + (n.w + 2) + '" height="' + (n.h + 2) + '" vector-effect="non-scaling-stroke"></rect>');
      });
      if (sel.length === 1) {
        var n0 = sel[0];
        var dirs = [
          ['nw', n0.x, n0.y], ['n', n0.x + n0.w / 2, n0.y], ['ne', n0.x + n0.w, n0.y],
          ['e', n0.x + n0.w, n0.y + n0.h / 2], ['se', n0.x + n0.w, n0.y + n0.h],
          ['s', n0.x + n0.w / 2, n0.y + n0.h], ['sw', n0.x, n0.y + n0.h], ['w', n0.x, n0.y + n0.h / 2]
        ];
        dirs.forEach(function (d) {
          parts.push('<rect class="sel-handle" data-handle="' + d[0] + '" x="' + (d[1] - hs / 2) +
            '" y="' + (d[2] - hs / 2) + '" width="' + hs + '" height="' + hs + '" rx="1.5"></rect>');
        });
      }
    }

    if (drag && drag.mode === 'marquee' && drag.rect) {
      var r = drag.rect;
      parts.push('<rect class="marquee" x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '"></rect>');
    }

    ui.svg.innerHTML = parts.join('');
    if (ui.zoomLabel) ui.zoomLabel.textContent = Math.round(zoom * 100) + '%';
  }

  /* ---------- ポインタ操作 ---------- */

  function toCanvas(e) {
    var r = ui.svg.getBoundingClientRect();
    var s = scr();
    var sx = r.width / s.width, sy = r.height / s.height;
    return { x: (e.clientX - r.left) / sx, y: (e.clientY - r.top) / sy };
  }

  function onPointerDown(e) {
    var s = scr(); if (!s) return;
    if (e.button !== 0) return;
    var p = toCanvas(e);
    var handle = e.target.getAttribute && e.target.getAttribute('data-handle');
    var hitId = e.target.getAttribute && e.target.getAttribute('data-id');

    ui.svg.setPointerCapture(e.pointerId);

    if (handle && selection.length === 1) {
      var n = nodeById(selection[0]);
      pushUndo();
      drag = { mode: 'resize', dir: handle, start: p, orig: { x: n.x, y: n.y, w: n.w, h: n.h }, node: n, moved: false };
      return;
    }

    if (hitId) {
      if (e.shiftKey) {
        var i = selection.indexOf(hitId);
        if (i >= 0) selection.splice(i, 1); else selection.push(hitId);
      } else if (selection.indexOf(hitId) < 0) {
        selection = [hitId];
      }
      pushUndo();
      drag = {
        mode: 'move', start: p, moved: false,
        origs: selectedNodes().map(function (n) { return { n: n, x: n.x, y: n.y }; })
      };
      renderCanvas();
      renderInspector();
      return;
    }

    if (!e.shiftKey) selection = [];
    drag = { mode: 'marquee', start: p, rect: null, add: e.shiftKey, base: selection.slice() };
    renderCanvas();
    renderInspector();
  }

  function onPointerMove(e) {
    if (!drag) return;
    var s = scr(); if (!s) return;
    var p = toCanvas(e);
    var dx = p.x - drag.start.x, dy = p.y - drag.start.y;

    if (drag.mode === 'move') {
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) drag.moved = true;
      drag.origs.forEach(function (o) {
        o.n.x = Math.max(0, snap(o.x + dx));
        o.n.y = Math.max(0, snap(o.y + dy));
      });
      renderCanvas();
      return;
    }

    if (drag.mode === 'resize') {
      var o = drag.orig, n = drag.node, d = drag.dir;
      var x = o.x, y = o.y, w = o.w, hgt = o.h;
      if (d.indexOf('e') >= 0) w = Math.max(16, snap(o.w + dx));
      if (d.indexOf('s') >= 0) hgt = Math.max(16, snap(o.h + dy));
      if (d.indexOf('w') >= 0) { var nx = snap(o.x + dx); w = Math.max(16, o.x + o.w - nx); x = o.x + o.w - w; }
      if (d.indexOf('n') >= 0) { var ny = snap(o.y + dy); hgt = Math.max(16, o.y + o.h - ny); y = o.y + o.h - hgt; }
      n.x = Math.max(0, x); n.y = Math.max(0, y); n.w = w; n.h = hgt;
      drag.moved = true;
      renderCanvas();
      renderInspector();
      return;
    }

    if (drag.mode === 'marquee') {
      drag.rect = {
        x: Math.min(drag.start.x, p.x), y: Math.min(drag.start.y, p.y),
        w: Math.abs(dx), h: Math.abs(dy)
      };
      var r = drag.rect;
      var hits = s.nodes.filter(function (n) {
        return n.x < r.x + r.w && n.x + n.w > r.x && n.y < r.y + r.h && n.y + n.h > r.y;
      }).map(function (n) { return n.id; });
      selection = drag.add ? drag.base.concat(hits.filter(function (id) { return drag.base.indexOf(id) < 0; })) : hits;
      renderCanvas();
    }
  }

  function onPointerUp(e) {
    if (!drag) return;
    var wasMarquee = drag.mode === 'marquee';
    var moved = drag.moved;
    drag = null;
    try { ui.svg.releasePointerCapture(e.pointerId); } catch (err) {}
    if (moved) SB.touch();
    else if (!wasMarquee) {
      // 動かさなかった場合は undo スタックを戻す
      var st = stack();
      if (st.past.length) st.past.pop();
    }
    renderCanvas();
    renderInspector();
  }

  /* ---------- キーボード ---------- */

  function onKeyDown(e) {
    if (!mounted) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    var meta = e.ctrlKey || e.metaKey;

    if (meta && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (meta && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (meta && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected(); return; }
    if (meta && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      var s = scr(); if (s) { selection = s.nodes.map(function (n) { return n.id; }); renderCanvas(); renderInspector(); }
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); return; }
    if (e.key === 'Escape') { selection = []; renderCanvas(); renderInspector(); return; }

    var step = e.shiftKey ? GRID * 4 : GRID;
    var dx = 0, dy = 0;
    if (e.key === 'ArrowLeft') dx = -step;
    else if (e.key === 'ArrowRight') dx = step;
    else if (e.key === 'ArrowUp') dy = -step;
    else if (e.key === 'ArrowDown') dy = step;
    if (dx || dy) {
      if (!selection.length) return;
      e.preventDefault();
      pushUndo();
      selectedNodes().forEach(function (n) {
        n.x = Math.max(0, n.x + dx); n.y = Math.max(0, n.y + dy);
      });
      commit();
    }
  }

  /* ---------- パレット ---------- */

  function renderPalette() {
    var box = ui.palette;
    SB.clear(box);
    if (!SB.shapes) {
      box.appendChild(h('div', { class: 'insp-empty', text: '部品ライブラリを読み込めませんでした。' }));
      return;
    }
    var cats = SB.shapeCategories || ['レイアウト', 'ナビゲーション', '入力', '表示', '注釈'];
    var byCat = {};
    Object.keys(SB.shapes).forEach(function (k) {
      var d = SB.shapes[k];
      var c = d.category || 'その他';
      (byCat[c] = byCat[c] || []).push({ key: k, def: d });
    });
    cats.concat(Object.keys(byCat).filter(function (c) { return cats.indexOf(c) < 0; }))
      .forEach(function (c) {
        var items = byCat[c];
        if (!items || !items.length) return;
        var grid = h('div', { class: 'palette-grid' });
        items.forEach(function (it) {
          var b = h('button', {
            class: 'palette-btn', type: 'button', text: it.def.name || it.key,
            title: (it.def.name || it.key) + ' を追加（ドラッグでも配置できます）',
            draggable: 'true',
            onclick: function () { addNode(it.key); }
          });
          b.addEventListener('dragstart', function (ev) {
            ev.dataTransfer.setData('text/plain', it.key);
            ev.dataTransfer.effectAllowed = 'copy';
          });
          grid.appendChild(b);
        });
        box.appendChild(h('div', { class: 'palette-group' }, [h('h4', { text: c }), grid]));
      });
  }

  /* ---------- 画面タブ ---------- */

  function renderTabs() {
    var box = ui.tabs;
    SB.clear(box);
    screens().forEach(function (s, i) {
      box.appendChild(h('button', {
        class: 'screen-tab' + (i === current ? ' is-on' : ''), type: 'button',
        text: (s.name || '無題') + '  (' + (s.nodes ? s.nodes.length : 0) + ')',
        onclick: function () {
          current = i; selection = [];
          fitZoom();
          renderCanvas(); renderInspector(); renderTabs();
        }
      }));
    });
    box.appendChild(SB.btn('画面を追加', function () {
      var s = SB.newScreen('画面' + (screens().length + 1));
      screens().push(s);
      current = screens().length - 1;
      selection = [];
      fitZoom();
      commit();
    }, 'btn btn-sm', 'plus'));
  }

  /* ---------- ツールバー ---------- */

  function renderBar() {
    var box = ui.bar;
    SB.clear(box);
    if (!scr()) return;

    box.appendChild(SB.iconBtn('undo', '取り消し (Ctrl+Z)', undo));
    box.appendChild(SB.iconBtn('redo', 'やり直し (Ctrl+Shift+Z)', redo));
    box.appendChild(h('span', { class: 'sep' }));
    box.appendChild(SB.iconBtn('dup', '複製 (Ctrl+D)', duplicateSelected));
    box.appendChild(SB.iconBtn('trash', '削除 (Delete)', deleteSelected, 'btn-danger'));
    box.appendChild(h('span', { class: 'sep' }));
    box.appendChild(SB.iconBtn('front', '最前面へ', function () { reorder(true); }));
    box.appendChild(SB.iconBtn('back', '最背面へ', function () { reorder(false); }));
    box.appendChild(h('span', { class: 'sep' }));

    var gridBtn = SB.iconBtn('grid', 'グリッドに合わせる', function () {
      snapOn = !snapOn;
      gridBtn.style.color = snapOn ? 'var(--accent)' : '';
      renderCanvas();
    });
    gridBtn.style.color = snapOn ? 'var(--accent)' : '';
    box.appendChild(gridBtn);

    box.appendChild(SB.iconBtn('zoomOut', '縮小', function () { setZoom(zoom - 0.1); }));
    ui.zoomLabel = h('span', { class: 'zoom-label', text: '100%' });
    box.appendChild(ui.zoomLabel);
    box.appendChild(SB.iconBtn('zoomIn', '拡大', function () { setZoom(zoom + 0.1); }));
    box.appendChild(SB.btn('全体表示', function () { fitZoom(); renderCanvas(); }, 'btn btn-sm'));

    box.appendChild(h('span', { class: 'spacer' }));
    box.appendChild(SB.btn('SVG', function () { exportSvg(scr()); }, 'btn btn-sm', 'download'));
    box.appendChild(SB.btn('PNG', function () { exportPng(scr()); }, 'btn btn-sm', 'image'));
    box.appendChild(SB.btn('画面を削除', function () {
      SB.confirm('画面「' + (scr().name || '無題') + '」を削除します。よろしいですか。', function () {
        screens().splice(current, 1);
        current = Math.max(0, current - 1);
        selection = [];
        commit();
        renderBar();
      }, '削除する');
    }, 'btn btn-sm btn-danger'));
  }

  function setZoom(z) {
    zoom = Math.max(0.25, Math.min(2, Math.round(z * 100) / 100));
    renderCanvas();
  }

  function fitZoom() {
    var s = scr(); if (!s || !ui.stage) return;
    var avail = ui.stage.clientWidth - 60;
    var availH = ui.stage.clientHeight - 60;
    if (avail <= 0) return;
    zoom = Math.max(0.25, Math.min(1, Math.min(avail / s.width, availH / s.height)));
    zoom = Math.round(zoom * 100) / 100;
  }

  /* ---------- 書き出し ---------- */

  function exportSvg(s) {
    SB.downloadBlob(SB.screenToSvg(s), SB.safeFileName(s.name, 'screen') + '.svg', 'image/svg+xml;charset=utf-8');
  }

  SB.svgToPng = function (svgText, w, hgt, scale, cb) {
    var img = new Image();
    var blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    img.onload = function () {
      var c = document.createElement('canvas');
      c.width = w * scale; c.height = hgt * scale;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(function (b) { cb(b); }, 'image/png');
    };
    img.onerror = function () { URL.revokeObjectURL(url); cb(null); };
    img.src = url;
  };

  function exportPng(s) {
    SB.svgToPng(SB.screenToSvg(s), s.width, s.height, 2, function (blob) {
      if (!blob) { SB.toast('PNGの生成に失敗しました', true); return; }
      SB.downloadBlob(blob, SB.safeFileName(s.name, 'screen') + '.png');
    });
  }

  /* ---------- インスペクタ ---------- */

  function numField(label, value, onChange) {
    var inp = h('input', { type: 'number', step: '1' });
    inp.value = Math.round(value);
    inp.addEventListener('change', function () {
      var v = parseInt(inp.value, 10);
      if (isNaN(v)) return;
      pushUndo(); onChange(v); commit();
    });
    return h('div', { class: 'insp-field' }, [h('label', { text: label }), inp]);
  }

  function textField(label, value, placeholder, onChange, multiline, rows) {
    var inp = multiline
      ? h('textarea', { placeholder: placeholder || '', rows: rows || 3 })
      : h('input', { type: 'text', placeholder: placeholder || '' });
    inp.value = value || '';
    var timer = null;
    inp.addEventListener('input', function () {
      onChange(inp.value);
      renderCanvas();
      clearTimeout(timer);
      timer = setTimeout(function () { SB.touch(); }, 300);
    });
    return h('div', { class: 'insp-field' }, [h('label', { text: label }), inp]);
  }

  function propField(n, p) {
    var cur = n.props[p.key];
    if (p.type === 'boolean') {
      var cb = h('input', { type: 'checkbox' });
      cb.checked = !!cur;
      cb.addEventListener('change', function () { n.props[p.key] = cb.checked; SB.touch(); renderCanvas(); });
      return h('div', { class: 'insp-field' }, [
        h('label', { class: 'check', style: 'margin:0' }, [cb, h('span', { text: p.label })])
      ]);
    }
    if (p.type === 'select') {
      var sel = h('select');
      (p.options || []).forEach(function (o) {
        sel.appendChild(h('option', { value: o.value, text: o.label }));
      });
      sel.value = cur !== undefined && cur !== null ? cur : (p.options && p.options[0] ? p.options[0].value : '');
      sel.addEventListener('change', function () { n.props[p.key] = sel.value; SB.touch(); renderCanvas(); });
      return h('div', { class: 'insp-field' }, [h('label', { text: p.label }), sel]);
    }
    if (p.type === 'number') {
      var num = h('input', { type: 'number', min: p.min, max: p.max });
      num.value = cur !== undefined && cur !== null ? cur : '';
      num.addEventListener('input', function () {
        var v = parseFloat(num.value);
        n.props[p.key] = isNaN(v) ? undefined : v;
        renderCanvas(); SB.touch();
      });
      return h('div', { class: 'insp-field' }, [h('label', { text: p.label }), num]);
    }
    if (p.type === 'textarea') {
      return textField(p.label, cur, p.placeholder || '1行に1件', function (v) { n.props[p.key] = v; }, true, 4);
    }
    return textField(p.label, cur, p.placeholder || '', function (v) { n.props[p.key] = v; });
  }

  function renderInspector() {
    var box = ui.insp;
    SB.clear(box);
    var s = scr();
    if (!s) {
      box.appendChild(h('div', { class: 'insp-empty', text: '画面がありません。上部の「画面を追加」から作成してください。' }));
      return;
    }

    var sel = selectedNodes();

    if (!sel.length) {
      // 画面そのものの設定
      box.appendChild(h('div', { class: 'insp-group' }, [
        h('h4', { text: 'この画面' }),
        textField('画面名', s.name, '例: 備品一覧', function (v) { s.name = v; renderTabs(); }),
        textField('画面のパス・遷移条件', s.route, '例: /items', function (v) { s.route = v; }),
        (function () {
          var sel2 = h('select');
          SB.DEVICES.forEach(function (d) { sel2.appendChild(h('option', { value: d.value, text: d.label })); });
          sel2.value = s.device;
          sel2.addEventListener('change', function () {
            pushUndo();
            s.device = sel2.value;
            var d = SB.DEVICES.filter(function (x) { return x.value === s.device; })[0];
            if (d) { s.width = d.width; s.height = d.height; }
            fitZoom(); commit();
          });
          return h('div', { class: 'insp-field' }, [h('label', { text: '画面サイズ' }), sel2]);
        })(),
        h('div', { class: 'insp-row' }, [
          numField('幅', s.width, function (v) { s.width = Math.max(200, v); }),
          numField('高さ', s.height, function (v) { s.height = Math.max(200, v); })
        ]),
        textField('この画面の説明（AIへの補足）', s.description,
          '例: ログイン後の最初の画面。件数が多いので検索とページングが要る。',
          function (v) { s.description = v; }, true, 4)
      ]));
      box.appendChild(h('div', { class: 'insp-empty', text: '部品を選ぶと、ここでラベルや注釈を編集できます。' }));
      return;
    }

    if (sel.length > 1) {
      box.appendChild(h('div', { class: 'insp-group' }, [
        h('h4', { text: sel.length + '個を選択中' }),
        h('div', { class: 'chips' }, [
          SB.btn('左揃え', function () { alignSelected('left'); }, 'btn btn-sm'),
          SB.btn('左右中央', function () { alignSelected('centerX'); }, 'btn btn-sm'),
          SB.btn('右揃え', function () { alignSelected('right'); }, 'btn btn-sm'),
          SB.btn('上揃え', function () { alignSelected('top'); }, 'btn btn-sm'),
          SB.btn('上下中央', function () { alignSelected('centerY'); }, 'btn btn-sm'),
          SB.btn('下揃え', function () { alignSelected('bottom'); }, 'btn btn-sm')
        ]),
        h('div', { class: 'row-actions' }, [
          SB.btn('複製', duplicateSelected, 'btn btn-sm', 'dup'),
          SB.btn('削除', deleteSelected, 'btn btn-sm btn-danger', 'trash')
        ])
      ]));
      return;
    }

    var n = sel[0];
    var def = shapeDef(n.type) || { name: n.type, props: [] };

    box.appendChild(h('div', { class: 'insp-group' }, [
      h('span', { class: 'type-badge', text: def.name || n.type })
    ]));

    box.appendChild(h('div', { class: 'insp-group' }, [
      h('h4', { text: '内容' }),
      textField('表示テキスト', n.label, '部品に表示する文字',
        function (v) { n.label = v; }, ['text', 'note', 'heading'].indexOf(n.type) >= 0, 3),
      textField('AIへの注釈', n.note,
        '例: ここは管理者にだけ表示する。押すと確認ダイアログを出す。',
        function (v) { n.note = v; }, true, 4)
    ]));

    if (def.props && def.props.length) {
      var pg = h('div', { class: 'insp-group' }, [h('h4', { text: '設定' })]);
      def.props.forEach(function (p) { pg.appendChild(propField(n, p)); });
      box.appendChild(pg);
    }

    if (screens().length > 1) {
      var linkSel = h('select');
      linkSel.appendChild(h('option', { value: '', text: '（なし）' }));
      screens().forEach(function (t2) {
        if (t2.id === s.id) return;
        linkSel.appendChild(h('option', { value: t2.id, text: t2.name || '無題' }));
      });
      linkSel.value = n.link || '';
      linkSel.addEventListener('change', function () { n.link = linkSel.value; SB.touch(); });
      box.appendChild(h('div', { class: 'insp-group' }, [
        h('h4', { text: '操作したときの遷移先' }),
        h('div', { class: 'insp-field' }, [linkSel])
      ]));
    }

    box.appendChild(h('div', { class: 'insp-group' }, [
      h('h4', { text: '位置とサイズ' }),
      h('div', { class: 'insp-row' }, [
        numField('X', n.x, function (v) { n.x = Math.max(0, v); }),
        numField('Y', n.y, function (v) { n.y = Math.max(0, v); })
      ]),
      h('div', { class: 'insp-row' }, [
        numField('幅', n.w, function (v) { n.w = Math.max(16, v); }),
        numField('高さ', n.h, function (v) { n.h = Math.max(16, v); })
      ])
    ]));

    box.appendChild(h('div', { class: 'row-actions' }, [
      SB.btn('複製', duplicateSelected, 'btn btn-sm', 'dup'),
      SB.btn('削除', deleteSelected, 'btn btn-sm btn-danger', 'trash')
    ]));
  }

  /* ---------- マウント ---------- */

  SB.views.screens = function (root) {
    if (!screens().length) {
      screens().push(SB.newScreen('画面1'));
      SB.save();
    }
    if (current >= screens().length) current = 0;
    selection = [];

    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('id', 'canvas');

    ui.wrap = h('div', { class: 'canvas-wrap' });
    ui.wrap.appendChild(svg);
    ui.svg = svg;
    ui.stage = h('div', { class: 'stage-scroll' }, [ui.wrap]);
    ui.tabs = h('div', { class: 'screen-tabs' });
    ui.bar = h('div', { class: 'stage-bar' });
    ui.palette = h('div', { class: 'col-scroll' });
    ui.insp = h('div', { class: 'col-scroll' });

    var editor = h('div', { class: 'editor' }, [
      h('div', { class: 'editor-col palette' }, [
        h('div', { class: 'col-head' }, [h('span', { text: '部品' })]),
        ui.palette
      ]),
      h('div', { class: 'editor-col stage' }, [ui.tabs, ui.bar, ui.stage]),
      h('div', { class: 'editor-col inspector' }, [
        h('div', { class: 'col-head' }, [h('span', { text: 'プロパティ' })]),
        ui.insp
      ])
    ]);
    root.appendChild(editor);

    svg.addEventListener('pointerdown', onPointerDown);
    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerup', onPointerUp);
    svg.addEventListener('pointercancel', onPointerUp);
    svg.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    ui.stage.addEventListener('dragover', function (e) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    ui.stage.addEventListener('drop', function (e) {
      e.preventDefault();
      var type = e.dataTransfer.getData('text/plain');
      if (!type || !shapeDef(type)) return;
      var p = toCanvas(e);
      addNode(type, p.x, p.y);
    });

    mounted = true;
    renderPalette();
    renderTabs();
    renderBar();
    fitZoom();
    renderCanvas();
    renderInspector();
  };

  SB.views.screensUnmount = function () { mounted = false; };

  document.addEventListener('keydown', onKeyDown);

})(window.SB);
