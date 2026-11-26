/* ==========================================================================
   主逻辑 —— 路由、本地存储、SWLS 与 BNSG-S 的渲染与计分、结果页
   --------------------------------------------------------------------------
   纯原生 JS，无构建、无框架、无外部依赖；用 <script> 顺序加载，
   因此可以直接双击 index.html 打开（file:// 协议）运行，也可以用任意静态服务器。
   ========================================================================== */

window.XX = window.XX || {};

(function () {
  'use strict';

  /* ==================== 1. 工具 ==================== */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /** localStorage 包装：隐私模式或被禁用时不抛异常，退化为内存存储 */
  const Store = (() => {
    const PREFIX = 'xinxu.';
    const mem = {};
    let ok = true;
    try {
      localStorage.setItem(PREFIX + '__t', '1');
      localStorage.removeItem(PREFIX + '__t');
    } catch (e) {
      ok = false;
    }
    return {
      get(key, fallback = null) {
        try {
          const raw = ok ? localStorage.getItem(PREFIX + key) : mem[key];
          return raw == null ? fallback : JSON.parse(raw);
        } catch (e) { return fallback; }
      },
      set(key, value) {
        const raw = JSON.stringify(value);
        try { if (ok) localStorage.setItem(PREFIX + key, raw); else mem[key] = raw; }
        catch (e) { mem[key] = raw; }
      },
      del(key) {
        try { if (ok) localStorage.removeItem(PREFIX + key); else delete mem[key]; }
        catch (e) { delete mem[key]; }
      }
    };
  })();

  /** 转义用户输入，避免把纯文本当 HTML 注入 */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  /* ==================== 2. 应用状态 ==================== */

  const state = {
    swlsAnswers: Store.get('swls.answers', {}) || {},
    bnsgAnswers: Store.get('bnsg.answers', {}) || {},
    swlsScore: null,
    bnsgResult: null
  };

  /* ==================== 3. 路由 ==================== */

  const ROUTES = ['home', 'swls', 'swls-result', 'bnsg', 'bnsg-result', 'tarot', 'den'];
  const NAV_MAP = { swls: 'test', 'swls-result': 'test', bnsg: 'test', 'bnsg-result': 'test', tarot: 'tarot', den: 'den' };

  function currentRoute() {
    const raw = location.hash.replace(/^#\/?/, '').split('?')[0];
    return ROUTES.includes(raw) ? raw : 'home';
  }

  const VIEW_HOOKS = {};

  function render() {
    const route = currentRoute();

    ROUTES.forEach((r) => {
      const el = $('#v-' + r);
      if (el) el.hidden = (r !== route);
    });

    // 塔罗页切换独立暗色主题，其余页面保持暖色
    document.body.classList.toggle('theme-tarot', route === 'tarot');

    // 顶栏高亮
    $$('.topnav a').forEach((a) => {
      const isActive = a.dataset.nav === NAV_MAP[route];
      if (isActive) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    window.scrollTo({ top: 0, behavior: 'auto' });

    if (VIEW_HOOKS[route]) VIEW_HOOKS[route]();
  }

  window.addEventListener('hashchange', render);

  /* ==================== 4. 通用：问卷渲染 ==================== */

  const LEGEND_TEXT = {
    7: ['强烈反对', '', '', '说不好', '', '', '强烈同意'],
    5: ['完全不符合', '', '说不好', '', '完全符合']
  };

  /**
   * 渲染一份量表
   * @param {HTMLElement} listEl      题目容器
   * @param {object} cfg              量表配置（XX.SWLS / XX.BNSG）
   * @param {object} answers          答案对象 { 题号: 分值 }
   * @param {function} onChange       任一题变化时回调（用于更新进度）
   */
  function renderScale(listEl, cfg, answers, onChange) {
    const n = cfg.max - cfg.min + 1;
    const legend = LEGEND_TEXT[n] || [];
    listEl.innerHTML = '';

    cfg.items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'q';
      li.dataset.no = item.no;

      const scale = document.createElement('div');
      scale.className = 'likert-scale';
      scale.dataset.n = String(n);
      scale.setAttribute('role', 'radiogroup');
      scale.setAttribute('aria-label', '第 ' + item.no + ' 题：' + item.text);

      for (let v = cfg.min; v <= cfg.max; v++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'opt';
        b.textContent = String(v);
        b.dataset.value = String(v);
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(answers[item.no] === v));
        b.setAttribute('aria-label', v + ' 分' + (legend[v - cfg.min] ? '，' + legend[v - cfg.min] : ''));
        b.addEventListener('click', () => {
          answers[item.no] = v;
          $$('.opt', scale).forEach((o) => o.setAttribute('aria-checked', String(+o.dataset.value === v)));
          li.classList.add('is-answered');
          onChange();
        });
        scale.appendChild(b);
      }

      const legendEl = document.createElement('div');
      legendEl.className = 'likert-legend';
      legendEl.innerHTML = '<span>' + (legend[0] || '') + '</span><span>' + (legend[legend.length - 1] || '') + '</span>';

      const wrap = document.createElement('div');
      wrap.className = 'likert';
      wrap.appendChild(scale);
      wrap.appendChild(legendEl);

      li.innerHTML = '<div class="q-text"><span class="q-no">' + item.no + '</span>' +
        '<span>' + esc(item.text) + '</span></div>';
      li.appendChild(wrap);
      if (answers[item.no] != null) li.classList.add('is-answered');
      listEl.appendChild(li);
    });
  }

  function answeredCount(cfg, answers) {
    return cfg.items.filter((i) => answers[i.no] != null).length;
  }

  /* ==================== 5. SWLS ==================== */

  const SW = XX.SWLS;

  function bindSwls() {
    const list = $('#swls-list');
    const bar = $('#swls-bar');
    const count = $('#swls-count');
    const submit = $('#swls-submit');
    const progress = $('#swls-progress');

    const update = () => {
      const done = answeredCount(SW, state.swlsAnswers);
      const total = SW.items.length;
      bar.style.width = (done / total * 100) + '%';
      count.textContent = '已答 ' + done + ' / ' + total;
      progress.setAttribute('aria-valuenow', String(done));
      submit.disabled = done < total;
      Store.set('swls.answers', state.swlsAnswers);
    };

    renderScale(list, SW, state.swlsAnswers, update);
    update();

    submit.onclick = () => {
      if (answeredCount(SW, state.swlsAnswers) < SW.items.length) return;
      state.swlsScore = scoreSwls(state.swlsAnswers);
      Store.set('swls.score', state.swlsScore);
      renderSwlsResult(state.swlsScore);
      location.hash = '#/swls-result';
    };
  }

  function scoreSwls(answers) {
    let sum = 0;
    SW.items.forEach((i) => { sum += Number(answers[i.no]) || 0; });
    return sum;
  }

  function swlsBand(score) {
    return SW.bands.find((b) => score <= b.max) || SW.bands[SW.bands.length - 1];
  }

  function renderSwlsResult(score) {
    const band = swlsBand(score);
    const copy = XX.COPY.swls[band.key];
    $('#sr-score').textContent = String(score);
    $('#sr-band').textContent = '整体评价：' + band.label;
    $('#sr-explain').textContent = copy.explain;
    $('#sr-lead').textContent = copy.lead;
  }

  /* ==================== 6. BNSG-S ==================== */

  const BN = XX.BNSG;

  function bindBnsg() {
    const list = $('#bnsg-list');
    const bar = $('#bnsg-bar');
    const count = $('#bnsg-count');
    const submit = $('#bnsg-submit');
    const progress = $('#bnsg-progress');

    const update = () => {
      const done = answeredCount(BN, state.bnsgAnswers);
      const total = BN.items.length;
      bar.style.width = (done / total * 100) + '%';
      count.textContent = '已答 ' + done + ' / ' + total;
      progress.setAttribute('aria-valuenow', String(done));
      submit.disabled = done < total;
      Store.set('bnsg.answers', state.bnsgAnswers);
    };

    renderScale(list, BN, state.bnsgAnswers, update);
    update();

    submit.onclick = () => {
      if (answeredCount(BN, state.bnsgAnswers) < BN.items.length) return;
      state.bnsgResult = scoreBnsg(state.bnsgAnswers);
      Store.set('bnsg.result', state.bnsgResult);
      renderBnsgResult(state.bnsgResult);
      location.hash = '#/bnsg-result';
    };
  }

  /**
   * 计分引擎（核心逻辑，与题目解耦）
   *
   * 1) 每个因子得分 = 该因子所有条目之和；item.reverse 的条目先做 1↔5 反向计分。
   * 2) 归一化成「问题指数」0–100，使四个因子可以横向比较：
   *      满足类（sat）  ：得分越低 → 问题指数越高      (max - sum) / (max - min) * 100
   *      受阻类（frust）：得分越高 → 问题指数越高      (sum - min) / (max - min) * 100
   *    这一步对应「不可简单按数值排序」的要求：直接把 4 个原始分排队会把
   *    「自主满足 8 分」和「自主受阻 8 分」当成同一件事，而它们的含义正相反。
   * 3) 按问题指数降序排列，取最高的 1 个；若第 2 个的问题指数也达到 45，
   *    则一并突出（最多 2 个）。
   * 4) 若最高的问题指数不超过 30，判定为「比较均衡」，不下「问题」结论。
   */
  function scoreBnsg(answers) {
    const span = BN.max - BN.min;

    const factors = BN.factors.map((f) => {
      const items = BN.items.filter((i) => i.factor === f.key);
      let sum = 0;
      items.forEach((i) => {
        let v = Number(answers[i.no]);
        if (!Number.isFinite(v)) v = Math.round((BN.min + BN.max) / 2);
        if (i.reverse) v = BN.min + BN.max - v;
        sum += v;
      });
      const min = items.length * BN.min;
      const max = items.length * BN.max;
      const problem = f.kind === 'frust'
        ? (sum - min) / (max - min) * 100
        : (max - sum) / (max - min) * 100;
      return {
        key: f.key,
        name: f.name,
        short: f.short,
        kind: f.kind,
        sum: sum,
        min: min,
        max: max,
        count: items.length,
        avg: sum / items.length,
        problem: Math.round(clamp(problem, 0, 100))
      };
    });

    const ranked = factors.slice().sort((a, b) => b.problem - a.problem);
    const balanced = ranked[0].problem <= 30;
    let focus = balanced ? ranked.slice() : ranked.slice(0, ranked[1].problem >= 45 ? 2 : 1);
    const rest = factors.filter((f) => !focus.some((x) => x.key === f.key));

    return {
      factors, ranked, focus, rest, balanced,
      span,
      at: Date.now()
    };
  }

  function factorCard(f, isFocus, tagText) {
    const copy = XX.COPY.factors[f.key] || { desc: '', advice: '' };
    const pct = f.problem;
    const kindLabel = f.kind === 'sat' ? '满足类' : '受阻类';
    return '' +
      '<div class="factor' + (isFocus ? ' is-focus' : '') + '">' +
        '<div class="factor-top">' +
          '<span class="factor-name">' + esc(f.name) +
            '<span class="muted" style="font-family:var(--font-body);font-size:.78rem;margin-left:8px">' + kindLabel + '</span>' +
          '</span>' +
          (tagText ? '<span class="tag">' + tagText + '</span>' : '') +
        '</div>' +
        '<div class="meter" role="img" aria-label="问题指数 ' + pct + ' / 100">' +
          '<i style="width:' + pct + '%"></i>' +
        '</div>' +
        '<p class="factor-score">原始得分 ' + f.sum + ' / ' + f.max +
          '（均分 ' + f.avg.toFixed(1) + '）· 问题指数 ' + pct + '</p>' +
        '<div class="factor-body" style="margin-top:.6em">' +
          '<p>' + esc(copy.desc) + '</p>' +
          (isFocus ? '<p class="factor-advice"><b>这周可以试试：</b>' + esc(copy.advice) + '</p>' : '') +
        '</div>' +
      '</div>';
  }

  function renderBnsgResult(result) {
    const nameOf = (k) => (BN.factors.find((f) => f.key === k) || {}).name || k;

    // 顶部一句话
    let summary;
    if (result.balanced) {
      summary = XX.COPY.resultIntro.balanced;
    } else if (result.focus.length >= 2) {
      summary = XX.COPY.resultIntro.focusTwo
        .replace('{a}', nameOf(result.focus[0].key))
        .replace('{b}', nameOf(result.focus[1].key));
    } else {
      summary = XX.COPY.resultIntro.focusOne.replace('{name}', nameOf(result.focus[0].key));
    }
    $('#br-summary').textContent = summary;

    // 突出的因子
    const focusEl = $('#br-focus');
    focusEl.innerHTML = result.focus
      .map((f) => factorCard(f, !result.balanced, result.balanced ? '' : '值得先照顾'))
      .join('');

    // 其余因子折叠
    const restEl = $('#br-rest');
    const restWrap = $('#br-rest-wrap');
    if (result.rest.length) {
      restEl.innerHTML = result.rest.map((f) => factorCard(f, false, '')).join('');
      restWrap.hidden = false;
    } else {
      restEl.innerHTML = '';
      restWrap.hidden = true;
    }

    // 推荐
    const recoKey = result.balanced ? 'balanced' : result.focus[0].key;
    $('#br-reco').textContent = XX.COPY.resultReco[recoKey] || XX.COPY.resultReco.balanced;

    // 免责声明（题目未核对时补一句说明，见 js/data/scales.js 的 verified 开关）
    $('#br-notice').innerHTML = XX.COPY.disclaimer +
      (BN.verified ? '' : '<br>本页条目仍在核对完善中，结果仅供自我觉察参考。');
  }

  /* ==================== 7. 横向滑动结果页 ==================== */

  function bindSlider() {
    const slider = $('#swls-slider');
    const dotBox = $('#sr-dots');
    const prev = $('#sr-prev');
    const next = $('#sr-next');
    if (!slider) return;

    const slides = Array.from(slider.children);

    // 生成分页点
    dotBox.innerHTML = '';
    slides.forEach((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', '第 ' + (i + 1) + ' 页');
      b.setAttribute('aria-current', i === 0 ? 'true' : 'false');
      b.addEventListener('click', () => goTo(i));
      dotBox.appendChild(b);
    });

    function currentIndex() {
      const mid = slider.scrollLeft + slider.clientWidth / 2;
      let best = 0, bestD = Infinity;
      slides.forEach((s, i) => {
        const c = s.offsetLeft - slider.offsetLeft + s.offsetWidth / 2;
        const d = Math.abs(c - mid);
        if (d < bestD) { bestD = d; best = i; }
      });
      return best;
    }

    function syncUI() {
      const i = currentIndex();
      $$('button', dotBox).forEach((d, k) => d.setAttribute('aria-current', k === i ? 'true' : 'false'));
      prev.disabled = i === 0;
      next.disabled = i === slides.length - 1;
    }

    function goTo(i) {
      const idx = clamp(i, 0, slides.length - 1);
      const target = slides[idx];
      slider.scrollTo({ left: target.offsetLeft - slider.offsetLeft, behavior: 'smooth' });
    }

    prev.onclick = () => goTo(currentIndex() - 1);
    next.onclick = () => goTo(currentIndex() + 1);

    slider.addEventListener('scroll', () => {
      window.clearTimeout(slider._t);
      slider._t = window.setTimeout(syncUI, 90);
    }, { passive: true });

    slider.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(currentIndex() + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(currentIndex() - 1); }
    });

    // 鼠标拖动横滑（触屏本身即可滑动）
    let dragging = false, startX = 0, startLeft = 0, moved = false;
    slider.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      dragging = true; moved = false;
      startX = e.clientX; startLeft = slider.scrollLeft;
      slider.style.scrollBehavior = 'auto';
    });
    slider.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      slider.scrollLeft = startLeft - dx;
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => {
      slider.addEventListener(ev, () => {
        if (!dragging) return;
        dragging = false;
        slider.style.scrollBehavior = '';
        if (moved) syncUI();
      });
    });

    syncUI();
    // 每次进入该视图都回到第一页
    slider.scrollLeft = 0;
    syncUI();
  }

  /* ==================== 8. 视图钩子 ==================== */

  VIEW_HOOKS.home = () => {};

  VIEW_HOOKS.swls = () => {
    bindSwls();
  };

  VIEW_HOOKS['swls-result'] = () => {
    if (state.swlsScore == null) {
      const saved = Store.get('swls.score');
      if (saved != null) state.swlsScore = saved;
    }
    if (state.swlsScore == null) {
      // 没做过测试直接进来：回到测试页，避免出现「—」的结果页
      location.hash = '#/swls';
      return;
    }
    renderSwlsResult(state.swlsScore);
    bindSlider();
  };

  VIEW_HOOKS.bnsg = () => {
    bindBnsg();
  };

  VIEW_HOOKS['bnsg-result'] = () => {
    if (!state.bnsgResult) {
      const saved = Store.get('bnsg.result');
      if (saved && saved.factors) state.bnsgResult = saved;
    }
    if (!state.bnsgResult) {
      location.hash = '#/bnsg';
      return;
    }
    renderBnsgResult(state.bnsgResult);
  };

  /* ==================== 9. 其他交互 ==================== */

  function bindGlobal() {
    $('#br-restart').addEventListener('click', () => {
      state.bnsgAnswers = {};
      state.bnsgResult = null;
      Store.del('bnsg.answers');
      Store.del('bnsg.result');
      location.hash = '#/bnsg';
    });

    // 顶栏「测试」入口：没做过 SWLS 就从第一段开始
    $$('.topnav a[data-nav="test"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        if (Object.keys(state.swlsAnswers).length === 0) return;   // 默认去 SWLS
        e.preventDefault();
        location.hash = state.bnsgResult ? '#/bnsg-result' : '#/bnsg';
      });
    });
  }

  /* ==================== 10. 启动 ==================== */

  function boot() {
    try {
      if (Store.get('bnsg.result')) state.bnsgResult = Store.get('bnsg.result');
      if (Store.get('swls.score') != null) state.swlsScore = Store.get('swls.score');
    } catch (e) { /* 忽略：首次访问没有存档 */ }

    bindGlobal();
    if (!location.hash) location.replace('#/home');
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* 把计分函数暴露给自动化自测（tests/selftest.mjs），
     让测试直接跑线上同一份逻辑，而不是另抄一份公式。 */
  XX.__scoring = { scoreSwls, swlsBand, scoreBnsg };
})();
