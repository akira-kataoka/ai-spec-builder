/* 状態管理 — 指示書ドキュメントの保持・保存・復元 */

window.SB = window.SB || {};

(function (SB) {
  'use strict';

  var STORAGE_KEY = 'ai-spec-builder:doc:v1';
  var BACKUP_KEY = 'ai-spec-builder:doc:v1:backup';
  var THEME_KEY = 'ai-spec-builder:theme';

  SB.STORAGE_KEY = STORAGE_KEY;

  SB.uid = function (prefix) {
    return (prefix || 'id') + '-' + Math.random().toString(36).slice(2, 9);
  };

  SB.clone = function (v) {
    return JSON.parse(JSON.stringify(v));
  };

  /* ---------- セクション定義（左ナビと画面タイトル） ---------- */

  SB.SECTIONS = [
    { key: 'basic',    label: '基本情報',     hint: 'AIが最初に読む前提です。ここだけでも埋まっていれば指示書として成立します。' },
    { key: 'purpose',  label: '背景と目的',   hint: 'なぜ作るのか。判断に迷ったときAIが立ち返る基準になります。' },
    { key: 'stack',    label: '技術と制約',   hint: '使う技術と、守ってほしい制約を指定します。' },
    { key: 'features', label: '機能要件',     hint: '実装してほしい機能を1件ずつ、受け入れ条件付きで書きます。' },
    { key: 'screens',  label: '画面設計',     hint: '図形を置いて画面を作ります。座標と注釈が文章としても出力されます。' },
    { key: 'data',     label: 'データモデル', hint: '扱うデータの構造。テーブルや型を決めておくと手戻りが減ります。' },
    { key: 'api',      label: 'API・連携',    hint: 'エンドポイントや外部サービス連携の仕様です。' },
    { key: 'flows',    label: '処理フロー',   hint: '手順のある処理を、番号付きのステップで書きます。' },
    { key: 'quality',  label: '非機能要件',   hint: '性能・セキュリティ・対応環境など、品質面の要求です。' },
    { key: 'rules',    label: '進め方',       hint: 'AIへの作業ルール。やってほしいこと／やってほしくないこと。' },
    { key: 'output',   label: '出力',         hint: '指示書を Markdown で確認し、コピーまたはダウンロードします。' }
  ];

  /* ---------- 既定ドキュメント ---------- */

  SB.defaultDoc = function () {
    return {
      version: 1,
      updatedAt: '',
      basic: {
        projectName: '',
        summary: '',
        kind: '',
        users: '',
        deliverable: '',
        deadline: '',
        repo: ''
      },
      purpose: {
        background: '',
        goals: [],
        nonGoals: [],
        metrics: ''
      },
      stack: {
        platform: [],
        language: [],
        frontend: [],
        backend: [],
        storage: [],
        infra: [],
        freeText: '',
        constraints: '',
        existing: ''
      },
      features: [],
      screens: [],
      data: [],
      api: {
        style: '',
        auth: '',
        endpoints: [],
        external: ''
      },
      flows: [],
      quality: {
        performance: '',
        security: '',
        accessibility: '',
        browsers: '',
        i18n: '',
        logging: '',
        testing: '',
        checks: []
      },
      rules: {
        style: '',
        must: [],
        mustNot: [],
        deliverForm: '',
        askWhen: '',
        language: '日本語'
      },
      options: {
        roleHeader: true,   // AIへの役割・進め方の指示を先頭に付ける
        coords: true,       // 座標一覧を付ける
        gaps: true,         // 指定していないことをまとめる
        questions: true     // 実装前に確認してほしいことを付ける
      }
    };
  };

  /* ---------- 新規テンプレート ---------- */

  SB.MIN_NODE = 8;      // 部品の最小辺
  SB.MAX_CANVAS = 8000; // 画面と部品の最大辺（暴走した値でブラウザを固めないため）

  SB.newFeature = function () {
    return { id: SB.uid('f'), name: '', priority: '必須', description: '', acceptance: [], notes: '', screens: [] };
  };

  SB.newScreen = function (name) {
    return {
      id: SB.uid('s'),
      name: name || '新しい画面',
      device: 'desktop',
      route: '',
      description: '',
      width: 960,
      height: 640,
      nodes: []
    };
  };

  SB.newEntity = function () {
    return { id: SB.uid('e'), name: '', description: '', fields: [] };
  };

  SB.newField = function () {
    return { id: SB.uid('fl'), name: '', type: 'text', required: false, note: '' };
  };

  SB.newEndpoint = function () {
    return { id: SB.uid('ep'), method: 'GET', path: '', purpose: '', request: '', response: '' };
  };

  SB.newFlow = function () {
    return { id: SB.uid('fw'), name: '', trigger: '', steps: [], exceptions: '' };
  };

  SB.DEVICES = [
    { value: 'desktop', label: 'PC', width: 960, height: 640 },
    { value: 'tablet',  label: 'タブレット', width: 768, height: 1024 },
    { value: 'mobile',  label: 'スマートフォン', width: 375, height: 720 }
  ];

  SB.FIELD_TYPES = ['text', '長文', '数値', '真偽', '日付', '日時', 'メール', 'URL', '選択肢', '参照', 'ファイル', 'JSON'];

  /* ---------- 保存と復元 ---------- */

  SB.doc = SB.defaultDoc();

  /* 読み込んだ JSON は信用しない。既定の形に合わせて作り直す。
     項目が欠けていても、型が違っても、余計なものが混ざっていても壊れないようにする。 */

  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

  function asText(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return '';
    return String(v);
  }

  function asStrArray(v) {
    if (Array.isArray(v)) {
      return v.filter(function (x) { return x !== null && x !== undefined && typeof x !== 'object'; })
              .map(String);
    }
    if (typeof v === 'string' && v !== '') return v.split('\n');
    return [];
  }

  function asNum(v, def, min, max) {
    var n = typeof v === 'number' ? v : parseFloat(v);
    if (isNaN(n) || !isFinite(n)) return def;
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    return n;
  }

  function asList(v, limit) {
    if (!Array.isArray(v)) return [];
    return v.slice(0, limit || 500);
  }

  // テンプレートの形に src を流し込む（文字列/配列/真偽/数値を型ごとに補正）
  function shape(tpl, src) {
    var out = SB.clone(tpl);
    if (!isObj(src)) return out;
    Object.keys(out).forEach(function (k) {
      var v = src[k];
      if (v === undefined || v === null) return;
      if (Array.isArray(out[k])) out[k] = asStrArray(v);
      else if (typeof out[k] === 'boolean') out[k] = v === true || v === 'true' || v === 1;
      else if (typeof out[k] === 'number') out[k] = asNum(v, out[k]);
      else out[k] = asText(v);
    });
    if (typeof src.id === 'string' && src.id) out.id = src.id;
    return out;
  }

  function migrate(doc) {
    var base = SB.defaultDoc();
    if (!isObj(doc)) return base;

    base.basic = shape(base.basic, doc.basic);
    base.purpose = shape(base.purpose, doc.purpose);
    base.stack = shape(base.stack, doc.stack);
    base.quality = shape(base.quality, doc.quality);
    base.rules = shape(base.rules, doc.rules);
    base.options = shape(base.options, doc.options);

    base.api = shape({ style: '', auth: '', external: '' }, doc.api);
    base.api.endpoints = asList(isObj(doc.api) ? doc.api.endpoints : null)
      .map(function (x) { return shape(SB.newEndpoint(), x); });

    base.features = asList(doc.features).map(function (x) {
      var f = shape(SB.newFeature(), x);
      if (['必須', '推奨', '任意', '将来対応'].indexOf(f.priority) < 0) f.priority = '必須';
      f.screens = asStrArray(isObj(x) ? x.screens : null);
      return f;
    });

    base.data = asList(doc.data).map(function (x) {
      var e = shape({ id: SB.uid('e'), name: '', description: '' }, x);
      e.fields = asList(isObj(x) ? x.fields : null).map(function (y) {
        var fl = shape(SB.newField(), y);
        if (SB.FIELD_TYPES.indexOf(fl.type) < 0) fl.type = 'text';
        return fl;
      });
      return e;
    });

    base.flows = asList(doc.flows).map(function (x) {
      return shape(SB.newFlow(), x);
    });

    base.screens = asList(doc.screens, 200).map(function (x) {
      var sc = shape({ id: SB.uid('s'), name: '', device: 'desktop', route: '', description: '' }, x);
      if (!sc.name) sc.name = '無題の画面';
      var dev = SB.DEVICES.filter(function (d) { return d.value === sc.device; })[0];
      if (!dev) { sc.device = 'desktop'; dev = SB.DEVICES[0]; }
      sc.width = asNum(isObj(x) ? x.width : null, dev.width, 200, SB.MAX_CANVAS);
      sc.height = asNum(isObj(x) ? x.height : null, dev.height, 200, SB.MAX_CANVAS);
      sc.nodes = asList(isObj(x) ? x.nodes : null, 2000).map(function (n) {
        if (!isObj(n)) return null;
        var type = asText(n.type);
        if (!SB.shapes || !SB.shapes[type]) return null;
        var def = SB.shapes[type];
        var node = {
          id: asText(n.id) || SB.uid('n'),
          type: type,
          x: asNum(n.x, 0, 0, SB.MAX_CANVAS),
          y: asNum(n.y, 0, 0, SB.MAX_CANVAS),
          w: asNum(n.w, def.w, SB.MIN_NODE, SB.MAX_CANVAS),
          h: asNum(n.h, def.h, SB.MIN_NODE, SB.MAX_CANVAS),
          label: asText(n.label),
          note: asText(n.note),
          link: asText(n.link),
          props: {}
        };
        if (isObj(n.props)) {
          Object.keys(n.props).forEach(function (k) {
            var v = n.props[k];
            if (v === null || v === undefined) return;
            node.props[k] = typeof v === 'object' ? '' : v;
          });
        }
        return node;
      }).filter(Boolean);
      return sc;
    });

    return base;
  }

  // 読み込もうとしている JSON がこのアプリのものらしいか
  SB.looksLikeDoc = function (obj) {
    if (!isObj(obj)) return false;
    return ['basic', 'features', 'screens', 'purpose', 'stack', 'rules'].some(function (k) {
      return obj[k] !== undefined;
    });
  };

  SB.load = function () {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      SB.doc = migrate(JSON.parse(raw));
      return true;
    } catch (e) {
      return false;
    }
  };

  var saveTimer = null;
  SB.saveFailed = false;
  SB.dirty = false;

  SB.save = function (immediate) {
    SB.dirty = true;
    clearTimeout(saveTimer);
    saveTimer = null;
    var run = function () {
      saveTimer = null;
      var stamp = new Date().toISOString();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(SB.doc));
        SB.doc.updatedAt = stamp;
        SB.dirty = false;
        SB.saveFailed = false;
        if (SB.onSaved) SB.onSaved(stamp);
      } catch (e) {
        var first = !SB.saveFailed;
        SB.saveFailed = true;
        if (SB.onSaveError) SB.onSaveError(e, first);
      }
    };
    if (immediate) run(); else saveTimer = setTimeout(run, 400);
  };

  // 保存待ちがあるときだけ書き出す。
  // 無条件に保存すると、別タブで進めた内容を古い内容で踏み潰してしまう。
  SB.flush = function () {
    if (saveTimer === null && !SB.dirty) return;
    SB.save(true);
  };

  /* 元に戻せない操作の直前に、1世代だけ退避しておく */
  SB.backup = function () {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) localStorage.setItem(BACKUP_KEY, raw);
      return !!raw;
    } catch (e) { return false; }
  };

  SB.hasBackup = function () {
    try { return !!localStorage.getItem(BACKUP_KEY); } catch (e) { return false; }
  };

  SB.restoreBackup = function () {
    try {
      var raw = localStorage.getItem(BACKUP_KEY);
      if (!raw) return false;
      SB.doc = migrate(JSON.parse(raw));
      localStorage.removeItem(BACKUP_KEY);
      fireDocReplaced();
      SB.save(true);
      return true;
    } catch (e) { return false; }
  };

  // ドキュメントが丸ごと入れ替わったことを各画面に知らせる（編集履歴などを捨てるため）
  SB.docReplacedHandlers = [];
  SB.onDocReplaced = function (fn) { SB.docReplacedHandlers.push(fn); };
  function fireDocReplaced() {
    SB.docReplacedHandlers.forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  SB.reset = function () {
    SB.backup();
    SB.doc = SB.defaultDoc();
    fireDocReplaced();
    SB.save(true);
  };

  SB.replaceDoc = function (obj) {
    SB.backup();
    SB.doc = migrate(obj || {});
    fireDocReplaced();
    SB.save(true);
  };

  // localStorage が使えるか（プライベートブラウジング等の判定）
  SB.storageAvailable = (function () {
    try {
      localStorage.setItem('__t', '1');
      localStorage.removeItem('__t');
      return true;
    } catch (e) { return false; }
  })();

  /* ---------- テーマ ---------- */

  SB.getTheme = function () {
    try { return localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { return 'light'; }
  };
  SB.setTheme = function (t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  };

  /* ---------- 入力の充足度（進捗バー用） ---------- */

  function filled(v) {
    if (v === null || v === undefined) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'string') return v.trim() !== '';
    return !!v;
  }

  SB.sectionStatus = function (key) {
    var d = SB.doc;
    switch (key) {
      case 'basic':
        return { done: filled(d.basic.projectName) && filled(d.basic.summary), count: 0 };
      case 'purpose':
        return { done: filled(d.purpose.background) || d.purpose.goals.length > 0, count: d.purpose.goals.length };
      case 'stack':
        return {
          done: d.stack.platform.length + d.stack.language.length + d.stack.frontend.length +
                d.stack.backend.length + d.stack.storage.length + d.stack.infra.length > 0 || filled(d.stack.freeText),
          count: 0
        };
      case 'features':
        return { done: d.features.length > 0, count: d.features.length };
      case 'screens':
        return { done: d.screens.length > 0, count: d.screens.length };
      case 'data':
        return { done: d.data.length > 0, count: d.data.length };
      case 'api':
        return { done: d.api.endpoints.length > 0 || filled(d.api.external) || filled(d.api.style), count: d.api.endpoints.length };
      case 'flows':
        return { done: d.flows.length > 0, count: d.flows.length };
      case 'quality':
        return {
          done: d.quality.checks.length > 0 || filled(d.quality.performance) || filled(d.quality.security),
          count: 0
        };
      case 'rules':
        return { done: d.rules.must.length > 0 || d.rules.mustNot.length > 0 || filled(d.rules.style), count: 0 };
      default:
        return { done: false, count: 0 };
    }
  };

  SB.completion = function () {
    var keys = SB.SECTIONS.filter(function (s) { return s.key !== 'output'; });
    var done = keys.filter(function (s) { return SB.sectionStatus(s.key).done; }).length;
    return Math.round((done / keys.length) * 100);
  };

  SB.nodeCount = function () {
    return SB.doc.screens.reduce(function (a, s) { return a + (s.nodes ? s.nodes.length : 0); }, 0);
  };

})(window.SB);
