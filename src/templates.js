/* テンプレートとサンプル。白紙から書き始めなくて済むように */

window.SB = window.SB || {};

(function (SB) {
  'use strict';

  function addAll(arr, items) {
    items.forEach(function (x) { if (arr.indexOf(x) < 0) arr.push(x); });
  }

  var COMMON_MUST = [
    '不明点があれば実装前に質問する',
    '変更したファイルの一覧を最後に示す',
    '動作確認の手順を書く'
  ];
  var COMMON_MUSTNOT = [
    '指示にない機能を勝手に追加しない',
    '説明のためにコードを省略しない（全文を出す）',
    '推測で仕様を決めない'
  ];

  SB.TEMPLATES = [
    {
      id: 'web',
      name: 'Webアプリ',
      desc: '画面があり、データを登録・一覧できるもの',
      apply: function (d) {
        d.basic.kind = 'Webアプリケーション';
        addAll(d.stack.platform, ['Web']);
        addAll(d.stack.language, ['TypeScript']);
        addAll(d.stack.frontend, ['React']);
        addAll(d.quality.checks, [
          '入力値のバリデーションを行う',
          'エラー時にユーザーへ理由を表示する',
          'データ0件のときの空状態を表示する',
          '処理中のローディング表示を出す',
          'スマートフォンでも崩れないようにする'
        ]);
        d.api.style = d.api.style || 'REST';
        if (!d.screens.length) d.screens.push(SB.newScreen('一覧画面'));
      }
    },
    {
      id: 'ext',
      name: 'Chrome拡張',
      desc: 'ブラウザに組み込む小さなツール',
      apply: function (d) {
        d.basic.kind = 'ブラウザ拡張機能';
        addAll(d.stack.platform, ['Chrome拡張']);
        addAll(d.stack.language, ['JavaScript']);
        addAll(d.stack.frontend, ['素のHTML/CSS/JS']);
        d.stack.constraints = d.stack.constraints ||
          'Manifest V3 で作る。権限は必要最小限にする。外部サーバーへの通信はしない。';
        addAll(d.quality.checks, ['エラー時にユーザーへ理由を表示する', 'ダークモードに対応する']);
        addAll(d.rules.mustNot, ['新しいライブラリを勝手に追加しない']);
      }
    },
    {
      id: 'fix',
      name: '既存システムの改修',
      desc: '動いているものに手を入れる',
      apply: function (d) {
        d.basic.kind = '既存システムの改修';
        d.stack.existing = d.stack.existing ||
          '既存のリポジトリがある。既存のディレクトリ構成・命名・書き方に合わせること。';
        addAll(d.rules.must, ['既存のコードスタイルに合わせる', '段階的に進め、区切りごとに報告する']);
        addAll(d.rules.mustNot, [
          '既存の動いている機能を壊さない',
          'ファイルを勝手に削除・リネームしない',
          '関係のないリファクタリングをしない'
        ]);
        addAll(d.quality.checks, ['単体テストを書く']);
      }
    },
    {
      id: 'cli',
      name: 'CLI・自動化',
      desc: 'コマンドやバッチで動かすもの',
      apply: function (d) {
        d.basic.kind = 'CLIツール';
        addAll(d.stack.platform, ['CLI']);
        addAll(d.stack.language, ['Python']);
        d.api.style = '不要（画面内で完結）';
        d.quality.logging = d.quality.logging ||
          '進捗と結果を標準出力に出す。エラーは終了コードを 0 以外にする。';
        addAll(d.quality.checks, ['エラー時にユーザーへ理由を表示する', '重要操作の前に確認を挟む']);
      }
    }
  ];

  SB.applyTemplate = function (id) {
    var t = SB.TEMPLATES.filter(function (x) { return x.id === id; })[0];
    if (!t) return false;
    var d = SB.doc;
    t.apply(d);
    addAll(d.rules.must, COMMON_MUST);
    addAll(d.rules.mustNot, COMMON_MUSTNOT);
    if (!d.rules.deliverForm) d.rules.deliverForm = 'ファイルごとに全文を出す';
    SB.save(true);
    return true;
  };

  /* ---------- サンプル（このツールで何ができるかを見せるためのもの） ---------- */

  function node(type, x, y, w, hgt, label, note, props, link) {
    return {
      id: SB.uid('n'), type: type, x: x, y: y, w: w, h: hgt,
      label: label || '', note: note || '', link: link || '', props: props || {}
    };
  }

  SB.buildSampleDoc = function () {
    var d = SB.defaultDoc();

    d.basic = {
      projectName: '備品貸出管理ツール',
      summary: '社員が社内備品を予約して借り、総務担当が貸出状況を一覧で把握できるようにする社内向けWebアプリ。',
      kind: 'Webアプリケーション',
      users: '一般社員（借りる人）と総務担当（承認・管理する人）の2種類',
      deliverable: 'そのまま動くソースコード一式と、起動手順を書いたREADME',
      deadline: '2週間以内',
      repo: '新規リポジトリを作る'
    };

    d.purpose = {
      background: '現在はExcelファイルを共有フォルダに置いて管理している。' +
                  '同時に開くと上書きが起き、誰がいつ何を借りたのか追えなくなっている。' +
                  '月末の棚卸しに毎回2時間かかっている。',
      goals: [
        '貸出状況を全員がリアルタイムで確認できる',
        '申請から承認までを画面上で完結させる',
        '棚卸しの作業時間を30分以内にする'
      ],
      nonGoals: ['社外ネットワークからのアクセス対応', '備品の購入・発注の管理'],
      metrics: '総務担当が、Excelを一度も開かずに月末の棚卸しを完了できる状態'
    };

    d.stack = {
      platform: ['Web'], language: ['TypeScript'], frontend: ['React'],
      backend: ['Node.js'], storage: ['PostgreSQL'], infra: ['Docker'],
      freeText: '',
      constraints: '社内ネットワークからのみアクセスできればよい。追加費用の発生する外部サービスは使わない。',
      existing: '既存システムはない。ただし社員情報は既存の社内LDAPから取得したい。'
    };

    var s1 = SB.newScreen('備品一覧');
    s1.route = '/items';
    s1.description = 'ログイン後に最初に表示する画面。件数が多いので検索とページングが要る。';
    s1.nodes = [
      node('header', 0, 0, 960, 48, '備品貸出管理'),
      node('sidebar', 0, 48, 176, 592, '', 'ログイン中の権限で項目を出し分ける（総務担当のみ「設定」を表示）',
           { items: '備品一覧\n申請履歴\n設定' }),
      node('heading', 208, 72, 240, 32, '備品一覧', '', { level: '1' }),
      node('search', 208, 120, 280, 40, '', '名称の部分一致で絞り込む。入力から300ms後に検索する。',
           { placeholder: '備品名で検索' }),
      node('select', 512, 112, 180, 56, '状態', '', { options: 'すべて\n貸出可\n貸出中', placeholder: 'すべて' }),
      node('button', 800, 120, 120, 40, '新規申請', '押すと申請フォームへ移動する', { variant: 'primary' }),
      node('table', 208, 192, 712, 232, '備品',
           '在庫が0の行は文字をグレーにし、申請ボタンを押せなくする',
           { columns: '名称\n分類\n在庫\n状態', rows: '6' }),
      node('pagination', 208, 448, 220, 32, '', '1ページ20件'),
      node('note', 560, 448, 360, 92, '一覧は在庫の多い順ではなく名称の五十音順で並べる。\n総務担当のときだけ「編集」列を追加で表示する。')
    ];

    var s2 = SB.newScreen('貸出申請');
    s2.route = '/items/:id/request';
    s2.description = '一覧の「新規申請」から遷移する。送信前に確認ダイアログを挟む。';
    s2.nodes = [
      node('header', 0, 0, 960, 48, '備品貸出管理'),
      node('heading', 208, 80, 300, 32, '貸出申請', '', { level: '2' }),
      node('card', 208, 128, 448, 296, '申請内容'),
      node('select', 232, 160, 400, 56, '備品', '一覧で選んだ備品を初期値にする',
           { options: 'ノートPC\nプロジェクター\n会議室スピーカー', required: true }),
      node('datepicker', 232, 232, 184, 40, '開始日', '過去の日付は選べない'),
      node('datepicker', 440, 232, 184, 40, '返却予定日', '開始日より前は選べない'),
      node('textarea', 232, 296, 400, 104, '利用目的', '', { placeholder: '例: 客先での製品デモに使用' }),
      node('button', 208, 448, 148, 40, '申請する', '押すと確認ダイアログを開く', { variant: 'primary' }),
      node('button', 372, 448, 120, 40, '戻る', '', { variant: 'ghost' }),
      // 確認ダイアログ（重ねて表示する。一覧の上に出る想定なので右側に置いてある）
      node('modal', 496, 128, 400, 224, '送信確認', '「申請する」を押したときだけ表示する'),
      node('text', 520, 192, 352, 44, 'この内容で申請します。よろしいですか。'),
      node('checkbox', 520, 256, 320, 24, '申請内容をメールで受け取る', '', { checked: true })
    ];

    // 一覧の「新規申請」から申請画面へ、「戻る」で一覧へ
    s1.nodes[5].link = s2.id;
    s2.nodes[8].link = s1.id;

    d.screens = [s1, s2];

    d.features = [
      {
        id: SB.uid('f'), name: '備品の検索と一覧表示', priority: '必須',
        description: '登録されている備品を一覧で表示する。名称での絞り込みと、状態（貸出可・貸出中）での絞り込みができる。',
        acceptance: [
          '名称の一部を入力すると、該当する備品だけが表示される',
          '在庫が0の備品は申請ボタンを押せない',
          '1件も該当しないときは「該当する備品がありません」と表示される'
        ],
        notes: '', screens: [s1.id]
      },
      {
        id: SB.uid('f'), name: '貸出申請', priority: '必須',
        description: '備品・開始日・返却予定日・利用目的を入力して申請する。申請すると総務担当に通知が届き、承認待ちになる。',
        acceptance: [
          '返却予定日に開始日より前の日付は選べない',
          '申請するとその備品の在庫が1つ減る',
          '送信前に確認ダイアログが表示される'
        ],
        notes: '同じ備品を同じ期間に重複して申請することはできない', screens: [s2.id]
      },
      {
        id: SB.uid('f'), name: '総務担当による承認', priority: '必須',
        description: '総務担当は申請の一覧を見て、承認または却下できる。却下するときは理由を入力する。',
        acceptance: ['却下時は理由の入力が必須', '承認・却下の結果が申請者に通知される'],
        notes: '', screens: []
      },
      {
        id: SB.uid('f'), name: '貸出履歴のCSV出力', priority: '推奨',
        description: '期間を指定して、貸出履歴をCSVで書き出せる。',
        acceptance: ['文字コードはUTF-8（BOM付き）で出力する'],
        notes: '', screens: []
      }
    ];

    d.data = [
      {
        id: SB.uid('e'), name: '備品', description: '貸出の対象となる物品1件',
        fields: [
          { id: SB.uid('fl'), name: '名称', type: 'text', required: true, note: '' },
          { id: SB.uid('fl'), name: '分類', type: '選択肢', required: true, note: 'PC / 什器 / AV機器' },
          { id: SB.uid('fl'), name: '在庫数', type: '数値', required: true, note: '0以上' },
          { id: SB.uid('fl'), name: '備考', type: '長文', required: false, note: '' }
        ]
      },
      {
        id: SB.uid('e'), name: '貸出申請', description: '誰がいつ何を借りるかの申請1件',
        fields: [
          { id: SB.uid('fl'), name: '申請者', type: '参照', required: true, note: '社員を参照' },
          { id: SB.uid('fl'), name: '備品', type: '参照', required: true, note: '備品を参照' },
          { id: SB.uid('fl'), name: '開始日', type: '日付', required: true, note: '' },
          { id: SB.uid('fl'), name: '返却予定日', type: '日付', required: true, note: '開始日以降' },
          { id: SB.uid('fl'), name: '状態', type: '選択肢', required: true, note: '申請中 / 承認 / 却下 / 返却済' },
          { id: SB.uid('fl'), name: '却下理由', type: '長文', required: false, note: '却下のときのみ必須' }
        ]
      },
      {
        id: SB.uid('e'), name: '社員', description: '利用者。社内LDAPから同期する',
        fields: [
          { id: SB.uid('fl'), name: '氏名', type: 'text', required: true, note: '' },
          { id: SB.uid('fl'), name: 'メールアドレス', type: 'メール', required: true, note: '' },
          { id: SB.uid('fl'), name: '総務担当か', type: '真偽', required: true, note: '承認権限の有無' }
        ]
      }
    ];

    d.api = {
      style: 'REST',
      auth: '既存の認証を流用',
      external: '承認依頼と結果の通知をSlackに送る（Incoming Webhook）。社員情報は社内LDAPから日次で同期する。',
      endpoints: [
        { id: SB.uid('ep'), method: 'GET', path: '/api/items', purpose: '備品を検索して一覧を返す',
          request: 'q(検索語), status, page', response: '200 { items: [...], total }' },
        { id: SB.uid('ep'), method: 'POST', path: '/api/requests', purpose: '貸出申請を登録する',
          request: '{ itemId, from, to, purpose }', response: '201 { id, status: "申請中" }' },
        { id: SB.uid('ep'), method: 'PATCH', path: '/api/requests/:id', purpose: '申請を承認または却下する',
          request: '{ status, reason? }', response: '200 { id, status }' }
      ]
    };

    d.flows = [
      {
        id: SB.uid('fw'), name: '申請から返却まで', trigger: '社員が「申請する」を押したとき',
        steps: [
          '在庫を確認し、0であればエラーを表示して中断する',
          '同じ備品・同じ期間の申請がないか確認する',
          '申請を「申請中」で登録し、在庫を1つ減らす',
          '総務担当にSlackで通知する',
          '総務担当が承認または却下する',
          '結果を申請者に通知する',
          '返却が登録されたら在庫を1つ戻す'
        ],
        exceptions: '承認されないまま3日経過したら、総務担当に再通知する。却下された場合は在庫を戻す。'
      }
    ];

    d.quality = {
      performance: '一覧は1000件でも2秒以内に表示する',
      security: '認証必須。他人の申請は参照・編集できないこと。総務担当のみ承認できること。',
      accessibility: 'キーボードだけで申請を完了できること。コントラスト比4.5:1以上。',
      browsers: 'Chrome / Edge の最新版',
      i18n: '日本語のみ。日付は YYYY/MM/DD 表記。',
      logging: '承認・却下の操作は誰がいつ行ったかを記録する。個人情報はログに残さない。',
      testing: '在庫計算と重複チェックのロジックには単体テストを付ける。',
      checks: [
        'エラー時にユーザーへ理由を表示する',
        '入力値のバリデーションを行う',
        '処理中のローディング表示を出す',
        'データ0件のときの空状態を表示する',
        'スマートフォンでも崩れないようにする',
        '権限による表示・操作の制御を行う',
        '重要操作の前に確認を挟む',
        '単体テストを書く'
      ]
    };

    d.rules = {
      style: '1ファイルは300行以内に収める。関数名は動詞から始める。過度な抽象化はしない。',
      must: [
        '不明点があれば実装前に質問する',
        '変更したファイルの一覧を最後に示す',
        '動作確認の手順を書く',
        '段階的に進め、区切りごとに報告する'
      ],
      mustNot: [
        '指示にない機能を勝手に追加しない',
        '説明のためにコードを省略しない（全文を出す）',
        '推測で仕様を決めない'
      ],
      deliverForm: 'ファイルごとに全文を出す',
      askWhen: '仕様が2通りに読めるときは、両方の案と推奨を示してから進める',
      language: '日本語'
    };

    return d;
  };

})(window.SB);
