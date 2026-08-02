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

  function line(out, s) { out.push(s === undefined ? '' : s); }

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

  /* ---------- 画面の言語化 ---------- */

  function areaOf(n, s) {
    var cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    var v = cy < s.height / 3 ? '上部' : cy < s.height * 2 / 3 ? '中央' : '下部';
    var hpos = cx < s.width / 3 ? '左' : cx < s.width * 2 / 3 ? '中央' : '右';
    return v + hpos;
  }

  function describeNode(n) {
    var def = SB.shapes && SB.shapes[n.type];
    if (def && typeof def.describe === 'function') {
      try { return def.describe(n); } catch (e) { /* 続行 */ }
    }
    var name = def ? def.name : n.type;
    return name + (has(n.label) ? '「' + String(n.label).replace(/\n/g, ' ') + '」' : '');
  }

  SB.screenMarkdown = function (s, index, allScreens) {
    var out = [];
    var dev = (SB.DEVICES.filter(function (d) { return d.value === s.device; })[0] || {}).label || s.device;

    out.push('### ' + (index + 1) + '. ' + (s.name || '無題の画面'));
    out.push('');
    kv(out, '画面サイズ', dev + '（' + s.width + ' x ' + s.height + ' px 想定）');
    kv(out, 'パス・表示条件', s.route);
    if (has(s.description)) kv(out, '画面の説明', s.description);
    out.push('');

    var nodes = (s.nodes || []).slice().sort(function (a, b) {
      var dy = a.y - b.y;
      return Math.abs(dy) > 12 ? dy : a.x - b.x;
    });

    if (!nodes.length) {
      out.push('（配置された部品はありません）');
      out.push('');
      return out.join('\n');
    }

    out.push('**配置（上から下、左から右の順）**');
    out.push('');
    out.push('| # | 位置 | 部品 | 座標 (x, y) | サイズ (w x h) |');
    out.push('| --- | --- | --- | --- | --- |');
    nodes.forEach(function (n, i) {
      out.push('| ' + (i + 1) + ' | ' + areaOf(n, s) + ' | ' + describeNode(n).replace(/\|/g, '\\|') +
        ' | ' + n.x + ', ' + n.y + ' | ' + n.w + ' x ' + n.h + ' |');
    });
    out.push('');

    var notes = nodes.filter(function (n) { return has(n.note); });
    if (notes.length) {
      out.push('**この画面の注釈**');
      out.push('');
      nodes.forEach(function (n, i) {
        if (!has(n.note)) return;
        out.push('- **' + (i + 1) + '. ' + describeNode(n) + '**: ' + String(n.note).trim().replace(/\n/g, ' / '));
      });
      out.push('');
    }

    var links = nodes.filter(function (n) { return has(n.link); });
    if (links.length && allScreens) {
      out.push('**画面遷移**');
      out.push('');
      links.forEach(function (n) {
        var target = allScreens.filter(function (x) { return x.id === n.link; })[0];
        if (!target) return;
        out.push('- ' + describeNode(n) + ' を操作 → 「' + (target.name || '無題') + '」へ遷移');
      });
      out.push('');
    }

    return out.join('\n');
  };

  /* ---------- 全体 ---------- */

  SB.buildMarkdown = function () {
    var d = SB.doc;
    var out = [];
    var title = has(d.basic.projectName) ? d.basic.projectName : '（プロジェクト名未設定）';

    out.push('# 開発依頼書: ' + title);
    out.push('');
    out.push('> このドキュメントは実装を依頼するための指示書です。');
    out.push('> 記載がない部分は一般的な妥当な方法で補ってかまいませんが、' +
             '**「やってほしくないこと」に反する判断はしないでください**。');
    out.push('> 仕様が二通り以上に読める箇所は、実装前に確認してください。');
    out.push('');

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
      out.push('## 4. 機能要件');
      out.push('');
      out.push('| # | 機能 | 優先度 |');
      out.push('| --- | --- | --- |');
      d.features.forEach(function (f, i) {
        out.push('| ' + (i + 1) + ' | ' + (f.name || '(未設定)').replace(/\|/g, '\\|') + ' | ' + f.priority + ' |');
      });
      out.push('');
      d.features.forEach(function (f, i) {
        out.push('### 4.' + (i + 1) + ' ' + (f.name || '(未設定)') + '（' + f.priority + '）');
        out.push('');
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
      out.push('各画面のワイヤーフレームを、部品の配置と注釈として記述します。' +
               '座標は左上を (0, 0) とするピクセル値です。**寸法は比率の指示であり、厳密な再現は不要**です。' +
               'レイアウトの意図（並び順・グループ・優先度）を汲んで実装してください。');
      out.push('');
      if (d.screens.length > 1) {
        out.push('**画面一覧**');
        out.push('');
        d.screens.forEach(function (sc, i) {
          out.push('- ' + (i + 1) + '. ' + (sc.name || '無題') + '（部品 ' + (sc.nodes ? sc.nodes.length : 0) + ' 個）');
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
            out.push('| ' + (f.name || '') + ' | ' + f.type + ' | ' + (f.required ? 'はい' : '-') +
              ' | ' + (f.note || '').replace(/\|/g, '\\|') + ' |');
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
          if (has(ep.request)) out.push('  - リクエスト: ' + String(ep.request).replace(/\n/g, ' '));
          if (has(ep.response)) out.push('  - レスポンス: ' + String(ep.response).replace(/\n/g, ' '));
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

    /* --- 末尾 --- */
    out.push('---');
    out.push('');
    out.push('この指示書で不足している情報があれば、実装を始める前に質問してください。');
    out.push('');

    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  };

  /* ---------- 出力ビュー ---------- */

  SB.views.output = function (root) {
    var d = SB.doc;
    var md = SB.buildMarkdown();
    var h = SB.h;

    var pre = h('pre', { class: 'md-out', text: md });

    var stats = h('div', { class: 'stat-row' }, [
      h('div', { class: 'stat' }, [h('b', { text: String(SB.completion()) + '%' }), '入力の充足度']),
      h('div', { class: 'stat' }, [h('b', { text: String(d.features.length) }), '機能']),
      h('div', { class: 'stat' }, [h('b', { text: String(d.screens.length) }), '画面']),
      h('div', { class: 'stat' }, [h('b', { text: String(SB.nodeCount()) }), '画面部品']),
      h('div', { class: 'stat' }, [h('b', { text: String(md.length) }), '文字数']),
      h('div', { class: 'stat' }, [h('b', { text: String(Math.ceil(md.length / 2.2)) }), '概算トークン'])
    ]);

    var body = h('div', { class: 'sheet' }, [
      h('div', { class: 'hint-box' }, [
        '下の内容をそのままAIに貼り付けてください。画面設計は文章としても書き出されているため、' +
        '画像を渡せない相手でも伝わります。画像を渡せる場合は、各画面のPNGも一緒に添付すると精度が上がります。'
      ]),
      SB.card(null, null, [stats, pre]),
      d.screens.length ? SB.card('画面の書き出し', '1画面ずつ画像として保存できます。', [
        h('div', { class: 'chips' }, d.screens.map(function (sc) {
          return SB.btn(sc.name || '無題', function () {
            SB.svgToPng(SB.screenToSvg(sc), sc.width, sc.height, 2, function (blob) {
              if (!blob) { SB.toast('PNGの生成に失敗しました', true); return; }
              SB.downloadBlob(blob, SB.safeFileName(sc.name, 'screen') + '.png');
            });
          }, 'btn btn-sm', 'image');
        }))
      ]) : null
    ]);

    var actions = h('div', { class: 'sheet', style: 'padding-top:0' }, [
      h('div', { class: 'row-actions' }, [
        SB.btn('Markdownをコピー', function () { SB.copyText(md); }, 'btn btn-primary', 'copy'),
        SB.btn('.md でダウンロード', function () {
          SB.downloadBlob(md, SB.safeFileName(d.basic.projectName, '指示書') + '.md', 'text/markdown;charset=utf-8');
        }, 'btn', 'download'),
        SB.btn('全画面のSVGをまとめて保存', function () {
          if (!d.screens.length) { SB.toast('画面がありません', true); return; }
          d.screens.forEach(function (sc, i) {
            setTimeout(function () {
              SB.downloadBlob(SB.screenToSvg(sc), SB.safeFileName(sc.name, 'screen' + (i + 1)) + '.svg', 'image/svg+xml;charset=utf-8');
            }, i * 350);
          });
        }, 'btn', 'download')
      ])
    ]);

    root.appendChild(body);
    root.appendChild(actions);
  };

})(window.SB);
