/* ==========================================================================
   塔罗页逻辑 —— 从 22 张大阿卡纳中随机抽一张，正 / 逆位概率各半
   随机数按任务书要求只使用 Math.random()，不要求密码学随机。
   ========================================================================== */

window.XX = window.XX || {};

(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);

  let busy = false;
  let lastId = null;

  const POS = { up: '正位', rev: '逆位' };

  function pickCard() {
    const deck = XX.TAROT.cards;
    let card = deck[Math.floor(Math.random() * deck.length)];
    // 避免连续两次抽到同一张，手感更好（仍为均匀随机的一种可接受变体）
    if (deck.length > 1 && card.id === lastId) {
      card = deck[(deck.indexOf(card) + 1) % deck.length];
    }
    lastId = card.id;
    return card;
  }

  function draw() {
    if (busy) return;

    const wrap = $('#tarot-card');
    const front = $('#tarot-front');
    const wasFlipped = wrap.classList.contains('is-flipped');

    const card = pickCard();
    const reversed = Math.random() < 0.5;
    const side = reversed ? 'rev' : 'up';
    const reading = card[side];

    const reveal = () => {
      XX.TarotArt.renderFront(card, front);
      front.classList.toggle('is-rev', reversed);

      $('#tarot-name').textContent = card.name + ' · ' + POS[side];
      $('#tr-title').textContent = card.name + '　' + card.en;
      $('#tr-pos').textContent = '第 ' + card.no + ' 号 · ' + card.roman + ' · ' + POS[side];
      $('#tr-key').textContent = reading.key;
      $('#tr-text').textContent = reading.text;

      wrap.classList.add('is-flipped');
      $('#tarot-read').hidden = false;
      $('#tarot-draw').hidden = true;
      $('#tarot-again').hidden = false;

      window.setTimeout(() => { busy = false; }, 400);
    };

    busy = true;

    if (wasFlipped) {
      // 已经翻开：先翻回背面，再揭新牌
      wrap.classList.remove('is-flipped');
      $('#tarot-read').hidden = true;
      window.setTimeout(reveal, 420);
    } else {
      reveal();
    }
  }

  function bind() {
    const card = $('#tarot-card');
    if (!card || card.dataset.bound === '1') return;
    card.dataset.bound = '1';

    $('#tarot-draw').addEventListener('click', draw);
    $('#tarot-again').addEventListener('click', draw);
    card.addEventListener('click', () => {
      if (card.classList.contains('is-flipped')) draw();
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); draw(); }
    });
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', '塔罗牌，点击抽牌');
  }

  // 路由切到塔罗页时初始化（app.js 的 render 之后执行）
  window.addEventListener('hashchange', bind);
  document.addEventListener('DOMContentLoaded', bind);
  bind();
})();
