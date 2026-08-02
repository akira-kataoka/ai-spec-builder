/* =========================================================
 * AI指示書ビルダー - shapes.js
 * 画面ワイヤーフレーム部品を SVG 文字列として描画するライブラリ。
 * 依存ゼロ・非モジュール・file:// 対応。window.SB にぶら下げる。
 * 各 draw(n) はローカル座標 (0,0) 起点の SVG 断片文字列を返す。
 * ========================================================= */
(function () {
  'use strict';

  window.SB = window.SB || {};
  var SB = window.SB;

  SB.palette = {
    stroke:  '#94a3b8',   // 部品の枠線
    strokeStrong: '#475569',
    fill:    '#ffffff',   // 部品の下地
    fillMuted: '#f1f5f9', // ヘッダ行など薄い塗り
    fillAccent: '#2563eb',// ボタンなど強調
    textOn:  '#ffffff',   // 強調塗りの上の文字
    text:    '#0f172a',   // 通常文字
    textMuted: '#64748b', // プレースホルダ・補助文字
    note:    '#fef3c7',   // 注釈付箋の下地
    noteStroke: '#f59e0b',
    noteText: '#78350f',
    accentSoft: '#dbeafe'
  };

  var P = SB.palette;
  var FONT = "system-ui, -apple-system, 'Segoe UI', 'Yu Gothic UI', 'Hiragino Sans', Meiryo, sans-serif";
  var LIGHT = '#e2e8f0';  // ダミー線などのごく薄いグレー
  var GRAY  = '#cbd5e1';  // シルエットなど中間グレー
  var RED   = '#dc2626';  // 注釈マーカー・危険操作

  /* ---------------- 共通ヘルパ ---------------- */

  // XML 実体参照エスケープ
  function esc(s) {
    // XML に置けない制御文字を先に落とす（1文字混ざるだけでSVG全体が描画不能になる）
    return String(s == null ? '' : s)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
  }

  // 絵文字や結合文字を途中で切らないための分割
  function chars(s) {
    s = String(s == null ? '' : s);
    return typeof Array.from === 'function' ? Array.from(s) : s.split('');
  }

  // 文字の概算幅（全角=fontSize, 半角=fontSize*0.55）
  function charW(ch, fs) {
    return ch.charCodeAt(0) > 0xFF ? fs : fs * 0.55;
  }

  function textWidth(s, fs) {
    var a = chars(s), w = 0;
    for (var i = 0; i < a.length; i++) w += charW(a[i], fs);
    return w;
  }

  // 幅に収まらない長文を切り詰めて「…」を付ける
  function clip(s, width, fontSize) {
    var a = chars(s);
    if (width <= 0) return '';
    if (textWidth(a.join(''), fontSize) <= width) return a.join('');
    var out = '', w = 0;
    for (var i = 0; i < a.length; i++) {
      var cw = charW(a[i], fontSize);
      if (w + cw + fontSize > width) break; // 「…」1文字分を確保
      out += a[i];
      w += cw;
    }
    return out + '…';
  }

  // 幅で折り返して行配列にする（改行文字も尊重する）
  function wrap(s, width, fontSize, maxLines) {
    var src = String(s == null ? '' : s).split('\n');
    var out = [];
    if (width <= 0) return out;
    for (var i = 0; i < src.length; i++) {
      var a = chars(src[i]);
      var cur = '', w = 0;
      for (var j = 0; j < a.length; j++) {
        var cw = charW(a[j], fontSize);
        if (w + cw > width && cur !== '') {
          out.push(cur); cur = ''; w = 0;
          if (maxLines && out.length >= maxLines) return out;
        }
        cur += a[j]; w += cw;
      }
      out.push(cur);
      if (maxLines && out.length >= maxLines) return out;
    }
    return out;
  }

  function f2(v) { return Math.round(v * 100) / 100; }

  // 極端に小さくリサイズされて中身を描けないときの最小表現
  function thin(n) {
    return '<rect x="0.5" y="0.5" width="' + f2(Math.max(1, n.w - 1)) + '" height="' + f2(Math.max(1, n.h - 1)) +
      '" rx="3" fill="none" stroke="' + P.stroke + '" stroke-dasharray="3 3"/>';
  }

  // <text> 生成。y は縦中央（dominant-baseline="central"）
  function txt(x, y, s, fs, fill, extra) {
    return '<text x="' + f2(x) + '" y="' + f2(y) + '" font-size="' + fs +
      '" fill="' + fill + '" font-family="' + FONT +
      '" dominant-baseline="central"' + (extra || '') + '>' + esc(s) + '</text>';
  }

  function rc(x, y, w, h, fill, stroke, rx, extra) {
    return '<rect x="' + f2(x) + '" y="' + f2(y) + '" width="' + f2(Math.max(0, w)) +
      '" height="' + f2(Math.max(0, h)) + '"' +
      (rx ? ' rx="' + rx + '"' : '') +
      ' fill="' + (fill || 'none') + '"' +
      (stroke ? ' stroke="' + stroke + '"' : '') +
      (extra || '') + '/>';
  }

  function ln(x1, y1, x2, y2, stroke, sw, extra) {
    return '<line x1="' + f2(x1) + '" y1="' + f2(y1) + '" x2="' + f2(x2) + '" y2="' + f2(y2) +
      '" stroke="' + stroke + '" stroke-width="' + (sw || 1) + '"' + (extra || '') + '/>';
  }

  function cir(cx, cy, r, fill, stroke, extra) {
    return '<circle cx="' + f2(cx) + '" cy="' + f2(cy) + '" r="' + f2(Math.max(0, r)) +
      '" fill="' + (fill || 'none') + '"' +
      (stroke ? ' stroke="' + stroke + '"' : '') + (extra || '') + '/>';
  }

  // 本文ダミー線（薄い横バー）。maxY に収まる分だけ描く
  function dummyLines(x, y, w, maxY) {
    var out = '', i = 0;
    if (w < 20) return out;
    while (y + 6 <= maxY) {
      var lw = (i % 3 === 2) ? w * 0.6 : w;
      out += rc(x, y, lw, 6, LIGHT, null, 3);
      y += 14;
      i++;
    }
    return out;
  }

  /* ---- props 取得ヘルパ（未設定はデフォルトにフォールバック） ---- */

  function pv(n, key, def) {
    var p = n.props || {};
    var v = p[key];
    return (v === undefined || v === null || v === '') ? def : v;
  }

  // 数値 props。壊れた値・極端な値でも描画が破綻しないよう必ず範囲に収める
  function pnum(n, key, def, min, max) {
    var v = parseFloat(pv(n, key, def));
    if (isNaN(v) || !isFinite(v)) return def;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    return v;
  }

  function pint(n, key, def, min, max) {
    return Math.round(pnum(n, key, def, min, max));
  }

  function pbool(n, key) {
    var v = (n.props || {})[key];
    return v === true || v === 'true' || v === 1;
  }

  // textarea 型 props: 改行で分割し空行を除去。中身が空ならデフォルトに戻す
  function plines(n, key, def) {
    function split(v) {
      return String(v).split('\n')
        .map(function (s) { return s.replace(/^\s+|\s+$/g, ''); })
        .filter(function (s) { return s !== ''; });
    }
    var out = split(pv(n, key, def));
    return out.length ? out : split(def);
  }

  // id を SVG の id 属性に使える形へ（非ASCIIのidでも衝突しないよう連番を足す）
  var idSeq = 0;
  function safeId(n, prefix) {
    var base = String(n && n.id || '').replace(/[^A-Za-z0-9_-]/g, '');
    return prefix + (base || 'x') + '-' + (++idSeq);
  }

  // ラベルを「…」で囲む（空なら空文字）
  function q(label) { return label ? '「' + label + '」' : ''; }

  // 改行を潰して 1 行にする（describe 用）
  function oneline(s) { return String(s || '').replace(/\n+/g, ' '); }

  /* ---------------- 部品定義 ---------------- */

  SB.shapes = {

    /* ============ レイアウト ============ */

    container: {
      name: 'グループ枠', category: 'レイアウト', w: 240, h: 160, props: [],
      draw: function (n) {
        var s = rc(0, 0, n.w, n.h, 'none', P.stroke, 6, ' stroke-dasharray="6 4"');
        if (n.label) s += txt(8, 12, clip(n.label, n.w - 16, 11), 11, P.textMuted);
        return s;
      },
      describe: function (n) { return n.label ? 'グループ枠' + q(n.label) : 'グループ枠'; }
    },

    card: {
      name: 'カード', category: 'レイアウト', w: 220, h: 140, props: [],
      draw: function (n) {
        var s = rc(0, 0, n.w, n.h, P.fill, P.stroke, 8);
        s += txt(12, 18, clip(n.label || 'カード', n.w - 24, 13), 13, P.text, ' font-weight="bold"');
        s += dummyLines(12, 34, n.w - 24, n.h - 10);
        return s;
      },
      describe: function (n) { return n.label ? 'カード' + q(n.label) : 'カード'; }
    },

    divider: {
      name: '区切り線', category: 'レイアウト', w: 240, h: 8, props: [],
      draw: function (n) {
        return ln(0, n.h / 2, n.w, n.h / 2, P.stroke, 1);
      },
      describe: function () { return '区切り線'; }
    },

    spacer: {
      name: '余白', category: 'レイアウト', w: 240, h: 24, props: [],
      draw: function (n) {
        // 薄い斜線ハッチ（45度）。枠は描かない
        var s = '', step = 12;
        for (var x0 = -n.h; x0 < n.w; x0 += step) {
          // 線分 (x0,0)-(x0+h,h) を 0<=x<=w に切り詰める
          var ys = Math.max(0, -x0);
          var ye = Math.min(n.h, n.w - x0);
          if (ye > ys) s += ln(x0 + ys, ys, x0 + ye, ye, LIGHT, 1);
        }
        return s;
      },
      describe: function () { return '余白'; }
    },

    modal: {
      name: 'モーダル', category: 'レイアウト', w: 320, h: 200, props: [],
      draw: function (n) {
        var hh = 32;
        var s = rc(0, 0, n.w, n.h, P.fill, null, 10);
        s += rc(0, 0, n.w, hh, P.fillMuted, null, 10);
        s += rc(0, hh - 10, n.w, 10, P.fillMuted);
        s += ln(0, hh, n.w, hh, P.stroke, 1);
        s += txt(12, hh / 2, clip(n.label || 'ダイアログ', n.w - 48, 13), 13, P.text, ' font-weight="bold"');
        // 右上の閉じる（×）
        var cx = n.w - 16, cy = hh / 2;
        s += ln(cx - 4, cy - 4, cx + 4, cy + 4, P.textMuted, 1.5, ' stroke-linecap="round"');
        s += ln(cx - 4, cy + 4, cx + 4, cy - 4, P.textMuted, 1.5, ' stroke-linecap="round"');
        // 本文ダミー線と下部ボタン
        var hasBtns = n.h >= 100 && n.w >= 180;   // 幅が足りないとボタンが枠外へ出るため描かない
        s += dummyLines(14, hh + 14, n.w - 28, n.h - (hasBtns ? 46 : 12));
        if (hasBtns) {
          var by = n.h - 34;
          s += rc(n.w - 160, by, 76, 24, P.fill, P.stroke, 5);
          s += txt(n.w - 122, by + 12, 'キャンセル', 11, P.text, ' text-anchor="middle"');
          s += rc(n.w - 76, by, 64, 24, P.fillAccent, null, 5);
          s += txt(n.w - 44, by + 12, 'OK', 11, P.textOn, ' text-anchor="middle"');
        }
        s += rc(0, 0, n.w, n.h, 'none', P.strokeStrong, 10);
        return s;
      },
      describe: function (n) { return n.label ? 'モーダルダイアログ' + q(n.label) : 'モーダルダイアログ'; }
    },

    section: {
      name: 'セクション', category: 'レイアウト', w: 280, h: 180, props: [],
      draw: function (n) {
        var hh = 26;
        var s = rc(0, 0, n.w, n.h, P.fill, null);
        s += rc(0, 0, n.w, hh, P.fillMuted);
        s += ln(0, hh, n.w, hh, P.stroke, 1);
        s += txt(10, hh / 2, clip(n.label || 'セクション', n.w - 20, 12.5), 12.5, P.text, ' font-weight="bold"');
        s += rc(0, 0, n.w, n.h, 'none', P.stroke);
        return s;
      },
      describe: function (n) { return n.label ? 'セクション' + q(n.label) : 'セクション'; }
    },

    /* ============ ナビゲーション ============ */

    header: {
      name: 'ヘッダーバー', category: 'ナビゲーション', w: 480, h: 48, props: [],
      draw: function (n) {
        var s = rc(0, 0, n.w, n.h, P.fill, P.stroke);
        s += txt(16, n.h / 2, clip(n.label || 'プロダクト名', n.w - 70, 14), 14, P.text, ' font-weight="bold"');
        var r = Math.min(12, n.h / 2 - 8);
        if (r > 3) s += cir(n.w - 12 - r, n.h / 2, r, GRAY, P.stroke);
        return s;
      },
      describe: function (n) { return n.label ? 'ヘッダーバー' + q(n.label) : 'ヘッダーバー'; }
    },

    sidebar: {
      name: 'サイドメニュー', category: 'ナビゲーション', w: 160, h: 300,
      props: [
        { key: 'items', label: 'メニュー項目(改行区切り)', type: 'textarea' }
      ],
      draw: function (n) {
        var items = plines(n, 'items', 'メニュー1\nメニュー2\nメニュー3');
        var s = rc(0, 0, n.w, n.h, P.fillMuted, P.stroke);
        var rowH = 30, y = 8;
        for (var i = 0; i < items.length; i++) {
          if (y + rowH > n.h - 4) break;
          if (i === 0) {
            s += rc(6, y, n.w - 12, rowH - 4, P.accentSoft, null, 5);
            s += txt(16, y + (rowH - 4) / 2, clip(items[i], n.w - 28, 13), 13, P.fillAccent, ' font-weight="bold"');
          } else {
            s += txt(16, y + (rowH - 4) / 2, clip(items[i], n.w - 28, 13), 13, P.text);
          }
          y += rowH;
        }
        return s;
      },
      describe: function (n) {
        var items = plines(n, 'items', 'メニュー1\nメニュー2\nメニュー3');
        return 'サイドメニュー' + q(n.label) + ' 項目: ' + items.join(' / ');
      }
    },

    tabs: {
      name: 'タブ', category: 'ナビゲーション', w: 320, h: 36,
      props: [
        { key: 'items', label: 'タブ項目(改行区切り)', type: 'textarea' },
        { key: 'active', label: '選択中の番号(0始まり)', type: 'number', min: 0, max: 20 }
      ],
      draw: function (n) {
        var items = plines(n, 'items', 'タブ1\nタブ2\nタブ3');
        var active = pint(n, 'active', 0, 0, 99);
        var s = ln(0, n.h - 1, n.w, n.h - 1, P.stroke, 1);
        var x = 0;
        for (var i = 0; i < items.length; i++) {
          var tabW = textWidth(items[i], 13) + 24;
          if (x + tabW > n.w && i > 0) break;
          var isActive = (i === active);
          s += txt(x + tabW / 2, n.h / 2 - 2, clip(items[i], tabW - 8, 13), 13,
            isActive ? P.text : P.textMuted,
            ' text-anchor="middle"' + (isActive ? ' font-weight="bold"' : ''));
          if (isActive) s += rc(x + 4, n.h - 3, tabW - 8, 3, P.fillAccent, null, 1.5);
          x += tabW;
        }
        return s;
      },
      describe: function (n) {
        var items = plines(n, 'items', 'タブ1\nタブ2\nタブ3');
        var active = pint(n, 'active', 0, 0, 99);
        var cur = items[active] || items[0] || '';
        return 'タブ: ' + items.join(' / ') + (cur ? ' (選択中: ' + cur + ')' : '');
      }
    },

    breadcrumb: {
      name: 'パンくずリスト', category: 'ナビゲーション', w: 320, h: 24,
      props: [
        { key: 'items', label: '階層(改行区切り)', type: 'textarea' }
      ],
      draw: function (n) {
        var items = plines(n, 'items', 'ホーム\n一覧\n詳細');
        var s = '', x = 4, fs = 12;
        for (var i = 0; i < items.length; i++) {
          var wpart = textWidth(items[i], fs);
          if (x + Math.min(wpart, 40) > n.w - 8) break;
          var isLast = (i === items.length - 1);
          var shown = clip(items[i], n.w - 8 - x, fs);
          s += txt(x, n.h / 2, shown, fs, isLast ? P.text : P.textMuted,
            isLast ? ' font-weight="bold"' : '');
          x += textWidth(shown, fs);
          if (!isLast) {
            if (x + 24 > n.w - 8) break;
            s += txt(x + 8, n.h / 2, '>', fs, P.textMuted);
            x += 22;
          }
        }
        return s || thin(n);
      },
      describe: function (n) {
        var items = plines(n, 'items', 'ホーム\n一覧\n詳細');
        return 'パンくずリスト: ' + items.join(' > ');
      }
    },

    pagination: {
      name: 'ページネーション', category: 'ナビゲーション', w: 220, h: 32, props: [],
      draw: function (n) {
        var bh = 24, by = (n.h - bh) / 2;
        var total = 44 + 6 + (24 + 6) * 3 + 44; // 前へ + ページ3つ + 次へ
        var x = Math.max(0, (n.w - total) / 2);
        var s = rc(x, by, 44, bh, P.fill, P.stroke, 4);
        s += txt(x + 22, by + bh / 2, '前へ', 11, P.textMuted, ' text-anchor="middle"');
        x += 50;
        for (var i = 1; i <= 3; i++) {
          if (i === 1) {
            s += rc(x, by, 24, bh, P.fillAccent, null, 4);
            s += txt(x + 12, by + bh / 2, String(i), 11, P.textOn, ' text-anchor="middle"');
          } else {
            s += rc(x, by, 24, bh, P.fill, P.stroke, 4);
            s += txt(x + 12, by + bh / 2, String(i), 11, P.text, ' text-anchor="middle"');
          }
          x += 30;
        }
        s += rc(x, by, 44, bh, P.fill, P.stroke, 4);
        s += txt(x + 22, by + bh / 2, '次へ', 11, P.textMuted, ' text-anchor="middle"');
        return s;
      },
      describe: function () { return 'ページネーション(前へ / ページ番号 / 次へ)'; }
    },

    menu: {
      name: 'ドロップダウン', category: 'ナビゲーション', w: 160, h: 120,
      props: [
        { key: 'items', label: '項目(改行区切り)', type: 'textarea' }
      ],
      draw: function (n) {
        var items = plines(n, 'items', '項目1\n項目2\n項目3');
        var s = rc(0, 0, n.w, n.h, P.fill, P.stroke, 6);
        var rowH = 28, y = 6;
        for (var i = 0; i < items.length; i++) {
          if (y + rowH > n.h - 2) break;
          s += txt(12, y + rowH / 2, clip(items[i], n.w - 24, 12.5), 12.5, P.text);
          if (i < items.length - 1 && y + rowH * 2 <= n.h - 2) {
            s += ln(8, y + rowH, n.w - 8, y + rowH, LIGHT, 1);
          }
          y += rowH;
        }
        return s;
      },
      describe: function (n) {
        var items = plines(n, 'items', '項目1\n項目2\n項目3');
        return 'ドロップダウンメニュー' + q(n.label) + ' 項目: ' + items.join(' / ');
      }
    },

    /* ============ 入力 ============ */

    input: {
      name: '入力欄', category: '入力', w: 220, h: 56,
      props: [
        { key: 'placeholder', label: 'プレースホルダ', type: 'text' },
        { key: 'required', label: '必須', type: 'boolean' }
      ],
      draw: function (n) {
        var label = n.label || 'ラベル';
        var ph = pv(n, 'placeholder', '入力してください');
        var s = txt(0, 8, clip(label, n.w - 20, 11), 11, P.textMuted);
        if (pbool(n, 'required')) {
          s += txt(Math.min(textWidth(label, 11) + 4, n.w - 12), 8, '*', 12, RED, ' font-weight="bold"');
        }
        var by = 18, bh = Math.max(20, n.h - by);
        s += rc(0, by, n.w, bh, P.fill, P.stroke, 6);
        s += txt(10, by + bh / 2, clip(ph, n.w - 20, 12.5), 12.5, P.textMuted);
        return s;
      },
      describe: function (n) {
        if (!n.label) return '入力欄';
        var s = '入力欄' + q(n.label);
        var ph = (n.props || {}).placeholder;
        if (ph) s += ' プレースホルダ: ' + ph;
        if (pbool(n, 'required')) s += ' (必須)';
        return s;
      }
    },

    textarea: {
      name: '長文入力', category: '入力', w: 220, h: 100,
      props: [
        { key: 'placeholder', label: 'プレースホルダ', type: 'text' },
        { key: 'required', label: '必須', type: 'boolean' }
      ],
      draw: function (n) {
        var label = n.label || 'ラベル';
        var ph = pv(n, 'placeholder', '入力してください');
        var s = txt(0, 8, clip(label, n.w - 20, 11), 11, P.textMuted);
        if (pbool(n, 'required')) {
          s += txt(Math.min(textWidth(label, 11) + 4, n.w - 12), 8, '*', 12, RED, ' font-weight="bold"');
        }
        var by = 18, bh = Math.max(28, n.h - by);
        s += rc(0, by, n.w, bh, P.fill, P.stroke, 6);
        s += txt(10, by + 14, clip(ph, n.w - 20, 12.5), 12.5, P.textMuted);
        return s;
      },
      describe: function (n) {
        if (!n.label) return '複数行入力欄';
        var s = '複数行入力欄' + q(n.label);
        var ph = (n.props || {}).placeholder;
        if (ph) s += ' プレースホルダ: ' + ph;
        if (pbool(n, 'required')) s += ' (必須)';
        return s;
      }
    },

    select: {
      name: 'セレクトボックス', category: '入力', w: 220, h: 56,
      props: [
        { key: 'placeholder', label: 'プレースホルダ', type: 'text' },
        { key: 'options', label: '選択肢(改行区切り)', type: 'textarea' },
        { key: 'required', label: '必須', type: 'boolean' }
      ],
      draw: function (n) {
        var label = n.label || 'ラベル';
        var ph = pv(n, 'placeholder', '選択してください');
        var s = txt(0, 8, clip(label, n.w - 20, 11), 11, P.textMuted);
        if (pbool(n, 'required')) {
          s += txt(Math.min(textWidth(label, 11) + 4, n.w - 12), 8, '*', 12, RED, ' font-weight="bold"');
        }
        var by = 18, bh = Math.max(20, n.h - by);
        s += rc(0, by, n.w, bh, P.fill, P.stroke, 6);
        s += txt(10, by + bh / 2, clip(ph, n.w - 36, 12.5), 12.5, P.textMuted);
        var cy = by + bh / 2;
        s += '<polygon points="' + f2(n.w - 20) + ',' + f2(cy - 2.5) + ' ' + f2(n.w - 10) + ',' + f2(cy - 2.5) +
          ' ' + f2(n.w - 15) + ',' + f2(cy + 3.5) + '" fill="' + P.textMuted + '"/>';
        return s;
      },
      describe: function (n) {
        var s = n.label ? 'セレクトボックス' + q(n.label) : 'セレクトボックス';
        var opts = plines(n, 'options', '');
        if (opts.length) s += ' 選択肢: ' + opts.join(' / ');
        if (n.label && pbool(n, 'required')) s += ' (必須)';
        return s;
      }
    },

    checkbox: {
      name: 'チェックボックス', category: '入力', w: 160, h: 24,
      props: [
        { key: 'checked', label: '選択済み', type: 'boolean' }
      ],
      draw: function (n) {
        var by = n.h / 2 - 8;
        var checked = pbool(n, 'checked');
        var s;
        if (checked) {
          s = rc(0, by, 16, 16, P.fillAccent, null, 3);
          s += '<path d="M3.5,' + f2(by + 8) + ' l3.5,3.5 l6,-7" fill="none" stroke="' + P.textOn +
            '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
        } else {
          s = rc(0, by, 16, 16, P.fill, P.stroke, 3);
        }
        s += txt(24, n.h / 2, clip(n.label || 'チェック項目', n.w - 28, 13), 13, P.text);
        return s;
      },
      describe: function (n) {
        if (!n.label) return 'チェックボックス';
        return 'チェックボックス' + q(n.label) + (pbool(n, 'checked') ? ' (選択済み)' : ' (未選択)');
      }
    },

    radio: {
      name: 'ラジオボタン', category: '入力', w: 160, h: 80,
      props: [
        { key: 'items', label: '選択肢(改行区切り)', type: 'textarea' },
        { key: 'active', label: '選択中の番号(0始まり)', type: 'number', min: 0, max: 20 }
      ],
      draw: function (n) {
        var items = plines(n, 'items', '選択肢1\n選択肢2\n選択肢3');
        var active = pint(n, 'active', 0, 0, 99);
        var s = '', rowH = 24;
        for (var i = 0; i < items.length; i++) {
          var cy = 12 + i * rowH;
          if (cy + 10 > n.h) break;
          if (i === active) {
            s += cir(8, cy, 7, P.fill, P.fillAccent, ' stroke-width="1.5"');
            s += cir(8, cy, 3.5, P.fillAccent);
          } else {
            s += cir(8, cy, 7, P.fill, P.stroke, ' stroke-width="1.5"');
          }
          s += txt(22, cy, clip(items[i], n.w - 26, 13), 13, P.text);
        }
        return s || thin(n);
      },
      describe: function (n) {
        var items = plines(n, 'items', '選択肢1\n選択肢2\n選択肢3');
        var active = pint(n, 'active', 0, 0, 99);
        var cur = items[active] || '';
        return 'ラジオボタン' + q(n.label) + ' 選択肢: ' + items.join(' / ') +
          (cur ? ' (選択中: ' + cur + ')' : '');
      }
    },

    toggle: {
      name: 'トグルスイッチ', category: '入力', w: 160, h: 24,
      props: [
        { key: 'checked', label: 'オン', type: 'boolean' }
      ],
      draw: function (n) {
        var checked = pbool(n, 'checked');
        var ty = n.h / 2 - 10;
        var s = rc(0, ty, 36, 20, checked ? P.fillAccent : GRAY, null, 10);
        s += cir(checked ? 26 : 10, n.h / 2, 7.5, P.fill);
        s += txt(44, n.h / 2, clip(n.label || 'トグル', n.w - 48, 13), 13, P.text);
        return s;
      },
      describe: function (n) {
        if (!n.label) return 'トグルスイッチ';
        return 'トグルスイッチ' + q(n.label) + (pbool(n, 'checked') ? ' (オン)' : ' (オフ)');
      }
    },

    button: {
      name: 'ボタン', category: '入力', w: 120, h: 36,
      props: [
        { key: 'variant', label: '種類', type: 'select', options: [
          { value: 'primary', label: '主ボタン' },
          { value: 'ghost', label: '副ボタン' },
          { value: 'danger', label: '危険操作' }
        ] }
      ],
      draw: function (n) {
        var v = pv(n, 'variant', 'primary');
        var label = n.label || 'ボタン';
        var s;
        if (v === 'ghost') {
          s = rc(0, 0, n.w, n.h, P.fill, P.stroke, 6);
          s += txt(n.w / 2, n.h / 2, clip(label, n.w - 16, 13), 13, P.text, ' text-anchor="middle"');
        } else if (v === 'danger') {
          s = rc(0, 0, n.w, n.h, RED, null, 6);
          s += txt(n.w / 2, n.h / 2, clip(label, n.w - 16, 13), 13, P.textOn, ' text-anchor="middle" font-weight="bold"');
        } else {
          s = rc(0, 0, n.w, n.h, P.fillAccent, null, 6);
          s += txt(n.w / 2, n.h / 2, clip(label, n.w - 16, 13), 13, P.textOn, ' text-anchor="middle" font-weight="bold"');
        }
        return s;
      },
      describe: function (n) {
        var names = { primary: '主ボタン', ghost: '副ボタン', danger: '危険操作' };
        if (!n.label) return 'ボタン';
        return 'ボタン' + q(n.label) + '(' + (names[pv(n, 'variant', 'primary')] || '主ボタン') + ')';
      }
    },

    search: {
      name: '検索ボックス', category: '入力', w: 240, h: 36,
      props: [
        { key: 'placeholder', label: 'プレースホルダ', type: 'text' }
      ],
      draw: function (n) {
        var ph = pv(n, 'placeholder', '検索');
        var s = rc(0, 0, n.w, n.h, P.fill, P.stroke, 6);
        // 虫眼鏡アイコン
        var cy = n.h / 2 - 1.5;
        s += cir(13, cy, 5, 'none', P.textMuted, ' stroke-width="1.5"');
        s += ln(16.5, cy + 3.5, 20, cy + 7, P.textMuted, 1.5, ' stroke-linecap="round"');
        if (n.label) {
          s += txt(26, n.h / 2, clip(n.label, n.w - 34, 12.5), 12.5, P.text);
        } else {
          s += txt(26, n.h / 2, clip(ph, n.w - 34, 12.5), 12.5, P.textMuted);
        }
        return s;
      },
      describe: function (n) {
        var s = n.label ? '検索ボックス' + q(n.label) : '検索ボックス';
        var ph = (n.props || {}).placeholder;
        if (ph) s += ' プレースホルダ: ' + ph;
        return s;
      }
    },

    datepicker: {
      name: '日付入力', category: '入力', w: 180, h: 36, props: [],
      draw: function (n) {
        var s = rc(0, 0, n.w, n.h, P.fill, P.stroke, 6);
        s += txt(10, n.h / 2, clip(n.label || 'YYYY/MM/DD', n.w - 42, 12.5), 12.5,
          n.label ? P.text : P.textMuted);
        // カレンダーアイコン
        var ix = n.w - 26, iy = n.h / 2 - 8;
        s += rc(ix, iy + 3, 16, 13, 'none', P.textMuted, 2, ' stroke-width="1.3"');
        s += ln(ix, iy + 7.5, ix + 16, iy + 7.5, P.textMuted, 1.3);
        s += ln(ix + 4, iy, ix + 4, iy + 4, P.textMuted, 1.3, ' stroke-linecap="round"');
        s += ln(ix + 12, iy, ix + 12, iy + 4, P.textMuted, 1.3, ' stroke-linecap="round"');
        return s;
      },
      describe: function (n) { return n.label ? '日付入力' + q(n.label) : '日付入力'; }
    },

    fileupload: {
      name: 'ファイル選択', category: '入力', w: 220, h: 90, props: [],
      draw: function (n) {
        var s = rc(0, 0, n.w, n.h, P.fillMuted, P.stroke, 8, ' stroke-dasharray="6 4"');
        var msg = clip(n.label || 'ファイルをドロップ', n.w - 20, 12.5);
        var cx = n.w / 2;
        if (n.h >= 64) {
          // 上向き矢印+受け皿のアイコン
          var cy = n.h / 2 - 12;
          s += ln(cx, cy - 8, cx, cy + 4, P.textMuted, 1.6, ' stroke-linecap="round"');
          s += '<polygon points="' + f2(cx - 4.5) + ',' + f2(cy - 3) + ' ' + f2(cx + 4.5) + ',' + f2(cy - 3) +
            ' ' + f2(cx) + ',' + f2(cy - 10) + '" fill="' + P.textMuted + '"/>';
          s += '<path d="M' + f2(cx - 12) + ',' + f2(cy + 4) + ' v6 h24 v-6" fill="none" stroke="' +
            P.textMuted + '" stroke-width="1.6" stroke-linecap="round"/>';
          s += txt(cx, n.h / 2 + 14, msg, 12.5, P.textMuted, ' text-anchor="middle"');
        } else {
          s += txt(cx, n.h / 2, msg, 12.5, P.textMuted, ' text-anchor="middle"');
        }
        return s;
      },
      describe: function (n) { return n.label ? 'ファイルアップロード' + q(n.label) : 'ファイルアップロード'; }
    },

    /* ============ 表示 ============ */

    heading: {
      name: '見出し', category: '表示', w: 240, h: 32,
      props: [
        { key: 'level', label: 'レベル', type: 'select', options: [
          { value: '1', label: 'H1 (大)' },
          { value: '2', label: 'H2 (中)' },
          { value: '3', label: 'H3 (小)' }
        ] }
      ],
      draw: function (n) {
        var sizes = { '1': 24, '2': 19, '3': 16 };
        var fs = sizes[String(pv(n, 'level', '1'))] || 24;
        return txt(0, n.h / 2, clip(n.label || '見出し', n.w, fs), fs, P.text, ' font-weight="bold"');
      },
      describe: function (n) {
        var lv = String(pv(n, 'level', '1'));
        return n.label ? '見出し(H' + lv + ')' + q(n.label) : '見出し(H' + lv + ')';
      }
    },

    text: {
      name: 'テキスト', category: '表示', w: 240, h: 60,
      props: [
        { key: 'size', label: '文字サイズ', type: 'number', min: 9, max: 32 }
      ],
      draw: function (n) {
        var fs = pnum(n, 'size', 13, 8, 48);
        var lh = fs * 1.55;
        var maxLines = Math.max(1, Math.floor(n.h / lh));
        var lines = wrap(n.label || '本文テキスト', n.w, fs, maxLines);
        var s = '', y = fs * 0.7 + 2;
        for (var i = 0; i < lines.length; i++) {
          if (lines[i] !== '') s += txt(0, y, lines[i], fs, P.text);
          y += lh;
        }
        return s;
      },
      describe: function (n) { return n.label ? 'テキスト「' + oneline(n.label) + '」' : 'テキスト'; }
    },

    label: {
      name: 'ラベル', category: '表示', w: 120, h: 20, props: [],
      draw: function (n) {
        return txt(0, n.h / 2, clip(n.label || 'ラベル', n.w, 11), 11, P.textMuted);
      },
      describe: function (n) { return n.label ? 'ラベル' + q(n.label) : 'ラベル'; }
    },

    image: {
      name: '画像', category: '表示', w: 160, h: 120, props: [],
      draw: function (n) {
        var s = rc(0, 0, n.w, n.h, P.fillMuted, P.stroke);
        s += ln(0, 0, n.w, n.h, P.stroke, 1);
        s += ln(0, n.h, n.w, 0, P.stroke, 1);
        s += txt(n.w / 2, n.h / 2, clip(n.label || '画像', n.w - 12, 12), 12, P.textMuted,
          ' text-anchor="middle" font-weight="bold"');
        return s;
      },
      describe: function (n) { return n.label ? '画像' + q(n.label) : '画像'; }
    },

    avatar: {
      name: 'アバター', category: '表示', w: 40, h: 40, props: [],
      draw: function (n) {
        var cx = n.w / 2, cy = n.h / 2;
        var r = Math.min(n.w, n.h) / 2 - 1;
        if (r < 3) return cir(cx, cy, Math.max(1, r), P.fillMuted, P.stroke);
        var cid = safeId(n, 'sb-av-');
        var s = '<clipPath id="' + cid + '">' +
          '<circle cx="' + f2(cx) + '" cy="' + f2(cy) + '" r="' + f2(r) + '"/></clipPath>';
        s += cir(cx, cy, r, P.fillMuted);
        s += '<g clip-path="url(#' + cid + ')">';
        s += cir(cx, cy - r * 0.2, r * 0.34, GRAY);
        s += '<ellipse cx="' + f2(cx) + '" cy="' + f2(cy + r * 0.95) + '" rx="' + f2(r * 0.62) +
          '" ry="' + f2(r * 0.5) + '" fill="' + GRAY + '"/>';
        s += '</g>';
        s += cir(cx, cy, r, 'none', P.stroke);
        return s;
      },
      describe: function (n) { return n.label ? 'アバター' + q(n.label) : 'アバター'; }
    },

    table: {
      name: 'テーブル', category: '表示', w: 360, h: 140,
      props: [
        { key: 'columns', label: '列名(改行区切り)', type: 'textarea' },
        { key: 'rows', label: '行数', type: 'number', min: 1, max: 20 }
      ],
      draw: function (n) {
        var cols = plines(n, 'columns', '列1\n列2\n列3');
        if (!cols.length) cols = ['列1'];
        var rows = Math.max(1, Math.round(pint(n, 'rows', 4, 1, 60)));
        var headerH = 24, rowH = 22;
        var nRows = Math.max(0, Math.min(rows, Math.floor((n.h - headerH) / rowH)));
        var colW = n.w / cols.length;
        var s = rc(0, 0, n.w, n.h, P.fill);
        s += rc(0, 0, n.w, Math.min(headerH, n.h), P.fillMuted);
        var i;
        for (i = 0; i < cols.length; i++) {
          s += txt(i * colW + 8, headerH / 2, clip(cols[i], colW - 14, 12), 12, P.text, ' font-weight="bold"');
        }
        for (i = 1; i < cols.length; i++) {
          s += ln(i * colW, 0, i * colW, n.h, LIGHT, 1);
        }
        s += ln(0, headerH, n.w, headerH, P.stroke, 1);
        for (i = 1; i <= nRows; i++) {
          var y = headerH + i * rowH;
          if (y >= n.h - 1) break;
          s += ln(0, y, n.w, y, LIGHT, 1);
        }
        s += rc(0, 0, n.w, n.h, 'none', P.stroke);
        return s;
      },
      describe: function (n) {
        var cols = plines(n, 'columns', '列1\n列2\n列3');
        var rows = Math.max(1, Math.round(pint(n, 'rows', 4, 1, 60)));
        return 'テーブル' + q(n.label) + ' 列: ' + cols.join(' / ') + ' (' + rows + '行表示)';
      }
    },

    list: {
      name: 'リスト', category: '表示', w: 240, h: 120,
      props: [
        { key: 'items', label: '項目(改行区切り)', type: 'textarea' }
      ],
      draw: function (n) {
        var items = plines(n, 'items', '項目1\n項目2\n項目3');
        var s = '', rowH = 24;
        for (var i = 0; i < items.length; i++) {
          var cy = 12 + i * rowH;
          if (cy + 10 > n.h) break;
          s += cir(7, cy, 2.5, P.textMuted);
          s += txt(18, cy, clip(items[i], n.w - 22, 13), 13, P.text);
        }
        return s || thin(n);
      },
      describe: function (n) {
        var items = plines(n, 'items', '項目1\n項目2\n項目3');
        return 'リスト' + q(n.label) + ' 項目: ' + items.join(' / ');
      }
    },

    badge: {
      name: 'バッジ', category: '表示', w: 72, h: 22,
      props: [
        { key: 'tone', label: 'トーン', type: 'select', options: [
          { value: 'neutral', label: '中立' },
          { value: 'info', label: '情報' },
          { value: 'success', label: '成功' },
          { value: 'warning', label: '警告' },
          { value: 'danger', label: '危険' }
        ] }
      ],
      draw: function (n) {
        var tones = {
          neutral: [P.fillMuted, P.strokeStrong],
          info:    [P.accentSoft, '#1d4ed8'],
          success: ['#dcfce7', '#166534'],
          warning: ['#fef3c7', '#92400e'],
          danger:  ['#fee2e2', '#991b1b']
        };
        var t = tones[pv(n, 'tone', 'neutral')] || tones.neutral;
        var s = rc(0, 0, n.w, n.h, t[0], null, n.h / 2);
        s += txt(n.w / 2, n.h / 2, clip(n.label || 'バッジ', n.w - 12, 11), 11, t[1],
          ' text-anchor="middle" font-weight="bold"');
        return s;
      },
      describe: function (n) {
        var names = { neutral: '中立', info: '情報', success: '成功', warning: '警告', danger: '危険' };
        var tone = names[pv(n, 'tone', 'neutral')] || '中立';
        return n.label ? 'バッジ' + q(n.label) + '(' + tone + ')' : 'バッジ(' + tone + ')';
      }
    },

    chart: {
      name: 'グラフ', category: '表示', w: 240, h: 160,
      props: [
        { key: 'kind', label: '種類', type: 'select', options: [
          { value: 'bar', label: '棒グラフ' },
          { value: 'line', label: '折れ線グラフ' },
          { value: 'pie', label: '円グラフ' }
        ] }
      ],
      draw: function (n) {
        var kind = pv(n, 'kind', 'bar');
        var s = '', top = 6;
        if (n.label) {
          s += txt(2, 9, clip(n.label, n.w - 4, 12), 12, P.text, ' font-weight="bold"');
          top = 22;
        }
        var data = [0.45, 0.7, 0.35, 0.85, 0.6];
        var i, x, y;
        if (kind === 'pie') {
          var cx = n.w / 2, cy = top + (n.h - top) / 2;
          var r = Math.max(4, Math.min(n.w, n.h - top) / 2 - 8);
          s += cir(cx, cy, r, P.fillMuted, P.stroke);
          // 35% と 20% の扇形（12時から時計回り）
          var a0 = -Math.PI / 2;
          var a1 = a0 + Math.PI * 2 * 0.35;
          var a2 = a1 + Math.PI * 2 * 0.20;
          s += pieWedge(cx, cy, r, a0, a1, P.fillAccent);
          s += pieWedge(cx, cy, r, a1, a2, P.accentSoft);
          s += cir(cx, cy, r, 'none', P.stroke);
        } else {
          var x0 = 8, y0 = n.h - 8, x1 = n.w - 8;
          var ph = Math.max(10, y0 - top - 4);
          s += ln(x0, top, x0, y0, P.stroke, 1);
          s += ln(x0, y0, x1, y0, P.stroke, 1);
          if (kind === 'line') {
            var pts = [];
            for (i = 0; i < data.length; i++) {
              x = x0 + 8 + (x1 - x0 - 16) * (i / (data.length - 1));
              y = y0 - ph * data[i];
              pts.push(f2(x) + ',' + f2(y));
            }
            s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + P.fillAccent +
              '" stroke-width="2" stroke-linejoin="round"/>';
            for (i = 0; i < pts.length; i++) {
              var p = pts[i].split(',');
              s += cir(parseFloat(p[0]), parseFloat(p[1]), 2.5, P.fill, P.fillAccent, ' stroke-width="1.5"');
            }
          } else {
            var slot = (x1 - x0 - 8) / data.length;
            var bw = Math.max(4, slot * 0.55);
            for (i = 0; i < data.length; i++) {
              x = x0 + 6 + i * slot + (slot - bw) / 2;
              var bh = ph * data[i];
              s += rc(x, y0 - bh, bw, bh, P.accentSoft, P.fillAccent);
            }
          }
        }
        return s;
      },
      describe: function (n) {
        var names = { bar: '棒グラフ', line: '折れ線グラフ', pie: '円グラフ' };
        var kind = names[pv(n, 'kind', 'bar')] || '棒グラフ';
        return n.label ? 'グラフ' + q(n.label) + '(' + kind + ')' : 'グラフ(' + kind + ')';
      }
    },

    kpi: {
      name: '数値サマリ', category: '表示', w: 160, h: 80,
      props: [
        { key: 'value', label: '数値', type: 'text' }
      ],
      draw: function (n) {
        var value = String(pv(n, 'value', '1,234'));
        var s = rc(0, 0, n.w, n.h, P.fill, P.stroke, 8);
        s += txt(12, 16, clip(n.label || '指標', n.w - 24, 11), 11, P.textMuted);
        var vfs = Math.max(14, Math.min(26, n.h * 0.34));
        s += txt(12, 24 + (n.h - 24) / 2, clip(value, n.w - 24, vfs), vfs, P.text, ' font-weight="bold"');
        return s;
      },
      describe: function (n) {
        var value = String(pv(n, 'value', '1,234'));
        return '数値サマリ' + q(n.label) + ' 値: ' + value;
      }
    },

    progress: {
      name: '進捗バー', category: '表示', w: 200, h: 24,
      props: [
        { key: 'percent', label: '進捗(%)', type: 'number', min: 0, max: 100 }
      ],
      draw: function (n) {
        var pct = Math.max(0, Math.min(100, pnum(n, 'percent', 60, 0, 100)));
        var by = n.h / 2 - 4;
        var s = rc(0, by, n.w, 8, LIGHT, null, 4);
        if (pct > 0) s += rc(0, by, n.w * pct / 100, 8, P.fillAccent, null, 4);
        return s;
      },
      describe: function (n) {
        var pct = Math.max(0, Math.min(100, pnum(n, 'percent', 60, 0, 100)));
        return '進捗バー' + q(n.label) + ' ' + pct + '%';
      }
    },

    icon: {
      name: 'アイコン', category: '表示', w: 32, h: 32, props: [],
      draw: function (n) {
        var s = rc(0, 0, n.w, n.h, P.fill, P.stroke, 6);
        s += cir(n.w / 2, n.h / 2, Math.max(2, Math.min(n.w, n.h) * 0.22), 'none', P.strokeStrong, ' stroke-width="1.5"');
        return s;
      },
      describe: function (n) { return n.label ? 'アイコン' + q(n.label) : 'アイコン'; }
    },

    toast: {
      name: '通知', category: '表示', w: 260, h: 48,
      props: [
        { key: 'tone', label: 'トーン', type: 'select', options: [
          { value: 'info', label: '情報' },
          { value: 'success', label: '成功' },
          { value: 'warning', label: '警告' },
          { value: 'danger', label: 'エラー' }
        ] }
      ],
      draw: function (n) {
        var colors = { info: P.fillAccent, success: '#16a34a', warning: P.noteStroke, danger: RED };
        var c = colors[pv(n, 'tone', 'info')] || P.fillAccent;
        var s = rc(0, 0, n.w, n.h, P.fill, P.stroke, 8);
        s += rc(6, 7, 4, n.h - 14, c, null, 2);
        s += txt(18, n.h / 2, clip(n.label || '通知メッセージ', n.w - 26, 12.5), 12.5, P.text);
        return s;
      },
      describe: function (n) {
        var names = { info: '情報', success: '成功', warning: '警告', danger: 'エラー' };
        var tone = names[pv(n, 'tone', 'info')] || '情報';
        return n.label ? '通知' + q(n.label) + '(' + tone + ')' : '通知(' + tone + ')';
      }
    },

    empty: {
      name: '空状態', category: '表示', w: 240, h: 120, props: [],
      draw: function (n) {
        var s = rc(0, 0, n.w, n.h, P.fill, P.stroke, 8, ' stroke-dasharray="6 4"');
        var msg = clip(n.label || 'データがありません', n.w - 20, 12.5);
        var cx = n.w / 2;
        if (n.h >= 70) {
          // 空のトレイのアイコン
          var cy = n.h / 2 - 14;
          s += '<path d="M' + f2(cx - 14) + ',' + f2(cy - 4) + ' v10 h28 v-10" fill="none" stroke="' +
            GRAY + '" stroke-width="1.6" stroke-linecap="round"/>';
          s += '<path d="M' + f2(cx - 14) + ',' + f2(cy - 4) + ' l4,-6 h20 l4,6" fill="none" stroke="' +
            GRAY + '" stroke-width="1.6" stroke-linejoin="round"/>';
          s += ln(cx - 14, cy - 4, cx - 6, cy - 4, GRAY, 1.6);
          s += ln(cx + 6, cy - 4, cx + 14, cy - 4, GRAY, 1.6);
          s += '<path d="M' + f2(cx - 6) + ',' + f2(cy - 4) + ' l2,3 h8 l2,-3" fill="none" stroke="' +
            GRAY + '" stroke-width="1.6" stroke-linejoin="round"/>';
          s += txt(cx, n.h / 2 + 14, msg, 12.5, P.textMuted, ' text-anchor="middle"');
        } else {
          s += txt(cx, n.h / 2, msg, 12.5, P.textMuted, ' text-anchor="middle"');
        }
        return s;
      },
      describe: function (n) {
        return '空状態' + (n.label ? q(n.label) : '「データがありません」');
      }
    },

    /* ============ 注釈（AIへの指示） ============ */

    note: {
      name: '注釈メモ', category: '注釈', w: 200, h: 100, props: [],
      draw: function (n) {
        var fold = 14;
        // 右上を折った付箋
        var s = '<path d="M0,0 H' + f2(n.w - fold) + ' L' + f2(n.w) + ',' + fold +
          ' V' + f2(n.h) + ' H0 Z" fill="' + P.note + '" stroke="' + P.noteStroke + '"/>';
        s += '<path d="M' + f2(n.w - fold) + ',0 V' + fold + ' H' + f2(n.w) +
          ' Z" fill="#fde68a" stroke="' + P.noteStroke + '"/>';
        var lh = 17;
        var maxLines = Math.max(1, Math.floor((n.h - 12) / lh));
        var lines = wrap(n.label || '注釈を書く', n.w - 20, 12, maxLines);
        var y = 18;
        for (var i = 0; i < lines.length; i++) {
          if (lines[i] !== '') s += txt(10, y, lines[i], 12, P.noteText);
          y += lh;
        }
        return s;
      },
      describe: function (n) {
        return n.label ? '注釈メモ: ' + oneline(n.label) : '注釈メモ';
      }
    },

    callout: {
      name: '番号付き注釈', category: '注釈', w: 220, h: 48,
      props: [
        { key: 'number', label: '番号', type: 'number', min: 1, max: 99 }
      ],
      draw: function (n) {
        var num = pint(n, 'number', 1, 1, 99);
        var s = rc(0, 0, n.w, n.h, P.note, P.noteStroke, 10);
        var cy = n.h / 2;
        s += cir(18, cy, 12, P.noteStroke);
        s += txt(18, cy, String(num), 13, P.textOn, ' text-anchor="middle" font-weight="bold"');
        var lh = 16;
        var maxLines = Math.max(1, Math.floor((n.h - 6) / lh));
        var lines = wrap(n.label || '説明を書く', n.w - 46, 12.5, maxLines);
        var top = cy - ((lines.length - 1) * lh) / 2;
        for (var i = 0; i < lines.length; i++) s += txt(38, top + i * lh, lines[i], 12.5, P.noteText);
        return s;
      },
      describe: function (n) {
        var num = pint(n, 'number', 1, 1, 99);
        return '注釈(番号' + num + ')' + (n.label ? ': ' + oneline(n.label) : '');
      }
    },

    arrow: {
      name: '矢印', category: '注釈', w: 120, h: 24, props: [],
      draw: function (n) {
        var cy = n.h / 2;
        var headW = Math.min(12, n.w * 0.3);
        var s = ln(0, cy, n.w - headW + 2, cy, RED, 2, ' stroke-linecap="round"');
        s += '<polygon points="' + f2(n.w) + ',' + f2(cy) + ' ' + f2(n.w - headW) + ',' + f2(cy - headW * 0.45) +
          ' ' + f2(n.w - headW) + ',' + f2(cy + headW * 0.45) + '" fill="' + RED + '"/>';
        if (n.label) {
          s += txt(n.w / 2, Math.max(7, cy - 11), clip(n.label, n.w, 11), 11, RED, ' text-anchor="middle"');
        }
        return s;
      },
      describe: function (n) {
        return n.label ? '矢印' + q(n.label) + ' (左から右)' : '矢印(左から右)';
      }
    },

    marker: {
      name: '強調マーカー', category: '注釈', w: 160, h: 100, props: [],
      draw: function (n) {
        var s = rc(0, 0, n.w, n.h, 'none', RED, 4, ' stroke-width="2.5" stroke-dasharray="8 5"');
        if (n.label) s += txt(6, 13, clip(n.label, n.w - 12, 11), 11, RED, ' font-weight="bold"');
        return s;
      },
      describe: function (n) {
        return n.label ? '強調マーカー' + q(n.label) : '強調マーカー';
      }
    }
  };

  // 円グラフの扇形パス
  function pieWedge(cx, cy, r, a0, a1, fill) {
    var x1 = cx + r * Math.cos(a0), y1 = cy + r * Math.sin(a0);
    var x2 = cx + r * Math.cos(a1), y2 = cy + r * Math.sin(a1);
    var large = (a1 - a0) > Math.PI ? 1 : 0;
    return '<path d="M' + f2(cx) + ',' + f2(cy) + ' L' + f2(x1) + ',' + f2(y1) +
      ' A' + f2(r) + ',' + f2(r) + ' 0 ' + large + ' 1 ' + f2(x2) + ',' + f2(y2) +
      ' Z" fill="' + fill + '"/>';
  }

  SB.shapeCategories = ['レイアウト', 'ナビゲーション', '入力', '表示', '注釈'];

})();
