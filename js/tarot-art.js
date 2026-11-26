/* ==========================================================================
   牌面绘制层 —— 22 张牌的矢量牌面
   --------------------------------------------------------------------------
   本项目运行环境不联网，无法随包分发 1909 年韦特塔罗的公版扫描图，
   因此这里用极简线条自绘了一套牌面（同一套视觉语言，非韦特原图）：
   金色描边 + 罗马数字 + 牌名 + 该牌的象征图形。
   若之后拿到公版牌面图，把图片放进 images/tarot/，
   并设置 XX.TAROT.assetDir = 'images/tarot/'，文件名规则：
       <两位序号>-<id>.jpg   例如 00-fool.jpg / 13-death.jpg
   文件缺失时自动回退到这里的矢量牌面，不会出现裂图。
   ========================================================================== */

window.XX = window.XX || {};

(function () {
  'use strict';

  const GOLD = 'currentColor';

  /* ---------- 小型绘图助手（坐标空间统一为 120 × 120） ---------- */
  const line = (x1, y1, x2, y2, extra = '') =>
    `<path d="M${x1} ${y1}L${x2} ${y2}" ${extra}/>`;

  const circle = (cx, cy, r, extra = '') =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" ${extra}/>`;

  const dot = (cx, cy, r = 3) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${GOLD}" stroke="none"/>`;

  const poly = (pts, extra = '') =>
    `<path d="M${pts.map(p => p.join(' ')).join('L')}Z" ${extra}/>`;

  /** 星形：n 个尖角，rot 为起始角度（度） */
  function starPath(cx, cy, rOut, rIn, n = 5, rot = -90) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? rIn : rOut;
      const a = (rot + (i * 180) / n) * Math.PI / 180;
      pts.push([+(cx + r * Math.cos(a)).toFixed(2), +(cy + r * Math.sin(a)).toFixed(2)]);
    }
    return poly(pts);
  }

  /** 以中心为原点画放射线（太阳光芒 / 车轮辐条） */
  function rays(cx, cy, r1, r2, n = 12, rot = -90) {
    let out = '';
    for (let i = 0; i < n; i++) {
      const a = (rot + (360 / n) * i) * Math.PI / 180;
      out += line(
        +(cx + r1 * Math.cos(a)).toFixed(2), +(cy + r1 * Math.sin(a)).toFixed(2),
        +(cx + r2 * Math.cos(a)).toFixed(2), +(cy + r2 * Math.sin(a)).toFixed(2)
      );
    }
    return out;
  }

  /* ---------- 22 张牌的象征图形 ---------- */
  const GLYPHS = {
    // 0 愚者：悬崖边的一步
    fool: line(6, 96, 114, 96, 'stroke-opacity=".45"') +
      `<path d="M14 96 C36 78 52 62 70 44 C80 33 94 22 108 26"/>` +
      dot(108, 26, 3.4) + starPath(26, 34, 11, 4.4, 5),

    // I 魔术师：向上的意志与平衡的横杆
    magician: poly([[30, 92], [60, 18], [90, 92]]) +
      line(45, 66, 75, 66) + dot(60, 42, 4),

    // II 女祭司：两根柱子与一弯月
    priestess: line(20, 26, 100, 26) +
      `<rect x="26" y="30" width="11" height="66" rx="2"/>` +
      `<rect x="83" y="30" width="11" height="66" rx="2"/>` +
      `<path d="M62 42a18 18 0 1 1 0 34a14 14 0 1 0 0-34z" fill="${GOLD}" stroke="none"/>`,

    // III 女皇：冠与麦穗
    empress: `<path d="M28 66 L28 36 L46 54 L60 30 L74 54 L92 36 L92 66 Z"/>` +
      line(24, 78, 96, 78) + line(42, 88, 42, 104) + line(60, 88, 60, 108) + line(78, 88, 78, 104),

    // IV 皇帝：宝座与城墙
    emperor: `<rect x="32" y="42" width="56" height="52" rx="3"/>` +
      `<path d="M42 42 v-14 h36 v14"/>` + line(48, 68, 72, 68) + line(26, 94, 94, 94),

    // V 教皇：三层十字
    hierophant: line(60, 16, 60, 104) + line(38, 40, 82, 40) +
      line(44, 60, 76, 60) + line(50, 80, 70, 80) + dot(60, 16, 4),

    // VI 恋人：两个交叠的圆与一颗星
    lovers: circle(45, 68, 18) + circle(75, 68, 18) + starPath(60, 26, 12, 5, 5),

    // VII 战车：车轮与华盖
    chariot: circle(60, 72, 22) + circle(60, 72, 4) + line(60, 50, 60, 94) +
      line(38, 72, 82, 72) + line(34, 34, 86, 34) + line(34, 34, 34, 44) + line(86, 34, 86, 44),

    // VIII 力量：心
    strength: `<path d="M60 92 C34 74 26 56 39 45 c9-7 17-2 21 8 4-10 12-15 21-8 13 11 5 29-21 47z"/>`,

    // IX 隐者：提灯
    hermit: `<rect x="45" y="48" width="30" height="36" rx="4"/>` +
      `<path d="M45 48 l-7 -12 h15"/>` + line(60, 36, 60, 26) +
      `<circle cx="60" cy="66" r="7" fill="${GOLD}" stroke="none" opacity=".75"/>` +
      line(52, 84, 48, 96) + line(68, 84, 72, 96),

    // X 命运之轮：同心圆与辐条
    wheel: circle(60, 62, 45, 'stroke-opacity=".38"') + circle(60, 62, 30) +
      circle(60, 62, 8) + rays(60, 62, 8, 30, 8),

    // XI 正义：天平
    justice: line(60, 16, 60, 96) + line(22, 38, 98, 38) +
      line(30, 96, 90, 96) +
      `<path d="M22 38 v6a12 10 0 0 0 24 0v-6"/>` +
      `<path d="M74 38 v6a12 10 0 0 0 24 0v-6"/>`,

    // XII 倒吊人：倒三角与横梁
    hanged: line(60, 12, 60, 34) + line(30, 34, 90, 34) +
      poly([[36, 40], [84, 40], [60, 96]]) + circle(60, 64, 6),

    // XIII 死神：镰刀
    death: line(28, 100, 82, 24) +
      `<path d="M24 40c22-14 44-12 58 2-18-3-34 1-46 10"/>`,

    // XIV 节制：两只杯与一道水流
    temperance: `<path d="M26 38 h26 l-4 22 h-18 z"/>` +
      `<path d="M68 56 h26 l-4 22 h-18 z"/>` +
      `<path d="M52 54 c10 6 8 18 -2 24"/>` + dot(60, 96, 3),

    // XV 恶魔：倒五角星
    devil: starPath(60, 66, 40, 16, 5, 90) + line(30, 100, 90, 100),

    // XVI 高塔：塔顶的闪电
    tower: `<path d="M40 96 v-52 h40 v52"/>` + line(32, 96, 88, 96) +
      `<path d="M36 44 l6 -14 h36 l6 14z"/>` +
      `<path d="M62 16 l-10 24 12-2 -10 22"/>`,

    // XVII 星星：八角星与群星
    star: starPath(60, 62, 32, 13, 8) + starPath(24, 26, 8, 3, 4) + starPath(98, 34, 6, 2.5, 4) +
      dot(92, 88, 2.6) + dot(28, 90, 2.6),

    // XVIII 月亮：弯月与露珠
    moon: `<path d="M74 28a32 32 0 1 0 0 60a26 26 0 1 1 0-60z" fill="${GOLD}" stroke="none" opacity=".9"/>` +
      dot(96, 40, 3) + dot(104, 58, 2.4) + line(16, 96, 104, 96, 'stroke-opacity=".4"'),

    // XIX 太阳：太阳与光
    sun: circle(60, 60, 20) + rays(60, 60, 26, 40, 12) + dot(60, 60, 4),

    // XX 审判：号角与声波
    judgement: `<path d="M22 88 L80 44"/>` +
      `<path d="M80 44 l16 -12 v18 l-16 10z" fill="${GOLD}" stroke="none"/>` +
      `<path d="M96 24 a18 18 0 0 1 0 24"/>` + `<path d="M86 16 a28 28 0 0 1 0 34" stroke-opacity=".5"/>`,

    // XXI 世界：花环与中心
    world: `<ellipse cx="60" cy="60" rx="27" ry="42"/>` + circle(60, 60, 11) +
      line(60, 10, 60, 22) + line(60, 98, 60, 110) + dot(60, 60, 3)
  };

  /** 一张牌的完整 SVG */
  function cardSVG(card) {
    const glyph = GLYPHS[card.id] || circle(60, 60, 24);
    const num = String(card.no).padStart(2, '0');
    return `
<svg class="tcard-svg" viewBox="0 0 240 400" role="img"
     aria-label="${card.name}（${card.roman}）牌面" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="tg-${num}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#241a3d"/>
      <stop offset="1" stop-color="#150f26"/>
    </linearGradient>
  </defs>
  <rect x="4" y="4" width="232" height="392" rx="16" fill="url(#tg-${num})" stroke="${GOLD}" stroke-width="2"/>
  <rect x="12" y="12" width="216" height="376" rx="10" fill="none" stroke="${GOLD}" stroke-opacity=".45"/>
  <g fill="none" stroke="${GOLD}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <text x="120" y="66" text-anchor="middle" font-size="20" letter-spacing="3"
          fill="${GOLD}" stroke="none" font-family="Georgia, 'Times New Roman', serif">${card.roman}</text>
    <g transform="translate(60,112)">${glyph}</g>
    <path d="M104 264 h32" stroke-opacity=".5"/>
    <path d="M120 258 l5 6 -5 6 -5 -6z" stroke-opacity=".8"/>
    <text x="120" y="316" text-anchor="middle" font-size="22" letter-spacing="4"
          fill="${GOLD}" stroke="none" font-family="'Kaiti SC', 'STKaiti', 'KaiTi', serif">${card.name}</text>
    <text x="120" y="342" text-anchor="middle" font-size="11" letter-spacing="2"
          fill="${GOLD}" fill-opacity=".55" stroke="none"
          font-family="Georgia, 'Times New Roman', serif">${card.en.toUpperCase()}</text>
  </g>
</svg>`.trim();
  }

  /**
   * 渲染一张牌：优先使用真实图片（若配置了 assetDir 且文件存在），否则回退矢量牌面。
   * 图片加载失败时由 onerror 换回矢量图，保证演示时不出现裂图。
   */
  function renderFront(card, container) {
    const dir = XX.TAROT.assetDir;
    if (dir) {
      const num = String(card.no).padStart(2, '0');
      const img = new Image();
      img.className = 'tcard-img';
      img.alt = `${card.name}牌面`;
      img.onerror = () => { container.innerHTML = cardSVG(card); };
      img.onload = () => { container.innerHTML = ''; container.appendChild(img); };
      img.src = `${dir}${num}-${card.id}.jpg`;
      container.innerHTML = cardSVG(card);   // 先放矢量图占位
      return;
    }
    container.innerHTML = cardSVG(card);
  }

  XX.TarotArt = { cardSVG, renderFront };
})();
