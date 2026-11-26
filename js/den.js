/* ==========================================================================
   树洞页逻辑 —— 本地存储版
   · 纸条只写入 localStorage，不上传、不联网；
   · 池底纸条为预置数组（js/data/copy.js 的 XX.COPY.pool），随机捞取；
   · 每日限次 3 次：记录 { date: 'YYYY-MM-DD', n: 次数 }，跨天自动清零。
   ========================================================================== */

window.XX = window.XX || {};

(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const LIMIT = 3;
  const MAX_NOTES = 50;

  const Store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem('xinxu.' + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, val) {
      try { localStorage.setItem('xinxu.' + key, JSON.stringify(val)); } catch (e) { /* 隐私模式忽略 */ }
    }
  };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const todayKey = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };

  const fmtTime = (ts) => {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  };

  /* ---------- 纸条列表 ---------- */
  function renderNotes() {
    const list = Store.get('den.notes', []);
    const ul = $('#den-notes');
    const empty = $('#den-empty');
    ul.innerHTML = '';

    if (!list.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    list.forEach((n) => {
      const li = document.createElement('li');
      li.className = 'note';
      li.innerHTML = esc(n.text) + '<time>' + fmtTime(n.at) + '</time>' +
        '<button class="note-del" type="button" aria-label="删除这张纸条" data-id="' + n.id + '">×</button>';
      ul.appendChild(li);
    });
  }

  function saveNote() {
    const ta = $('#den-text');
    const text = ta.value.trim();
    if (!text) { ta.focus(); return; }

    const list = Store.get('den.notes', []);
    list.unshift({ id: 'n' + Date.now() + Math.floor(Math.random() * 1000), text: text, at: Date.now() });
    Store.set('den.notes', list.slice(0, MAX_NOTES));
    ta.value = '';
    updateCount();
    renderNotes();
  }

  function deleteNote(id) {
    const list = Store.get('den.notes', []).filter((n) => n.id !== id);
    Store.set('den.notes', list);
    renderNotes();
  }

  /* ---------- 池底捞取 ---------- */
  function drawState() {
    const rec = Store.get('den.draw', null);
    if (!rec || rec.date !== todayKey()) return { date: todayKey(), n: 0 };
    return rec;
  }

  function renderLeft() {
    const rec = drawState();
    const left = Math.max(0, LIMIT - rec.n);
    const el = $('#den-left');
    el.textContent = left > 0 ? '今天还能捞 ' + left + ' 次' : '今天的 3 次已经用完，明天再来';
    $('#den-draw').disabled = left === 0;
  }

  function drawBottle() {
    const rec = drawState();
    if (rec.n >= LIMIT) return;

    const pool = XX.COPY.pool;
    const text = pool[Math.floor(Math.random() * pool.length)];

    Store.set('den.draw', { date: rec.date, n: rec.n + 1 });

    const box = $('#den-bottle');
    box.hidden = false;
    box.innerHTML = esc(text) + '<span class="from">— 池底的一张纸条</span>';
    renderLeft();
  }

  /* ---------- 计数 ---------- */
  function updateCount() {
    const ta = $('#den-text');
    $('#den-count').textContent = ta.value.length + ' / ' + ta.maxLength;
  }

  /* ---------- 绑定 ---------- */
  function bind() {
    const ta = $('#den-text');
    if (!ta || ta.dataset.bound === '1') return;
    ta.dataset.bound = '1';

    ta.addEventListener('input', updateCount);

    $('#den-save').addEventListener('click', saveNote);
    $('#den-clear').addEventListener('click', () => { ta.value = ''; updateCount(); ta.focus(); });
    $('#den-draw').addEventListener('click', drawBottle);

    $('#den-notes').addEventListener('click', (e) => {
      const btn = e.target.closest('.note-del');
      if (btn) deleteNote(btn.dataset.id);
    });

    // Ctrl / Cmd + Enter 快速保存
    ta.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); saveNote(); }
    });

    updateCount();
    renderNotes();
    renderLeft();
  }

  window.addEventListener('hashchange', bind);
  document.addEventListener('DOMContentLoaded', bind);
  bind();
})();
