/* 指示書（Markdown）の生成 */

window.SB = window.SB || {};

(function (SB) {
  'use strict';

  SB.views = SB.views || {};

  function has(v) {
    if (v === null || v === undefined) return false;
    if (Array.isArray(v)) return v.length > 0;
    return String(v).trim() !== '';
  }

  function bullets(out, arr, prefix) {
    arr.filter(has).forEach(function (v) { out.push((prefix || '- ') + String(v).trim()); });
  }

  function kv(out, label, value) {
    if (!has(value)) return;
    var v = String(value).trim();
    if (v.indexOf('\n') >= 0) {
      out.push('- **' + label + '**:');
      v.split('\n').forEach(function (l) { if (l.trim()) out.push('  - ' + l.trim()); });
    } else {
      out.push('- **' + label + '**: ' + v);
    }
  }

  function block(out, title, value) {
    if (!has(value)) return;
    out.push('**' + title + '**');
    out.push('');
    String(value).trim().split('\n').forEach(function (l) { out.push(l); });
    out.push('');
  }

  // 表の中に入れるため、改行と余分な空白を潰す
  function flatten(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/\s*[\r\n]+\s*/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function cell(s) { return flatten(s).replace(/\|/g, '\\|'); }

  /* ================= 画面の言語化 ================= */

  // 初期状態では隠れている部品
  var OVERLAY_TYPES = { modal: 1, menu: 1, toast: 1 };

  /* 「中に何かを入れられる」部品だけを親として扱う。
     これをしないと、たまたま重なっただけのテキストが入力欄の親になってしまう。 */
  var CONTAINER_TYPES = {
    container: 1, card: 1, modal: 1, section: 1, sidebar: 1, header: 1, menu: 1, empty: 1, toast: 1
  };

  function isAnnotation(n) {
    var def = SB.shapes && SB.shapes[n.type];
    return !!def && def.category === '注釈';
  }

  function shortName(n) {
    var def = SB.shapes && SB.shapes[n.type];
    var base = def ? def.name : n.type;
    return flatten(base + (has(n.label) ? '「' + n.label + '」' : ''));
  }

  function describeNode(n) {
    var def = SB.shapes && SB.shapes[n.type];
    var out = null;
    if (def && typeof def.describe === 'function') {
      try { out = def.describe(n); } catch (e) { out = null; }
    }
    if (out === null || out === undefined || String(out).trim() === '') out = shortName(n);
    return flatten(out);
  }

  // 画面のどのあたりにあるか。全幅・全高のものは面積で言い表す
  function areaOf(n, s) {
    var wide = n.w >= s.width * 0.72;
    var tall = n.h >= s.height * 0.72;
    if (wide && tall) return '画面全体';
    var cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    var v = cy < s.height / 3 ? '上部' : cy < s.height * 2 / 3 ? '中央' : '下部';
    var hpos = cx < s.width / 3 ? '左' : cx < s.width * 2 / 3 ? '中央' : '右';
    if (wide) return v + '・全幅';
    if (tall) return hpos + '・全高';
    return v + hpos;
  }

  function area(n) { return n.w * n.h; }

  function contains(a, b) {
    var m = 4; // 少しの重なりは許容する
    return a !== b &&
      b.x >= a.x - m && b.y >= a.y - m &&
      b.x + b.w <= a.x + a.w + m && b.y + b.h <= a.y + a.h + m &&
      area(a) > area(b);
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function readingOrder(list) {
    return list.slice().sort(function (a, b) {
      var dy = a.y - b.y;
      return Math.abs(dy) > 12 ? dy : a.x - b.x;
    });
  }

  /* 座標の包含関係から入れ子の木を作る。
     これがないと「このボタンはモーダルの中」という情報が読み手に伝わらない。 */
  function buildTree(nodes) {
    var byId = {};
    nodes.forEach(function (n) { byId[n.id] = { node: n, children: [], parent: null }; });

    nodes.forEach(function (n) {
      var best = null;
      nodes.forEach(function (p) {
        if (!CONTAINER_TYPES[p.type]) return;
        if (!contains(p, n)) return;
        if (!best || area(p) < area(best)) best = p;
      });
      if (best) {
        byId[n.id].parent = byId[best.id];
        byId[best.id].children.push(byId[n.id]);
      }
    });

    var roots = nodes.filter(function (n) { return !byId[n.id].parent; })
                     .map(function (n) { return byId[n.id]; });

    function sortRec(list) {
      list.sort(function (a, b) {
        var dy = a.node.y - b.node.y;
        return Math.abs(dy) > 12 ? dy : a.node.x - b.node.x;
      });
      list.forEach(function (c) { sortRec(c.children); });
    }
    sortRec(roots);
    return { roots: roots, byId: byId };
  }

  // 注釈がどの部品に向けられたものかを推定する
  function annotationTarget(note, targets) {
    var hit = null;
    targets.forEach(function (t) {
      if (!overlaps(note, t)) return;
      if (!hit || area(t) < area(hit)) hit = t;
    });
    if (hit) return hit;

    var ncx = note.x + note.w / 2, ncy = note.y + note.h / 2;
    var best = null, bestD = Infinity;
    targets.forEach(function (t) {
      var dx = Math.max(t.x - ncx, 0, ncx - (t.x + t.w));
      var dy = Math.max(t.y - ncy, 0, ncy - (t.y + t.h));
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) { bestD = d; best = t; }
    });
    return bestD <= 160 ? best : null;
  }

  SB.screenMarkdown = function (s, index, allScreens) {
    var out = [];
    var dev = (SB.DEVICES.filter(function (d) { return d.value === s.device; })[0] || {}).label || s.device;
    var nodes = s.nodes || [];

    out.push('### ' + (index + 1) + '. ' + (s.name || '無題の画面'));
    out.push('');
    kv(out, '画面サイズ', dev + '（目安 ' + s.width + ' x ' + s.height + ' px）');
    kv(out, 'パス・表示条件', s.route);
    if (has(s.description)) kv(out, '画面の説明', s.description);
    out.push('');

    if (!nodes.length) {
      out.push('（配置された部品はありません）');
      out.push('');
      return out.join('\n');
    }

    var annotations = nodes.filter(isAnnotation);
    var real = nodes.filter(function (n) { return !isAnnotation(n); });

    // 通し番号は読み順で振る（注釈から参照できるように）
    var numbered = readingOrder(real);
    var numOf = {};
    numbered.forEach(function (n, i) { numOf[n.id] = i + 1; });

    var tree = buildTree(real);
    var noteFor = {};
    real.forEach(function (n) { if (has(n.note)) noteFor[n.id] = flatten(n.note); });

    // 注釈部品は配置ではなく指示として扱い、近くの部品に紐づける
    var extraNotes = [];
    annotations.forEach(function (a) {
      var text = has(a.label) ? flatten(a.label) : has(a.note) ? flatten(a.note) : '';
      if (!text) return;
      var t = annotationTarget(a, real);
      extraNotes.push({ target: t, text: text });
    });

    function lineFor(item, depth) {
      var n = item.node;
      var pad = new Array(depth + 1).join('  ');
      var txt = pad + '- **' + numOf[n.id] + '.** ' + describeNode(n);
      if (depth === 0) txt += '（' + areaOf(n, s) + '）';
      if (noteFor[n.id]) txt += ' — ' + noteFor[n.id];
      return txt;
    }

    function walk(items, depth, acc) {
      items.forEach(function (it) {
        if (OVERLAY_TYPES[it.node.type] && depth === 0) return; // オーバーレイは別枠
        acc.push(lineFor(it, depth));
        walk(it.children, depth + 1, acc);
      });
    }

    var body = [];
    walk(tree.roots, 0, body);

    if (body.length) {
      out.push('**レイアウト**（上から下・左から右の順。字下げは「その中に含まれる」ことを表す）');
      out.push('');
      body.forEach(function (l) { out.push(l); });
      out.push('');
    }

    // オーバーレイ
    var overlays = tree.roots.filter(function (r) { return OVERLAY_TYPES[r.node.type]; });
    if (overlays.length) {
      out.push('**オーバーレイ（初期状態では表示しない。開く条件は注釈を参照）**');
      out.push('');
      overlays.forEach(function (r) {
        var acc = [];
        acc.push(lineFor(r, 0));
        walk(r.children, 1, acc);
        acc.forEach(function (l) { out.push(l); });
      });
      out.push('');
    }

    // 注釈（付箋・番号付き注釈など）
    if (extraNotes.length) {
      out.push('**注釈**');
      out.push('');
      extraNotes.forEach(function (a) {
        if (a.target) out.push('- **' + numOf[a.target.id] + '. ' + shortName(a.target) + '** について: ' + a.text);
        else out.push('- （画面全体）' + a.text);
      });
      out.push('');
    }

    // 画面遷移
    var links = real.filter(function (n) { return has(n.link); });
    if (links.length && allScreens) {
      out.push('**画面遷移**');
      out.push('');
      links.forEach(function (n) {
        var target = allScreens.filter(function (x) { return x.id === n.link; })[0];
        if (!target) return;
        out.push('- ' + numOf[n.id] + '. ' + shortName(n) + ' を操作 → 「' + (target.name || '無題') + '」へ');
      });
      out.push('');
    }

    // 座標（参考値）
    if (SB.doc.options.coords) {
      out.push('<details><summary>座標（参考値。厳密な再現は不要）</summary>');
      out.push('');
      out.push('| # | 部品 | x, y | w x h |');
      out.push('| --- | --- | --- | --- |');
      numbered.forEach(function (n) {
        out.push('| ' + numOf[n.id] + ' | ' + cell(shortName(n)) + ' | ' + n.x + ', ' + n.y +
          ' | ' + n.w + ' x ' + n.h + ' |');
      });
      out.push('');
      out.push('</details>');
      out.push('');
    }

    return out.join('\n');
  };

  /* ================= 未指定・確認事項 ================= */

  function collectGaps() {
    var d = SB.doc, gaps = [];
    if (!has(d.stack.backend) && !has(d.stack.freeText)) gaps.push('バックエンドの構成');
    if (!has(d.stack.storage)) gaps.push('データの保存先');
    if (!has(d.api.auth)) gaps.push('認証方式');
    if (!has(d.quality.browsers)) gaps.push('対応環境（ブラウザ・OS）');
    if (!has(d.quality.testing) && d.quality.checks.indexOf('単体テストを書く') < 0) gaps.push('テスト方針');
    if (!has(d.stack.infra)) gaps.push('デプロイ先・実行環境');
    if (!has(d.quality.security)) gaps.push('セキュリティ要件');
    return gaps;
  }

  function collectQuestions() {
    var d = SB.doc, q = [];

    if (!has(d.basic.summary)) {
      q.push('この依頼の概要が書かれていません。何を作るのかを最初に確認してください。');
    }
    var noAcc = d.features.filter(function (f) { return has(f.name) && !has(f.acceptance); });
    if (noAcc.length) {
      q.push('受け入れ条件が未記入の機能があります（' +
        noAcc.slice(0, 4).map(function (f) { return f.name; }).join('、') +
        (noAcc.length > 4 ? ' ほか' : '') +
        '）。何をもって完成とするかを提案し、合意してから実装してください。');
    }
    var later = d.features.filter(function (f) { return f.priority !== '必須'; });
    if (later.length) {
      q.push('優先度が「必須」でない機能が ' + later.length + ' 件あります。今回の納品に含めるかを確認してください。');
    }
    if (!has(d.api.auth) && has(d.basic.users) && /と|、|\//.test(d.basic.users)) {
      q.push('利用者が複数種類いる一方、認証方式が未指定です。ログインと権限の要否を確認してください。');
    }
    var refFields = [];
    d.data.forEach(function (e) {
      (e.fields || []).forEach(function (f) { if (f.type === '参照') refFields.push(e.name + '.' + f.name); });
    });
    if (refFields.length && d.data.length < 2) {
      q.push('参照型の項目（' + refFields.slice(0, 3).join('、') + '）がありますが、参照先のデータが定義されていません。');
    }
    var noNote = d.screens.filter(function (s) {
      return (s.nodes || []).length > 0 && !(s.nodes || []).some(function (n) { return has(n.note) || isAnnotation(n); });
    });
    if (noNote.length && d.screens.length) {
      q.push('注釈のない画面があります（' + noNote.slice(0, 3).map(function (s) { return s.name; }).join('、') +
        '）。押したときの挙動や表示条件を確認してください。');
    }
    if (d.screens.length > 1) {
      var anyLink = d.screens.some(function (s) {
        return (s.nodes || []).some(function (n) { return has(n.link); });
      });
      if (!anyLink) q.push('画面が複数ありますが、画面遷移が定義されていません。どの操作でどの画面へ移るかを確認してください。');
    }
    if (!d.rules.mustNot.length) {
      q.push('「やってほしくないこと」の指定がありません。スコープを広げてよいかを確認してください。');
    }
    return q;
  }

  /* ================= 全体 ================= */

  SB.buildMarkdown = function () {
    var d = SB.doc;
    var opt = d.options || {};
    var out = [];
    var title = has(d.basic.projectName) ? d.basic.projectName : '（プロジェクト名未設定）';

    out.push('# 開発依頼書: ' + title);
    out.push('');

    if (opt.roleHeader !== false) {
      out.push('あなたはこのプロジェクトの実装担当エンジニアです。以下の進め方で実装してください。');
      out.push('');
      out.push('1. まず本書を最後まで読み、実装をブロックする不明点を挙げて確認する（無ければ「不明点なし」と宣言する）');
      out.push('2. ファイル構成と着手順の実装計画を簡潔に示してから、コードを書き始める');
      out.push('3. 優先度「必須」から着手する。それ以外は必須の完了後、確認を取ってから');
      out.push('4. 機能ごとに、書かれている受け入れ条件を自分で確認し、結果を報告する');
      out.push('');
      out.push('書かれていない部分は一般的な方法で補ってかまいませんが、**補った判断は最後にまとめて報告**してください。' +
               '「やってほしくないこと」に反する補完はしないでください。');
      out.push('');
      out.push('---');
      out.push('');
    }

    /* --- 1 概要 --- */
    out.push('## 1. 概要');
    out.push('');
    kv(out, 'プロジェクト名', d.basic.projectName);
    kv(out, '作るもの', d.basic.kind);
    kv(out, '対象リポジトリ・作業場所', d.basic.repo);
    kv(out, '期限', d.basic.deadline);
    out.push('');
    block(out, '概要', d.basic.summary);
    block(out, '想定する利用者', d.basic.users);
    block(out, '最終的に受け取りたいもの', d.basic.deliverable);

    /* --- 2 背景と目的 --- */
    var p = d.purpose;
    if (has(p.background) || has(p.goals) || has(p.nonGoals) || has(p.metrics)) {
      out.push('## 2. 背景と目的');
      out.push('');
      block(out, '背景・現状の課題', p.background);
      if (has(p.goals)) {
        out.push('**達成したいこと**');
        out.push('');
        bullets(out, p.goals);
        out.push('');
      }
      if (has(p.nonGoals)) {
        out.push('**今回やらないこと（スコープ外）**');
        out.push('');
        bullets(out, p.nonGoals);
        out.push('');
      }
      block(out, '成功の判断基準', p.metrics);
    }

    /* --- 3 技術と制約 --- */
    var s = d.stack;
    var stackAny = ['platform', 'language', 'frontend', 'backend', 'storage', 'infra'].some(function (k) {
      return has(s[k]);
    });
    if (stackAny || has(s.freeText) || has(s.constraints) || has(s.existing)) {
      out.push('## 3. 技術と制約');
      out.push('');
      kv(out, '動かす場所', s.platform.join(' / '));
      kv(out, '言語', s.language.join(' / '));
      kv(out, 'フロントエンド', s.frontend.join(' / '));
      kv(out, 'バックエンド', s.backend.join(' / '));
      kv(out, 'データの保存先', s.storage.join(' / '));
      kv(out, 'インフラ・実行環境', s.infra.join(' / '));
      out.push('');
      block(out, 'その他の技術指定', s.freeText);
      block(out, '守ってほしい制約', s.constraints);
      block(out, '既存のコード・システム', s.existing);
    }

    /* --- 4 機能要件 --- */
    if (has(d.features)) {
      var screenName = {};
      d.screens.forEach(function (sc, i) { screenName[sc.id] = (i + 1) + '. ' + (sc.name || '無題'); });

      out.push('## 4. 機能要件');
      out.push('');
      out.push('優先度の意味 — **必須**: 今回必ず作る / **推奨**: 余力があれば作る / **任意・将来対応**: 今回は作らない（設計上の考慮のみ）');
      out.push('');
      if (d.features.length >= 3) {
        out.push('| # | 機能 | 優先度 |');
        out.push('| --- | --- | --- |');
        d.features.forEach(function (f, i) {
          out.push('| ' + (i + 1) + ' | ' + cell(f.name || '(未設定)') + ' | ' + f.priority + ' |');
        });
        out.push('');
      }
      d.features.forEach(function (f, i) {
        out.push('### 4.' + (i + 1) + ' ' + (f.name || '(未設定)') + '（' + f.priority + '）');
        out.push('');
        var rel = (f.screens || []).map(function (id) { return screenName[id]; }).filter(Boolean);
        if (rel.length) { out.push('関連する画面: ' + rel.map(function (r) { return '「' + r + '」'; }).join(' / ')); out.push(''); }
        if (has(f.description)) { out.push(String(f.description).trim()); out.push(''); }
        if (has(f.acceptance)) {
          out.push('**受け入れ条件**');
          out.push('');
          f.acceptance.filter(has).forEach(function (a) { out.push('- [ ] ' + a.trim()); });
          out.push('');
        }
        if (has(f.notes)) { out.push('補足: ' + String(f.notes).trim()); out.push(''); }
      });
    }

    /* --- 5 画面設計 --- */
    if (has(d.screens)) {
      out.push('## 5. 画面設計');
      out.push('');
      out.push('画面ごとに、置かれている部品を構造として記述します。' +
               '**寸法は比率の指示であり、ピクセル単位の再現は不要**です。' +
               '並び順・グループ・入れ子の関係と、注釈に書かれた挙動を優先して実装してください。');
      out.push('');
      if (d.screens.length > 1) {
        out.push('**画面一覧**');
        out.push('');
        d.screens.forEach(function (sc, i) {
          out.push('- ' + (i + 1) + '. ' + (sc.name || '無題') +
            (has(sc.route) ? '（' + sc.route + '）' : ''));
        });
        out.push('');
      }
      d.screens.forEach(function (sc, i) {
        out.push(SB.screenMarkdown(sc, i, d.screens));
      });
    }

    /* --- 6 データモデル --- */
    if (has(d.data)) {
      out.push('## 6. データモデル');
      out.push('');
      d.data.forEach(function (e, i) {
        out.push('### 6.' + (i + 1) + ' ' + (e.name || '(未設定)'));
        out.push('');
        if (has(e.description)) { out.push(e.description.trim()); out.push(''); }
        if (has(e.fields)) {
          out.push('| 項目 | 型 | 必須 | 補足 |');
          out.push('| --- | --- | --- | --- |');
          e.fields.forEach(function (f) {
            out.push('| ' + cell(f.name) + ' | ' + f.type + ' | ' + (f.required ? 'はい' : '-') +
              ' | ' + cell(f.note) + ' |');
          });
          out.push('');
        }
      });
    }

    /* --- 7 API・連携 --- */
    var api = d.api;
    if (has(api.style) || has(api.auth) || has(api.external) || has(api.endpoints)) {
      out.push('## 7. API・外部連携');
      out.push('');
      kv(out, 'API方式', api.style);
      kv(out, '認証方式', api.auth);
      out.push('');
      block(out, '外部サービス連携', api.external);
      if (has(api.endpoints)) {
        out.push('**エンドポイント**');
        out.push('');
        api.endpoints.forEach(function (ep) {
          out.push('- `' + ep.method + ' ' + (ep.path || '/') + '`' + (has(ep.purpose) ? ' — ' + ep.purpose : ''));
          if (has(ep.request)) out.push('  - リクエスト: ' + flatten(ep.request));
          if (has(ep.response)) out.push('  - レスポンス: ' + flatten(ep.response));
        });
        out.push('');
      }
    }

    /* --- 8 処理フロー --- */
    if (has(d.flows)) {
      out.push('## 8. 処理フロー');
      out.push('');
      d.flows.forEach(function (fw, i) {
        out.push('### 8.' + (i + 1) + ' ' + (fw.name || '(未設定)'));
        out.push('');
        kv(out, 'きっかけ', fw.trigger);
        out.push('');
        fw.steps.filter(has).forEach(function (st, j) { out.push((j + 1) + '. ' + st.trim()); });
        out.push('');
        if (has(fw.exceptions)) { out.push('例外・エラー時: ' + String(fw.exceptions).trim()); out.push(''); }
      });
    }

    /* --- 9 非機能要件 --- */
    var q = d.quality;
    var qAny = ['performance', 'security', 'accessibility', 'browsers', 'i18n', 'logging', 'testing'].some(function (k) {
      return has(q[k]);
    });
    if (qAny || has(q.checks)) {
      out.push('## 9. 非機能要件');
      out.push('');
      if (has(q.checks)) {
        out.push('**必ず満たすこと**');
        out.push('');
        q.checks.forEach(function (c) { out.push('- [ ] ' + c); });
        out.push('');
      }
      kv(out, '性能', q.performance);
      kv(out, 'セキュリティ', q.security);
      kv(out, 'アクセシビリティ', q.accessibility);
      kv(out, '対応環境', q.browsers);
      kv(out, '多言語・地域', q.i18n);
      kv(out, 'ログ・監視', q.logging);
      kv(out, 'テスト方針', q.testing);
      out.push('');
    }

    /* --- 10 進め方 --- */
    var r = d.rules;
    if (has(r.must) || has(r.mustNot) || has(r.style) || has(r.deliverForm) || has(r.askWhen)) {
      out.push('## 10. 進め方のルール');
      out.push('');
      if (has(r.must)) {
        out.push('**やってほしいこと**');
        out.push('');
        bullets(out, r.must);
        out.push('');
      }
      if (has(r.mustNot)) {
        out.push('**やってほしくないこと**');
        out.push('');
        bullets(out, r.mustNot);
        out.push('');
      }
      kv(out, '回答の言語', r.language);
      kv(out, '成果物の渡し方', r.deliverForm);
      out.push('');
      block(out, 'コードの書き方の好み', r.style);
      block(out, '判断に迷ったときの扱い', r.askWhen);
    }

    /* --- 付録: 未指定と確認事項 --- */
    var gaps = opt.gaps !== false ? collectGaps() : [];
    var questions = opt.questions !== false ? collectQuestions() : [];

    if (gaps.length || questions.length) {
      out.push('---');
      out.push('');
      if (gaps.length) {
        out.push('## 指定していないこと（実装者の裁量に委ねる）');
        out.push('');
        bullets(out, gaps);
        out.push('');
        out.push('一般的な選択をしてかまいませんが、**何を選んだかを実装計画に含めて報告**してください。');
        out.push('');
      }
      if (questions.length) {
        out.push('## 実装前に確認してほしいこと');
        out.push('');
        questions.forEach(function (x, i) { out.push((i + 1) + '. ' + x); });
        out.push('');
      }
    }

    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  };

  /* ================= 出力ビュー ================= */

  SB.views.output = function (root) {
    var d = SB.doc;
    var h = SB.h;
    var wrap = h('div', { class: 'sheet' });

    function render() {
      SB.clear(wrap);
      var md = SB.buildMarkdown();
      var questions = collectQuestions();

      var opt = d.options;
      function toggle(key, label, hint) {
        var cb = h('input', { type: 'checkbox' });
        cb.checked = opt[key] !== false;
        cb.addEventListener('change', function () { opt[key] = cb.checked; SB.touch(); render(); });
        return h('label', { class: 'check' }, [cb, h('span', {}, [
          h('span', { text: label }),
          hint ? h('span', { class: 'field-hint', text: hint }) : null
        ])]);
      }

      var pre = h('pre', { class: 'md-out', text: md });

      var stats = h('div', { class: 'stat-row' }, [
        h('div', { class: 'stat' }, [h('b', { text: String(SB.completion()) + '%' }), '入力の充足度']),
        h('div', { class: 'stat' }, [h('b', { text: String(d.features.length) }), '機能']),
        h('div', { class: 'stat' }, [h('b', { text: String(d.screens.length) }), '画面']),
        h('div', { class: 'stat' }, [h('b', { text: String(SB.nodeCount()) }), '画面部品']),
        h('div', { class: 'stat' }, [h('b', { text: String(md.length) }), '文字数'])
      ]);

      wrap.appendChild(h('div', { class: 'hint-box' }, [
        '下の内容をそのままAIに貼り付けてください。画面設計は文章としても書き出されているため、' +
        '画像を渡せない相手にも伝わります。画像も渡せる場合は、各画面のPNGを添付するとさらに正確になります。'
      ]));

      if (questions.length) {
        wrap.appendChild(SB.card('出力前のチェック', 'AIが迷いそうな箇所です。埋めるほど手戻りが減ります（このまま出力しても、確認事項として指示書に載ります）。', [
          h('ul', { style: 'margin:0;padding-left:20px;font-size:13px;line-height:1.9' },
            questions.map(function (x) { return h('li', { text: x }); }))
        ]));
      }

      wrap.appendChild(SB.card('出力の設定', null, [
        toggle('roleHeader', 'AIへの役割・進め方の指示を先頭に付ける', '「まず不明点を挙げてから実装する」等の進め方を宣言します'),
        toggle('coords', '座標の一覧を付ける', '折りたたみで添付します。細かい位置合わせが必要なときに'),
        toggle('gaps', '「指定していないこと」をまとめる', '未入力の重要項目を、裁量に委ねる旨とともに明示します'),
        toggle('questions', '「実装前に確認してほしいこと」を付ける', '入力内容から自動で質問を組み立てます')
      ]));

      wrap.appendChild(SB.card(null, null, [stats, pre]));

      wrap.appendChild(h('div', { class: 'row-actions' }, [
        SB.btn('Markdownをコピー', function () { SB.copyText(md); }, 'btn btn-primary', 'copy'),
        SB.btn('.md でダウンロード', function () {
          SB.downloadBlob(md, SB.safeFileName(d.basic.projectName, '指示書') + '.md', 'text/markdown;charset=utf-8');
        }, 'btn', 'download')
      ]));

      if (d.screens.length) {
        wrap.appendChild(SB.card('画面の画像', 'AIが画像を受け取れる場合は、これも一緒に添付してください。', [
          h('div', { class: 'chips' }, d.screens.map(function (sc) {
            return SB.btn(sc.name || '無題', function () {
              SB.svgToPng(SB.screenToSvg(sc), sc.width, sc.height, 2, function (blob) {
                if (!blob) { SB.toast('PNGの生成に失敗しました', true); return; }
                SB.downloadBlob(blob, SB.safeFileName(sc.name, 'screen') + '.png');
              });
            }, 'btn btn-sm', 'image');
          }).concat([
            SB.btn('全画面のSVGを保存', function () {
              d.screens.forEach(function (sc, i) {
                setTimeout(function () {
                  SB.downloadBlob(SB.screenToSvg(sc),
                    SB.safeFileName(sc.name, 'screen' + (i + 1)) + '.svg', 'image/svg+xml;charset=utf-8');
                }, i * 350);
              });
            }, 'btn btn-sm', 'download')
          ]))
        ]));
      }
    }

    render();
    root.appendChild(wrap);
  };

})(window.SB);
