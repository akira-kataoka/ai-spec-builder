/* ブラウザ上で動く回帰テスト。run-tests.html を開くと自動実行される。
   headless Chrome の --dump-dom で結果を取り出せる。 */

(function () {
  'use strict';

  var out = [];
  var pass = 0, fail = 0;

  function log(s) { out.push(s); }
  function group(s) { log(''); log('== ' + s + ' =='); }

  function ok(name, cond, detail) {
    if (cond) { pass++; log('PASS  ' + name); }
    else { fail++; log('FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
  }

  function eq(name, actual, expected) {
    ok(name, actual === expected, 'actual=' + JSON.stringify(actual) + ' expected=' + JSON.stringify(expected));
  }

  function noThrow(name, fn) {
    try { fn(); ok(name, true); }
    catch (e) { ok(name, false, e && e.message); }
  }

  /* ---------- 補助 ---------- */

  var SB = window.SB;

  function svg() { return document.getElementById('canvas'); }
  function scr() { return SB.doc.screens[0]; }

  function scale() {
    var r = svg().getBoundingClientRect();
    return r.width / scr().width;
  }

  function clientPos(cx, cy) {
    var r = svg().getBoundingClientRect();
    var k = r.width / scr().width;
    return { clientX: r.left + cx * k, clientY: r.top + cy * k };
  }

  function fire(target, type, cx, cy, opts) {
    var p = clientPos(cx, cy);
    var init = {
      bubbles: true, cancelable: true, composed: true,
      pointerId: 1, pointerType: 'mouse', isPrimary: true,
      button: 0, buttons: type === 'pointerup' ? 0 : 1,
      clientX: p.clientX, clientY: p.clientY
    };
    if (opts) for (var k in opts) init[k] = opts[k];
    var ev;
    try { ev = new PointerEvent(type, init); }
    catch (e) { ev = new MouseEvent(type.replace('pointer', 'mouse'), init); }
    target.dispatchEvent(ev);
  }

  function hitOf(id) {
    var list = svg().querySelectorAll('.node-hit');
    for (var i = 0; i < list.length; i++) {
      if (list[i].getAttribute('data-id') === id) return list[i];
    }
    return null;
  }

  function key(k, opts) {
    var init = { key: k, bubbles: true, cancelable: true };
    if (opts) for (var x in opts) init[x] = opts[x];
    document.dispatchEvent(new KeyboardEvent('keydown', init));
  }

  function findByText(root, text, tag) {
    var list = root.querySelectorAll(tag || 'button');
    for (var i = 0; i < list.length; i++) {
      if ((list[i].textContent || '').indexOf(text) >= 0) return list[i];
    }
    return null;
  }

  function renderRefresh() { SB.go('screens'); }

  function addPart(type) {
    var before = scr().nodes.length;
    var btns = document.querySelectorAll('.palette-btn');
    var name = SB.shapes[type].name;
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].textContent === name) { btns[i].click(); break; }
    }
    return scr().nodes.length === before + 1 ? scr().nodes[scr().nodes.length - 1] : null;
  }

  /* ---------- 実行 ---------- */

  function run() {
    try { localStorage.clear(); } catch (e) {}
    SB.reset();

    /* ===== 1. 基盤 ===== */
    group('1. 基盤API');
    ok('SB が存在する', !!SB);
    ['h', 'esc', 'icon', 'field', 'lineList', 'toast', 'openModal', 'copyText',
     'downloadBlob', 'buildMarkdown', 'screenToSvg', 'svgToPng', 'go', 'touch'].forEach(function (k) {
      ok('SB.' + k + ' が関数', typeof SB[k] === 'function');
    });
    ok('部品が30種以上ある', Object.keys(SB.shapes).length >= 30, String(Object.keys(SB.shapes).length));
    ok('カテゴリが定義されている', Array.isArray(SB.shapeCategories) && SB.shapeCategories.length > 0);

    var unknownCat = Object.keys(SB.shapes).filter(function (k) {
      return SB.shapeCategories.indexOf(SB.shapes[k].category) < 0;
    });
    ok('全部品が既知のカテゴリに属する', unknownCat.length === 0, unknownCat.join(','));

    var badDef = Object.keys(SB.shapes).filter(function (k) {
      var d = SB.shapes[k];
      return !d.name || !d.w || !d.h || typeof d.draw !== 'function' || typeof d.describe !== 'function';
    });
    ok('全部品の定義が揃っている', badDef.length === 0, badDef.join(','));

    /* ===== 2. エスケープ ===== */
    group('2. エスケープ');
    eq('SB.esc がタグを潰す', SB.esc('<b>&"\'</b>'), '&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;');

    var rawSvg = Object.keys(SB.shapes).filter(function (k) {
      var n = { id: 'x', type: k, x: 0, y: 0, w: SB.shapes[k].w, h: SB.shapes[k].h,
                label: '<script>alert(1)</script>', note: '', props: {} };
      var s;
      try { s = SB.shapes[k].draw(n); } catch (e) { return true; }
      return /<script/i.test(s);
    });
    ok('どの部品も生の <script> を出力しない', rawSvg.length === 0, rawSvg.join(','));

    /* ===== 3. state ===== */
    group('3. 状態と復元');
    noThrow('壊れたJSON(配列でない)を読んでも落ちない', function () {
      SB.replaceDoc({ features: 'これは配列ではない', screens: 42, purpose: { goals: 'x' } });
    });
    ok('features が配列に補正される', Array.isArray(SB.doc.features));
    ok('screens が配列に補正される', Array.isArray(SB.doc.screens));
    ok('purpose.goals が配列に補正される', Array.isArray(SB.doc.purpose.goals));

    noThrow('要素にキーが欠けたJSONを読んでも落ちない', function () {
      SB.replaceDoc({
        features: [{ name: 'A' }],
        data: [{ name: 'B' }],
        flows: [{ name: 'C' }],
        api: { endpoints: [{ path: '/x' }] },
        screens: [{ name: 'S' }]
      });
    });
    ok('feature.acceptance が補完される', Array.isArray(SB.doc.features[0].acceptance));
    ok('entity.fields が補完される', Array.isArray(SB.doc.data[0].fields));
    ok('flow.steps が補完される', Array.isArray(SB.doc.flows[0].steps));
    ok('endpoint.method が補完される', !!SB.doc.api.endpoints[0].method);
    ok('screen.nodes が補完される', Array.isArray(SB.doc.screens[0].nodes));
    ok('screen.width が補完される', typeof SB.doc.screens[0].width === 'number');

    /* ===== 4. 全セクション描画 ===== */
    group('4. 全セクションの描画');
    SB.reset();
    SB.SECTIONS.forEach(function (sec) {
      noThrow('セクション「' + sec.label + '」が描画できる', function () {
        SB.go(sec.key);
        var ws = document.getElementById('workspace');
        if (!ws.firstChild) throw new Error('空');
      });
    });

    // 入力済みデータでも全セクションを描画
    SB.doc.features.push(SB.newFeature());
    SB.doc.data.push(SB.newEntity());
    SB.doc.data[0].fields.push(SB.newField());
    SB.doc.flows.push(SB.newFlow());
    SB.doc.api.endpoints.push(SB.newEndpoint());
    SB.SECTIONS.forEach(function (sec) {
      noThrow('データ有りで「' + sec.label + '」が描画できる', function () { SB.go(sec.key); });
    });

    /* ===== 5. 画面設計エディタ ===== */
    group('5. 画面設計エディタ');
    SB.reset();
    SB.go('screens');

    ok('画面が1つ自動生成される', SB.doc.screens.length === 1);
    ok('キャンバスが存在する', !!svg());
    eq('パレットのボタン数が部品数と一致', document.querySelectorAll('.palette-btn').length, Object.keys(SB.shapes).length);

    var btn = addPart('button');
    ok('パレットのクリックで部品が追加される', !!btn);
    ok('追加した部品が選択状態になる', !!svg().querySelector('.sel-outline'));
    ok('リサイズハンドルが8個出る', svg().querySelectorAll('.sel-handle').length === 8,
       String(svg().querySelectorAll('.sel-handle').length));

    // ドラッグ移動
    var x0 = btn.x, y0 = btn.y;
    var cx = btn.x + btn.w / 2, cy = btn.y + btn.h / 2;
    fire(hitOf(btn.id), 'pointerdown', cx, cy);
    fire(svg(), 'pointermove', cx + 64, cy + 32);
    fire(svg(), 'pointerup', cx + 64, cy + 32);
    ok('ドラッグで移動する', btn.x === x0 + 64 && btn.y === y0 + 32,
       'x:' + x0 + '->' + btn.x + ' y:' + y0 + '->' + btn.y);

    // 取り消し / やり直し
    key('z', { ctrlKey: true });
    ok('Ctrl+Z で移動が取り消される', SB.doc.screens[0].nodes[0].x === x0,
       String(SB.doc.screens[0].nodes[0].x));
    key('z', { ctrlKey: true, shiftKey: true });
    ok('Ctrl+Shift+Z でやり直せる', SB.doc.screens[0].nodes[0].x === x0 + 64,
       String(SB.doc.screens[0].nodes[0].x));

    // クリックしただけでは undo 履歴を汚さない
    var node0 = SB.doc.screens[0].nodes[0];
    var beforeX = node0.x;
    fire(hitOf(node0.id), 'pointerdown', node0.x + 5, node0.y + 5);
    fire(svg(), 'pointerup', node0.x + 5, node0.y + 5);
    key('z', { ctrlKey: true });
    ok('クリックのみでは undo 履歴が増えない', SB.doc.screens[0].nodes[0].x === x0,
       'x=' + SB.doc.screens[0].nodes[0].x + ' (beforeX=' + beforeX + ')');
    key('z', { ctrlKey: true, shiftKey: true });

    // リサイズ
    var n1 = SB.doc.screens[0].nodes[0];
    var w0 = n1.w;
    fire(hitOf(n1.id), 'pointerdown', n1.x + 4, n1.y + 4);   // 選択し直す
    fire(svg(), 'pointerup', n1.x + 4, n1.y + 4);
    var handle = svg().querySelector('[data-handle="se"]');
    ok('SEハンドルが取得できる', !!handle);
    if (handle) {
      fire(handle, 'pointerdown', n1.x + n1.w, n1.y + n1.h);
      fire(svg(), 'pointermove', n1.x + n1.w + 40, n1.y + n1.h + 24);
      fire(svg(), 'pointerup', n1.x + n1.w + 40, n1.y + n1.h + 24);
      ok('SEハンドルで拡大できる', n1.w === w0 + 40, 'w:' + w0 + '->' + n1.w);
    }

    // 複製と削除
    var nSel = SB.doc.screens[0].nodes[0];
    fire(hitOf(nSel.id), 'pointerdown', nSel.x + 4, nSel.y + 4);
    fire(svg(), 'pointerup', nSel.x + 4, nSel.y + 4);
    var cnt = SB.doc.screens[0].nodes.length;
    key('d', { ctrlKey: true });
    eq('Ctrl+D で複製される', SB.doc.screens[0].nodes.length, cnt + 1);
    key('Delete');
    eq('Delete で削除される', SB.doc.screens[0].nodes.length, cnt);

    // コピーと貼り付け
    var nCopy = SB.doc.screens[0].nodes[0];
    fire(hitOf(nCopy.id), 'pointerdown', nCopy.x + 4, nCopy.y + 4);
    fire(svg(), 'pointerup', nCopy.x + 4, nCopy.y + 4);
    key('c', { ctrlKey: true });
    key('v', { ctrlKey: true });
    eq('Ctrl+C / Ctrl+V で貼り付けられる', SB.doc.screens[0].nodes.length, cnt + 1);
    key('Delete');

    // クリックでは座標が動かない（スナップの巻き添えを防げているか）
    var nClick = SB.doc.screens[0].nodes[0];
    nClick.x = 13; nClick.y = 21;
    renderRefresh();
    fire(hitOf(nClick.id), 'pointerdown', nClick.x + 3, nClick.y + 3);
    fire(svg(), 'pointermove', nClick.x + 4, nClick.y + 3);
    fire(svg(), 'pointerup', nClick.x + 4, nClick.y + 3);
    ok('クリックしただけでは座標が変わらない', nClick.x === 13 && nClick.y === 21,
       'x=' + nClick.x + ' y=' + nClick.y);

    // 矢印キー移動
    var n2 = SB.doc.screens[0].nodes[0];
    // まず選択する
    fire(hitOf(n2.id), 'pointerdown', n2.x + 4, n2.y + 4);
    fire(svg(), 'pointerup', n2.x + 4, n2.y + 4);
    var ax = n2.x;
    key('ArrowRight');
    ok('矢印キーで移動する', n2.x === ax + 8, 'x:' + ax + '->' + n2.x);

    // 範囲選択
    addPart('input');
    addPart('table');
    var all = SB.doc.screens[0].nodes;
    all.forEach(function (n, i) { n.x = 16; n.y = 16 + i * 8; n.w = 40; n.h = 8; });
    fire(svg(), 'pointerdown', 0, 0);
    fire(svg(), 'pointermove', scr().width - 1, scr().height - 1);
    fire(svg(), 'pointerup', scr().width - 1, scr().height - 1);
    eq('範囲選択で全ノードが選ばれる', svg().querySelectorAll('.sel-outline').length, all.length);

    // 整列
    var alignBtn = findByText(document.querySelector('.inspector'), '左揃え');
    ok('複数選択時に整列ボタンが出る', !!alignBtn);
    if (alignBtn) {
      all[0].x = 10; all[1].x = 100;
      alignBtn.click();
      ok('左揃えが効く', all[0].x === all[1].x, all[0].x + ' vs ' + all[1].x);
    }

    // 画面の追加と削除
    var addScreen = findByText(document.querySelector('.screen-tabs'), '画面を追加');
    ok('「画面を追加」ボタンがある', !!addScreen);
    if (addScreen) {
      addScreen.click();
      eq('画面が増える', SB.doc.screens.length, 2);
      var delBtn = findByText(document.querySelector('.inspector'), '削除');
      ok('画面削除ボタンがある', !!delBtn);
      if (delBtn) {
        delBtn.click();
        var confirmBtn = document.querySelector('#modalFoot .btn-primary');
        ok('確認モーダルが出る', !!confirmBtn && !document.getElementById('modalRoot').hidden);
        if (confirmBtn) confirmBtn.click();
        eq('画面が削除される', SB.doc.screens.length, 1);
      }
    }

    /* ===== 6. 書き出し ===== */
    group('6. 書き出し');
    var out1 = SB.screenToSvg(SB.doc.screens[0]);
    ok('SVGに当たり判定の矩形が含まれない', out1.indexOf('node-hit') < 0);
    ok('SVGに編集用グリッドが含まれない', out1.indexOf('gridPat') < 0);
    ok('SVGが svg タグで始まる', out1.indexOf('<svg') === 0);
    ok('SVGの開閉タグが整合する',
      (out1.match(/<(?!\/)[a-zA-Z]/g) || []).length ===
      (out1.match(/<\/[a-zA-Z]/g) || []).length + (out1.match(/\/>/g) || []).length);

    // XSS: 実際に DOM に流し込んで script が生えないこと
    SB.doc.screens[0].nodes[0].label = '</text><script>window.__xss=1;<\/script>';
    SB.doc.screens[0].nodes[0].note = '"><img src=x onerror="window.__xss=2">';
    SB.go('output'); SB.go('screens');
    ok('キャンバスに script 要素が生成されない', !svg().querySelector('script'));
    ok('キャンバスに img 要素が生成されない', !svg().querySelector('img'));
    ok('XSSが実行されていない', !window.__xss, String(window.__xss));

    /* ===== 7. Markdown ===== */
    group('7. Markdown 生成');
    SB.reset();
    SB.doc.basic.projectName = 'テスト案件';
    SB.doc.basic.summary = '概要です';
    SB.doc.features.push(SB.newFeature());
    SB.doc.features[0].name = '機能A';
    SB.doc.features[0].acceptance = ['条件1'];

    var md = SB.buildMarkdown();
    ok('タイトルが入る', md.indexOf('# 開発依頼書: テスト案件') >= 0);
    ok('概要セクションがある', md.indexOf('## 1. 概要') >= 0);
    ok('機能要件セクションがある', md.indexOf('## 4. 機能要件') >= 0);
    ok('受け入れ条件がチェックボックスになる', md.indexOf('- [ ] 条件1') >= 0);

    noThrow('空のドキュメントでも生成できる', function () {
      var keep = SB.doc;
      SB.doc = SB.defaultDoc();
      var m = SB.buildMarkdown();
      if (typeof m !== 'string' || !m.length) throw new Error('空文字');
      SB.doc = keep;
    });

    // 表を壊す文字（全部品で検証）
    SB.doc = SB.defaultDoc();
    var sc = SB.newScreen('表テスト');
    Object.keys(SB.shapes).forEach(function (k, i) {
      var d = SB.shapes[k];
      var props = {};
      (d.props || []).forEach(function (p) {
        if (p.type === 'textarea') props[p.key] = '行1|行2\n行3';
        else if (p.type === 'text') props[p.key] = 'a|b\nc';
      });
      sc.nodes.push({
        id: 'n' + i, type: k, x: 0, y: i * 4, w: d.w, h: d.h,
        label: 'ラベル|パイプ\n改行あり', note: '注釈|パイプ\n改行', link: '', props: props
      });
    });
    SB.doc.screens = [sc];
    var md2 = SB.buildMarkdown();

    var lines = md2.split('\n');
    var head = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf('| # | 部品 |') === 0) { head = i; break; }
    }
    ok('座標一覧の表が生成される', head >= 0);
    if (head >= 0) {
      var rows = 0, j = head + 2;
      while (j < lines.length && lines[j].charAt(0) === '|') { rows++; j++; }
      var expectRows = sc.nodes.filter(function (n) {
        return SB.shapes[n.type].category !== '注釈';
      }).length;
      eq('表の行数が部品数と一致する（改行で崩れない）', rows, expectRows);

      var badCols = [];
      for (var r = head + 2; r < head + 2 + rows; r++) {
        // 「\|」を除いた実際の区切り数が 4列ぶん（先頭と末尾の | を含めて5）
        var cols = lines[r].replace(/\\\|/g, '').split('|').length;
        if (cols !== 6) badCols.push(r - head - 1);
      }
      ok('全行の列数が揃っている（パイプがエスケープされる）', badCols.length === 0, '行' + badCols.join(','));
    }

    // レイアウト側の行も改行で崩れないこと
    var layoutBad = md2.split('\n').filter(function (l) {
      return /^\s*- \*\*\d+\.\*\* /.test(l) && l.indexOf('\n') >= 0;
    });
    ok('レイアウト行が1行に収まる', layoutBad.length === 0);

    /* ===== 8. キーボードの誤爆 ===== */
    group('8. 画面設計以外でのキー誤爆');
    SB.reset();
    SB.go('screens');
    addPart('button');
    addPart('input');
    var beforeN = SB.doc.screens[0].nodes.length;
    SB.go('basic');
    key('Delete');
    key('z', { ctrlKey: true });
    key('ArrowRight');
    eq('他セクションでのDeleteでノードが消えない', SB.doc.screens[0].nodes.length, beforeN);

    /* ===== 9. モーダル表示中のキー誤爆 ===== */
    group('9. モーダル表示中のキー誤爆');
    SB.go('screens');
    var n3 = SB.doc.screens[0].nodes[0];
    fire(hitOf(n3.id), 'pointerdown', n3.x + 4, n3.y + 4);
    fire(svg(), 'pointerup', n3.x + 4, n3.y + 4);
    var cnt2 = SB.doc.screens[0].nodes.length;
    SB.confirm('テスト', function () {});
    key('Delete');
    eq('モーダル表示中はDeleteが効かない', SB.doc.screens[0].nodes.length, cnt2);
    SB.closeModal();

    /* ===== 10. 進捗率 ===== */
    group('10. 進捗率');
    SB.reset();
    eq('未入力なら0%', SB.completion(), 0);
    SB.doc.basic.projectName = 'x';
    SB.doc.basic.summary = 'y';
    ok('入力すると増える', SB.completion() > 0, String(SB.completion()));

    /* ===== 11. テンプレートとサンプル ===== */
    group('11. テンプレートとサンプル');
    SB.reset();
    ok('テンプレートが4種類ある', SB.TEMPLATES.length === 4, String(SB.TEMPLATES.length));
    SB.TEMPLATES.forEach(function (t) {
      SB.reset();
      noThrow('雛形「' + t.name + '」を適用できる', function () {
        if (!SB.applyTemplate(t.id)) throw new Error('適用失敗');
        if (!SB.doc.basic.kind) throw new Error('種類が入らない');
        SB.buildMarkdown();
      });
    });

    SB.reset();
    var sample = SB.buildSampleDoc();
    noThrow('サンプルを読み込める', function () { SB.replaceDoc(sample); });
    ok('サンプルに画面が2つある', SB.doc.screens.length === 2, String(SB.doc.screens.length));
    ok('サンプルの機能が4件', SB.doc.features.length === 4, String(SB.doc.features.length));
    noThrow('サンプルで全セクションが描画できる', function () {
      SB.SECTIONS.forEach(function (sec) { SB.go(sec.key); });
    });

    /* ===== 12. 画面設計の構造化出力 ===== */
    group('12. 画面設計の構造化出力');
    var smd = SB.buildMarkdown();
    ok('レイアウトの見出しが出る', smd.indexOf('**レイアウト**') >= 0);
    ok('入れ子が字下げで表現される', /\n  - \*\*\d+\.\*\* /.test(smd));
    ok('オーバーレイが分離される', smd.indexOf('オーバーレイ（初期状態では表示しない') >= 0);
    ok('注釈が部品に紐づく', /\*\* について: /.test(smd));
    ok('注釈メモが配置一覧に混ざらない', smd.indexOf('- **9.** 注釈メモ') < 0);
    ok('画面遷移が出る', smd.indexOf('**画面遷移**') >= 0);
    ok('機能と画面が対応づく', smd.indexOf('関連する画面:') >= 0);
    ok('役割の指示が先頭に付く', smd.indexOf('あなたはこのプロジェクトの実装担当エンジニアです') >= 0);
    ok('確認事項が生成される', smd.indexOf('## 実装前に確認してほしいこと') >= 0);
    ok('優先度の定義が入る', smd.indexOf('優先度の意味') >= 0);

    // モーダルの中身が本体レイアウトに出ていないこと
    var layoutPart = smd.slice(smd.indexOf('### 2. 貸出申請'));
    layoutPart = layoutPart.slice(0, layoutPart.indexOf('## 6.') > 0 ? layoutPart.indexOf('## 6.') : layoutPart.length);
    var overlayAt = layoutPart.indexOf('**オーバーレイ');
    var beforeOverlay = overlayAt > 0 ? layoutPart.slice(0, overlayAt) : layoutPart;
    ok('モーダル内のチェックボックスが本体レイアウトに出ない',
       beforeOverlay.indexOf('申請内容をメールで受け取る') < 0);
    ok('カードの中の入力欄が字下げされる', /\n {2,}- \*\*\d+\.\*\* セレクトボックス/.test(layoutPart));

    // 出力オプションが効く
    SB.doc.options.roleHeader = false;
    SB.doc.options.coords = false;
    var md3 = SB.buildMarkdown();
    ok('役割指示を外せる', md3.indexOf('あなたはこのプロジェクトの実装担当エンジニアです') < 0);
    ok('座標一覧を外せる', md3.indexOf('<details>') < 0);
    SB.doc.options.roleHeader = true;
    SB.doc.options.coords = true;

    /* ===== 13. 保存とバックアップ ===== */
    group('13. 保存とバックアップ');
    SB.reset();
    SB.doc.basic.projectName = 'バックアップ前';
    SB.save(true);
    SB.replaceDoc(SB.defaultDoc());
    ok('置き換えでバックアップが作られる', SB.hasBackup());
    ok('置き換え後は空になる', SB.doc.basic.projectName === '');
    ok('バックアップから戻せる', SB.restoreBackup() && SB.doc.basic.projectName === 'バックアップ前',
       SB.doc.basic.projectName);
    ok('戻したあとバックアップは消える', !SB.hasBackup());

    SB.doc.basic.projectName = '未保存';
    SB.save();                     // デバウンス中
    ok('保存待ちのあいだ dirty が立つ', SB.dirty === true);
    SB.flush();
    ok('flush で保存される', SB.dirty === false);

    /* ===== 14. 壊れた入力への耐性 ===== */
    group('14. 壊れた入力への耐性');
    var evil = {
      basic: { projectName: 'x' },
      screens: [{
        id: 's-evil', name: 'evil', width: '0"><script>window.__inj=1;</script><g x="0',
        nodes: [
          { type: 'button', x: '0"><image href=x onerror="window.__inj=2">', y: 0, w: 100, h: 40, label: 'a' },
          { type: '存在しない部品', x: 0, y: 0, w: 10, h: 10 },
          null
        ]
      }]
    };
    noThrow('細工したJSONを読み込んでも落ちない', function () { SB.replaceDoc(evil); });
    ok('未知の部品は捨てられる', SB.doc.screens[0].nodes.every(function (n) { return !!SB.shapes[n.type]; }));
    ok('座標が数値に矯正される', typeof SB.doc.screens[0].nodes[0].x === 'number');
    ok('画面サイズが数値に矯正される', typeof SB.doc.screens[0].width === 'number');
    SB.go('screens');
    ok('細工した値でも script が生成されない', !svg().querySelector('script'));
    ok('細工した値でも image が生成されない', !svg().querySelector('image'));
    ok('インジェクションが実行されていない', !window.__inj, String(window.__inj));
    var evilSvg = SB.screenToSvg(SB.doc.screens[0]);
    ok('書き出しSVGにも onerror が残らない', evilSvg.indexOf('onerror') < 0);

    /* ---------- 結果 ---------- */
    log('');
    log('================================');
    log('RESULT  pass=' + pass + '  fail=' + fail);
    log('================================');

    var el = document.getElementById('results');
    el.textContent = out.join('\n');
    document.title = (fail === 0 ? 'ALL PASS' : 'FAIL x' + fail) + ' (' + pass + ' passed)';
  }

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      try { run(); }
      catch (e) {
        var el = document.getElementById('results');
        el.textContent = out.join('\n') + '\n\nEXCEPTION: ' + (e && e.stack || e);
        document.title = 'EXCEPTION';
      }
    }, 30);
  });

})();
