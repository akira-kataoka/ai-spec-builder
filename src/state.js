/* 状態管理 — 指示書ドキュメントの保持・保存・復元 */

window.SB = window.SB || {};

(function (SB) {
  'use strict';

  var STORAGE_KEY = 'ai-spec-builder:doc:v1';
  var THEME_KEY = 'ai-spec-builder:theme';

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
      }
    };
  };

  /* ---------- 新規テンプレート ---------- */

  SB.newFeature = function () {
    return { id: SB.uid('f'), name: '', priority: '必須', description: '', acceptance: [], notes: '' };
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

  function migrate(doc) {
    var base = SB.defaultDoc();
    // 既定オブジェクトに読み込み値を重ねて、項目追加があっても壊れないようにする
    Object.keys(base).forEach(function (k) {
      if (doc[k] === undefined || doc[k] === null) return;
      if (Array.isArray(base[k])) {
        base[k] = Array.isArray(doc[k]) ? doc[k] : base[k];
      } else if (typeof base[k] === 'object') {
        Object.keys(base[k]).forEach(function (sub) {
          if (doc[k][sub] !== undefined && doc[k][sub] !== null) base[k][sub] = doc[k][sub];
        });
      } else {
        base[k] = doc[k];
      }
    });
    (base.screens || []).forEach(function (sc) {
      sc.nodes = sc.nodes || [];
      sc.nodes.forEach(function (n) { n.props = n.props || {}; });
    });
    return base;
  }

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
  SB.save = function (immediate) {
    clearTimeout(saveTimer);
    var run = function () {
      SB.doc.updatedAt = new Date().toISOString();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(SB.doc));
        if (SB.onSaved) SB.onSaved(SB.doc.updatedAt);
      } catch (e) {
        if (SB.onSaveError) SB.onSaveError(e);
      }
    };
    if (immediate) run(); else saveTimer = setTimeout(run, 400);
  };

  SB.reset = function () {
    SB.doc = SB.defaultDoc();
    SB.save(true);
  };

  SB.replaceDoc = function (obj) {
    SB.doc = migrate(obj || {});
    SB.save(true);
  };

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
