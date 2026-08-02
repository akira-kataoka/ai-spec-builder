/* フォーム系セクションの描画 */

window.SB = window.SB || {};

(function (SB) {
  'use strict';

  var h = SB.h;
  var views = SB.views = SB.views || {};

  function sheet(children) {
    return h('div', { class: 'sheet' }, children);
  }

  function hintBox(text) {
    return h('div', { class: 'hint-box', text: text });
  }

  function t() { SB.touch(); }

  function itemTools(list, i, onRender) {
    return [
      SB.iconBtn('up', '上へ', function () {
        if (i === 0) return;
        var x = list[i - 1]; list[i - 1] = list[i]; list[i] = x; t(); onRender();
      }),
      SB.iconBtn('down', '下へ', function () {
        if (i >= list.length - 1) return;
        var x = list[i + 1]; list[i + 1] = list[i]; list[i] = x; t(); onRender();
      }),
      SB.iconBtn('dup', '複製', function () {
        var c = SB.clone(list[i]); c.id = SB.uid('c'); list.splice(i + 1, 0, c); t(); onRender();
      }),
      SB.iconBtn('trash', '削除', function () {
        list.splice(i, 1); t(); onRender();
      }, 'btn-danger')
    ];
  }

  /* ================= 基本情報 ================= */

  views.basic = function (root) {
    var b = SB.doc.basic;
    root.appendChild(sheet([
      hintBox('AIに渡す指示書の土台です。プロジェクト名と一言説明だけでも入れておくと、以降の出力が具体的になります。'),
      SB.card('プロジェクトの概要', 'AIが最初に読む部分です。', [
        h('div', { class: 'grid grid-2' }, [
          SB.field({
            label: 'プロジェクト名', required: true, value: b.projectName,
            placeholder: '例: 社内備品の貸出管理ツール',
            onChange: function (v) { b.projectName = v; t(); }
          }),
          SB.field({
            label: '作るものの種類', value: b.kind,
            placeholder: '選択してください',
            options: ['Webアプリケーション', 'モバイルアプリ', 'デスクトップアプリ', 'ブラウザ拡張機能',
                      'CLIツール', 'APIサーバー', 'バッチ・自動化スクリプト', 'ライブラリ・SDK',
                      '既存システムの改修', 'その他'],
            onChange: function (v) { b.kind = v; t(); }
          })
        ]),
        h('div', { class: 'grid', style: 'margin-top:15px' }, [
          SB.field({
            label: '一言でいうと', required: true, multiline: true, rows: 2, value: b.summary,
            placeholder: '例: 社員が備品を予約し、管理者が貸出状況を一覧で確認できるWebアプリを作りたい。',
            hint: '1〜3文。この1文がAIの理解の軸になります。',
            onChange: function (v) { b.summary = v; t(); }
          })
        ]),
        h('div', { class: 'grid grid-2', style: 'margin-top:15px' }, [
          SB.field({
            label: '想定する利用者', value: b.users, multiline: true, rows: 2,
            placeholder: '例: 一般社員(申請する人)と、総務担当(承認・管理する人)の2種類',
            onChange: function (v) { b.users = v; t(); }
          }),
          SB.field({
            label: '最終的に欲しいもの', value: b.deliverable, multiline: true, rows: 2,
            placeholder: '例: そのまま動くソースコード一式と、起動手順を書いたREADME',
            onChange: function (v) { b.deliverable = v; t(); }
          })
        ]),
        h('div', { class: 'grid grid-2', style: 'margin-top:15px' }, [
          SB.field({
            label: '期限・スケジュール', value: b.deadline,
            placeholder: '例: 2週間以内 / 特になし',
            onChange: function (v) { b.deadline = v; t(); }
          }),
          SB.field({
            label: '対象リポジトリ・作業場所', value: b.repo,
            placeholder: '例: github.com/user/repo の main ブランチ / 新規作成',
            onChange: function (v) { b.repo = v; t(); }
          })
        ])
      ])
    ]));
  };

  /* ================= 背景と目的 ================= */

  views.purpose = function (root) {
    var p = SB.doc.purpose;
    var box = h('div', {});

    function render() {
      SB.clear(box);
      box.appendChild(SB.card('なぜ作るのか', '判断に迷ったときAIが立ち返る基準になります。', [
        SB.field({
          label: '背景・今困っていること', multiline: true, rows: 4, value: p.background,
          placeholder: '例: 現在は備品の貸出をExcelで管理しているが、同時編集で上書きが起きる。誰が何をいつ借りたのか追えていない。',
          hint: '現状の問題を具体的に書くほど、AIの提案がずれにくくなります。',
          onChange: function (v) { p.background = v; t(); }
        })
      ]));
      box.appendChild(SB.card('達成したいこと', null, [
        SB.lineList({
          label: 'ゴール（できるようになりたいこと）',
          values: p.goals, placeholder: '例: 貸出状況をリアルタイムで全員が見られる',
          addLabel: 'ゴールを追加', empty: 'ゴールがまだありません。',
          onChange: function () { t(); }
        }),
        h('div', { style: 'height:15px' }),
        SB.lineList({
          label: '今回やらないこと',
          hint: 'スコープ外を明示すると、AIが余計な実装をしません。',
          values: p.nonGoals, placeholder: '例: 社外からのアクセス対応はしない',
          addLabel: '対象外を追加', empty: '対象外の指定はありません。',
          onChange: function () { t(); }
        }),
        h('div', { style: 'height:15px' }),
        SB.field({
          label: '成功の判断基準', multiline: true, rows: 2, value: p.metrics,
          placeholder: '例: 総務担当が月末の棚卸しを、Excelを開かずに完了できる状態',
          onChange: function (v) { p.metrics = v; t(); }
        })
      ]));
    }
    render();
    root.appendChild(sheet([
      hintBox('目的が書かれていると、AIは仕様の空白を「目的に沿う形」で埋めてくれます。'),
      box
    ]));
  };

  /* ================= 技術と制約 ================= */

  var STACK_OPTIONS = {
    platform: ['Web', 'iOS', 'Android', 'Windows', 'macOS', 'Linux', 'Chrome拡張', 'CLI', 'サーバーサイドのみ'],
    language: ['TypeScript', 'JavaScript', 'Python', 'Java', 'C#', 'Go', 'Ruby', 'PHP', 'Rust', 'Kotlin', 'Swift', 'Apex', 'SQL', 'Shell'],
    frontend: ['React', 'Next.js', 'Vue', 'Nuxt', 'Svelte', 'Angular', '素のHTML/CSS/JS', 'Tailwind CSS', 'Bootstrap', 'LWC', 'Flutter', 'React Native', 'SwiftUI'],
    backend: ['Node.js', 'Express', 'NestJS', 'FastAPI', 'Django', 'Flask', 'Spring Boot', '.NET', 'Rails', 'Laravel', 'Go標準', 'Serverless'],
    storage: ['PostgreSQL', 'MySQL', 'SQLite', 'SQL Server', 'MongoDB', 'Redis', 'Firebase', 'Supabase', 'DynamoDB', 'Salesforce', 'スプレッドシート', 'ファイル(JSON/CSV)'],
    infra: ['Docker', 'GitHub Actions', 'Vercel', 'Netlify', 'AWS', 'Azure', 'GCP', 'Cloudflare', 'GitHub Pages', 'オンプレ']
  };

  views.stack = function (root) {
    var s = SB.doc.stack;
    function chips(key, label, hint) {
      return SB.chipsField({ label: label, hint: hint, options: STACK_OPTIONS[key], values: s[key], onChange: t });
    }
    root.appendChild(sheet([
      hintBox('指定しなかった部分はAIが選びます。こだわりがない項目は空のままで構いません。'),
      SB.card('使う技術', '選ぶだけで指示書に反映されます。', [
        chips('platform', '動かす場所'),
        h('div', { style: 'height:14px' }),
        chips('language', '言語'),
        h('div', { style: 'height:14px' }),
        chips('frontend', 'フロントエンド'),
        h('div', { style: 'height:14px' }),
        chips('backend', 'バックエンド'),
        h('div', { style: 'height:14px' }),
        chips('storage', 'データの保存先'),
        h('div', { style: 'height:14px' }),
        chips('infra', 'インフラ・実行環境'),
        h('div', { style: 'height:14px' }),
        SB.field({
          label: 'その他の指定', value: s.freeText, multiline: true, rows: 2,
          placeholder: '例: 外部ライブラリは使わず標準機能だけで作ってほしい',
          onChange: function (v) { s.freeText = v; t(); }
        })
      ]),
      SB.card('制約と既存環境', 'ここが曖昧だと作り直しになりがちです。', [
        SB.field({
          label: '守ってほしい制約', multiline: true, rows: 3, value: s.constraints,
          placeholder: '例: 社内ネットワークからのみアクセス可能。追加費用が発生するサービスは使わない。IE対応は不要。',
          onChange: function (v) { s.constraints = v; t(); }
        }),
        h('div', { style: 'height:15px' }),
        SB.field({
          label: '既存のコード・システム', multiline: true, rows: 3, value: s.existing,
          placeholder: '例: 既存のリポジトリがあり、src/components 配下の書き方に合わせてほしい。認証は既存のログイン機構を流用する。',
          hint: '既存資産があるなら、その場所と踏襲すべき書き方を書きます。',
          onChange: function (v) { s.existing = v; t(); }
        })
      ])
    ]));
  };

  /* ================= 機能要件 ================= */

  views.features = function (root) {
    var list = SB.doc.features;
    var box = h('div', { class: 'repeat' });

    function render() {
      SB.clear(box);
      if (!list.length) {
        box.appendChild(h('div', { class: 'empty-state', text: '機能がまだありません。「機能を追加」から1件ずつ登録してください。' }));
      }
      list.forEach(function (f, i) {
        box.appendChild(SB.itemCard({
          index: i + 1,
          titleNode: [
            h('span', { text: f.name || '' }),
            f.name ? null : h('span', { class: 'muted', text: '(名称未設定)' }),
            h('span', { class: 'muted', text: '  ' + f.priority })
          ],
          tools: itemTools(list, i, render),
          body: [
            h('div', { class: 'grid grid-3' }, [
              h('div', { style: 'grid-column:span 2' }, SB.field({
                label: '機能名', value: f.name, placeholder: '例: 備品の貸出申請',
                onChange: function (v) { f.name = v; t(); }
              })),
              SB.field({
                label: '優先度', value: f.priority, options: ['必須', '推奨', '任意', '将来対応'],
                onChange: function (v) { f.priority = v; t(); render(); }
              })
            ]),
            SB.field({
              label: 'どう動くか', multiline: true, rows: 3, value: f.description,
              placeholder: '例: 社員が備品一覧から品目と期間を選んで申請する。申請すると総務担当に通知が飛び、承認待ち状態になる。',
              onChange: function (v) { f.description = v; t(); }
            }),
            SB.lineList({
              label: '受け入れ条件（これが満たされたら完成）',
              hint: '「〜できる」「〜が表示される」の形で書くとAIが検証しやすくなります。',
              values: f.acceptance, placeholder: '例: 在庫が0の備品は申請ボタンが押せない',
              addLabel: '条件を追加', empty: '条件が未設定です。',
              onChange: t
            }),
            SB.field({
              label: '補足', value: f.notes, placeholder: '例: 既存の申請フォームと同じ項目順にする',
              onChange: function (v) { f.notes = v; t(); }
            })
          ]
        }));
      });
      box.appendChild(h('div', { class: 'row-actions' }, [
        SB.btn('機能を追加', function () { list.push(SB.newFeature()); t(); render(); }, 'btn btn-primary', 'plus')
      ]));
    }
    render();

    root.appendChild(sheet([
      hintBox('1機能=1カード。受け入れ条件まで書くと、AIが「完成の定義」を持って実装できます。'),
      SB.card('機能一覧', null, [box])
    ]));
  };

  /* ================= データモデル ================= */

  views.data = function (root) {
    var list = SB.doc.data;
    var box = h('div', { class: 'repeat' });

    function fieldsEditor(ent) {
      var wrap = h('div', { class: 'lines' });
      function draw() {
        SB.clear(wrap);
        if (!ent.fields.length) {
          wrap.appendChild(h('div', { class: 'empty-state', text: '項目がまだありません。' }));
        }
        ent.fields.forEach(function (fl, i) {
          var name = h('input', { type: 'text', placeholder: '項目名 (例: 貸出日)' });
          name.value = fl.name;
          name.addEventListener('input', function () { fl.name = name.value; t(); });

          var type = h('select', { style: 'width:110px;flex:none' });
          SB.FIELD_TYPES.forEach(function (ft) { type.appendChild(h('option', { value: ft, text: ft })); });
          type.value = fl.type;
          type.addEventListener('change', function () { fl.type = type.value; t(); });

          var req = h('input', { type: 'checkbox', title: '必須' });
          req.checked = !!fl.required;
          req.addEventListener('change', function () { fl.required = req.checked; t(); });

          var note = h('input', { type: 'text', placeholder: '補足 (例: 未来日は不可)' });
          note.value = fl.note;
          note.addEventListener('input', function () { fl.note = note.value; t(); });

          wrap.appendChild(h('div', { class: 'line-row' }, [
            name, type,
            h('label', { class: 'check nowrap', style: 'flex:none;margin:0' }, [req, h('span', { text: '必須' })]),
            note,
            SB.iconBtn('trash', '削除', function () { ent.fields.splice(i, 1); t(); draw(); }, 'btn-danger')
          ]));
        });
        wrap.appendChild(h('div', { class: 'row-actions' }, [
          SB.btn('項目を追加', function () { ent.fields.push(SB.newField()); t(); draw(); }, 'btn btn-sm', 'plus')
        ]));
      }
      draw();
      return h('div', { class: 'field' }, [
        h('span', { class: 'field-label', text: '項目' }),
        wrap
      ]);
    }

    function render() {
      SB.clear(box);
      if (!list.length) {
        box.appendChild(h('div', { class: 'empty-state', text: 'データの入れ物（テーブル・エンティティ）を追加してください。' }));
      }
      list.forEach(function (e, i) {
        box.appendChild(SB.itemCard({
          index: i + 1,
          titleNode: [
            h('span', { text: e.name || '' }),
            e.name ? null : h('span', { class: 'muted', text: '(名称未設定)' }),
            h('span', { class: 'muted', text: '  ' + e.fields.length + '項目' })
          ],
          tools: itemTools(list, i, render),
          body: [
            h('div', { class: 'grid grid-2' }, [
              SB.field({
                label: '名前', value: e.name, placeholder: '例: 備品 / Equipment',
                onChange: function (v) { e.name = v; t(); render(); }
              }),
              SB.field({
                label: '説明', value: e.description, placeholder: '例: 貸出対象となる備品1件',
                onChange: function (v) { e.description = v; t(); }
              })
            ]),
            fieldsEditor(e)
          ]
        }));
      });
      box.appendChild(h('div', { class: 'row-actions' }, [
        SB.btn('データを追加', function () { list.push(SB.newEntity()); t(); render(); }, 'btn btn-primary', 'plus')
      ]));
    }
    render();

    root.appendChild(sheet([
      hintBox('項目名・型・必須の3つが決まっていれば、AIはテーブル定義も入力チェックも組み立てられます。'),
      SB.card('データ構造', null, [box])
    ]));
  };

  /* ================= API・連携 ================= */

  views.api = function (root) {
    var api = SB.doc.api;
    var box = h('div', { class: 'repeat' });

    function render() {
      SB.clear(box);
      if (!api.endpoints.length) {
        box.appendChild(h('div', { class: 'empty-state', text: 'エンドポイントは未定義です。AIに任せる場合は空のままで構いません。' }));
      }
      api.endpoints.forEach(function (ep, i) {
        box.appendChild(SB.itemCard({
          index: i + 1,
          titleNode: [h('span', { class: 'mono', text: ep.method + ' ' + (ep.path || '/') })],
          tools: itemTools(api.endpoints, i, render),
          body: [
            h('div', { class: 'grid grid-3' }, [
              SB.field({
                label: 'メソッド', value: ep.method, options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
                onChange: function (v) { ep.method = v; t(); render(); }
              }),
              h('div', { style: 'grid-column:span 2' }, SB.field({
                label: 'パス', value: ep.path, placeholder: '例: /api/rentals/:id',
                onChange: function (v) { ep.path = v; t(); render(); }
              }))
            ]),
            SB.field({
              label: '用途', value: ep.purpose, placeholder: '例: 貸出申請を1件登録する',
              onChange: function (v) { ep.purpose = v; t(); }
            }),
            h('div', { class: 'grid grid-2' }, [
              SB.field({
                label: 'リクエスト', multiline: true, rows: 3, value: ep.request,
                placeholder: '例: { itemId: string, from: date, to: date }',
                onChange: function (v) { ep.request = v; t(); }
              }),
              SB.field({
                label: 'レスポンス', multiline: true, rows: 3, value: ep.response,
                placeholder: '例: 201 { id, status: "pending" }',
                onChange: function (v) { ep.response = v; t(); }
              })
            ])
          ]
        }));
      });
      box.appendChild(h('div', { class: 'row-actions' }, [
        SB.btn('エンドポイントを追加', function () { api.endpoints.push(SB.newEndpoint()); t(); render(); }, 'btn btn-primary', 'plus')
      ]));
    }
    render();

    root.appendChild(sheet([
      SB.card('方式', null, [
        h('div', { class: 'grid grid-2' }, [
          SB.field({
            label: 'API方式', value: api.style, placeholder: '選択してください',
            options: ['REST', 'GraphQL', 'RPC', 'WebSocket', 'サーバーアクション', '不要（画面内で完結）'],
            onChange: function (v) { api.style = v; t(); }
          }),
          SB.field({
            label: '認証方式', value: api.auth, placeholder: '選択してください',
            options: ['なし', 'メール+パスワード', 'OAuth 2.0', 'SSO / SAML', 'APIキー', 'JWT', 'セッションCookie', '既存の認証を流用'],
            onChange: function (v) { api.auth = v; t(); }
          })
        ]),
        h('div', { style: 'height:15px' }),
        SB.field({
          label: '外部サービス連携', multiline: true, rows: 3, value: api.external,
          placeholder: '例: Slackに通知を送る（Incoming Webhook）。社内のLDAPからユーザー情報を取得する。',
          onChange: function (v) { api.external = v; t(); }
        })
      ]),
      SB.card('エンドポイント', null, [box])
    ]));
  };

  /* ================= 処理フロー ================= */

  views.flows = function (root) {
    var list = SB.doc.flows;
    var box = h('div', { class: 'repeat' });

    function render() {
      SB.clear(box);
      if (!list.length) {
        box.appendChild(h('div', { class: 'empty-state', text: '手順のある処理（申請から承認まで等）があれば追加してください。' }));
      }
      list.forEach(function (fw, i) {
        box.appendChild(SB.itemCard({
          index: i + 1,
          titleNode: [
            h('span', { text: fw.name || '' }),
            fw.name ? null : h('span', { class: 'muted', text: '(名称未設定)' }),
            h('span', { class: 'muted', text: '  ' + fw.steps.length + 'ステップ' })
          ],
          tools: itemTools(list, i, render),
          body: [
            h('div', { class: 'grid grid-2' }, [
              SB.field({
                label: 'フロー名', value: fw.name, placeholder: '例: 貸出申請から返却まで',
                onChange: function (v) { fw.name = v; t(); render(); }
              }),
              SB.field({
                label: 'きっかけ', value: fw.trigger, placeholder: '例: 社員が申請ボタンを押したとき',
                onChange: function (v) { fw.trigger = v; t(); }
              })
            ]),
            SB.lineList({
              label: 'ステップ', hint: '上から順に実行される想定で書きます。',
              values: fw.steps, placeholder: '例: 在庫を確認し、空きがなければエラーを表示する',
              addLabel: 'ステップを追加', empty: 'ステップが未設定です。',
              onChange: t
            }),
            SB.field({
              label: '例外・エラー時', multiline: true, rows: 2, value: fw.exceptions,
              placeholder: '例: 承認されないまま3日経過したら申請者に再通知する',
              onChange: function (v) { fw.exceptions = v; t(); }
            })
          ]
        }));
      });
      box.appendChild(h('div', { class: 'row-actions' }, [
        SB.btn('フローを追加', function () { list.push(SB.newFlow()); t(); render(); }, 'btn btn-primary', 'plus')
      ]));
    }
    render();

    root.appendChild(sheet([
      hintBox('分岐や例外まで書いておくと、AIが握りつぶしの実装をしません。'),
      SB.card('処理の流れ', null, [box])
    ]));
  };

  /* ================= 非機能要件 ================= */

  var QUALITY_CHECKS = [
    'エラー時にユーザーへ理由を表示する', '入力値のバリデーションを行う', '処理中のローディング表示を出す',
    'データ0件のときの空状態を表示する', 'スマートフォンでも崩れないようにする', 'キーボードだけで操作できるようにする',
    'ダークモードに対応する', '権限による表示・操作の制御を行う', '重要操作の前に確認を挟む',
    '操作ログを残す', '単体テストを書く', 'E2Eテストを書く'
  ];

  views.quality = function (root) {
    var q = SB.doc.quality;
    root.appendChild(sheet([
      hintBox('見落とされがちな要求です。チェックを入れるだけで指示書に反映されます。'),
      SB.card('品質面で必ず守ってほしいこと', null, [
        SB.checkList({ options: QUALITY_CHECKS, values: q.checks, onChange: t })
      ]),
      SB.card('個別の要求', '空欄の項目は指示書に載りません。', [
        h('div', { class: 'grid grid-2' }, [
          SB.field({
            label: '性能', multiline: true, rows: 2, value: q.performance,
            placeholder: '例: 一覧は1000件でも2秒以内に表示',
            onChange: function (v) { q.performance = v; t(); }
          }),
          SB.field({
            label: 'セキュリティ', multiline: true, rows: 2, value: q.security,
            placeholder: '例: 認証必須。他人のデータは参照できないこと。',
            onChange: function (v) { q.security = v; t(); }
          }),
          SB.field({
            label: 'アクセシビリティ', multiline: true, rows: 2, value: q.accessibility,
            placeholder: '例: コントラスト比4.5:1以上。ラベルを必ず付ける。',
            onChange: function (v) { q.accessibility = v; t(); }
          }),
          SB.field({
            label: '対応環境', multiline: true, rows: 2, value: q.browsers,
            placeholder: '例: Chrome / Edge の最新版のみ',
            onChange: function (v) { q.browsers = v; t(); }
          }),
          SB.field({
            label: '多言語・地域', multiline: true, rows: 2, value: q.i18n,
            placeholder: '例: 日本語のみ。日付は YYYY/MM/DD 表記。',
            onChange: function (v) { q.i18n = v; t(); }
          }),
          SB.field({
            label: 'ログ・監視', multiline: true, rows: 2, value: q.logging,
            placeholder: '例: エラーはコンソールに出す。個人情報はログに残さない。',
            onChange: function (v) { q.logging = v; t(); }
          })
        ]),
        h('div', { style: 'height:15px' }),
        SB.field({
          label: 'テスト方針', multiline: true, rows: 2, value: q.testing,
          placeholder: '例: 主要な計算ロジックには単体テストを付ける。UIのテストは不要。',
          onChange: function (v) { q.testing = v; t(); }
        })
      ])
    ]));
  };

  /* ================= 進め方 ================= */

  var MUST_PRESETS = [
    '不明点があれば実装前に質問する',
    '変更したファイルの一覧を最後に示す',
    'コードには日本語のコメントを付ける',
    '既存のコードスタイルに合わせる',
    '動作確認の手順を書く',
    '段階的に進め、区切りごとに報告する'
  ];
  var MUSTNOT_PRESETS = [
    '指示にない機能を勝手に追加しない',
    '既存の動いている機能を壊さない',
    '説明のためにコードを省略しない（全文を出す）',
    '新しいライブラリを勝手に追加しない',
    'ファイルを勝手に削除・リネームしない',
    '推測で仕様を決めない'
  ];

  views.rules = function (root) {
    var r = SB.doc.rules;
    var box = h('div', {});

    function presetRow(values, presets, onDone) {
      var wrap = h('div', { class: 'chips', style: 'margin-top:8px' });
      presets.forEach(function (p) {
        wrap.appendChild(SB.h('button', {
          class: 'chip', type: 'button', text: p,
          onclick: function () {
            if (values.indexOf(p) < 0) { values.push(p); t(); onDone(); }
          }
        }));
      });
      return h('div', {}, [
        h('span', { class: 'field-hint', text: 'よく使う項目（クリックで追加）' }),
        wrap
      ]);
    }

    function render() {
      SB.clear(box);
      box.appendChild(SB.card('AIへの作業ルール', null, [
        SB.lineList({
          label: 'やってほしいこと', values: r.must, placeholder: '例: 実装前に方針を説明する',
          addLabel: '追加', empty: '未設定です。', onChange: t
        }),
        presetRow(r.must, MUST_PRESETS, render),
        h('div', { style: 'height:18px' }),
        SB.lineList({
          label: 'やってほしくないこと', values: r.mustNot, placeholder: '例: 指示にない画面を作らない',
          addLabel: '追加', empty: '未設定です。', onChange: t
        }),
        presetRow(r.mustNot, MUSTNOT_PRESETS, render)
      ]));
      box.appendChild(SB.card('回答のしかた', null, [
        h('div', { class: 'grid grid-2' }, [
          SB.field({
            label: '回答の言語', value: r.language, options: ['日本語', '英語', 'コードは英語・説明は日本語'],
            onChange: function (v) { r.language = v; t(); }
          }),
          SB.field({
            label: '成果物の渡し方', value: r.deliverForm, placeholder: '選択してください',
            options: ['ファイルごとに全文を出す', '差分（パッチ）で出す', 'ファイルを直接作成・編集する', '手順の説明だけでよい'],
            onChange: function (v) { r.deliverForm = v; t(); }
          })
        ]),
        h('div', { style: 'height:15px' }),
        SB.field({
          label: 'コードの書き方の好み', multiline: true, rows: 2, value: r.style,
          placeholder: '例: 1ファイルは300行以内。関数名は動詞から始める。過度な抽象化はしない。',
          onChange: function (v) { r.style = v; t(); }
        }),
        h('div', { style: 'height:15px' }),
        SB.field({
          label: '判断に迷ったときの扱い', multiline: true, rows: 2, value: r.askWhen,
          placeholder: '例: 仕様が2通り考えられる場合は、両方の案を示してから進める',
          onChange: function (v) { r.askWhen = v; t(); }
        })
      ]));
    }
    render();

    root.appendChild(sheet([
      hintBox('ここを書いておくと、AIの出力形式が安定します。手戻りが最も減る項目です。'),
      box
    ]));
  };

})(window.SB);
