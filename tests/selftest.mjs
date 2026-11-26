/* ==========================================================================
   自测脚本 —— 在 Node 里直接跑页面用的那一份计分逻辑
   --------------------------------------------------------------------------
   用法（在 site 目录下）：
       node tests/selftest.mjs
   --------------------------------------------------------------------------
   它把 js/data/*.js 与 js/app.js 一起放进 vm 沙箱执行（模拟 window / document /
   localStorage），再从 XX.__scoring 取出计分函数做断言。
   这样测的是浏览器里真正运行的那份代码，而不是另写一份公式。
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ROOT = path.resolve(import.meta.dirname, '..');
const SANDBOX_FILES = [
  'js/data/scales.js',
  'js/data/copy.js',
  'js/data/tarot.js',
  'js/app.js'
];

/* ---------- 最小化的浏览器环境 ---------- */
function makeSandbox() {
  const mem = new Map();
  const sandbox = {
    console,
    document: {
      // 'loading' 让 app.js 把 boot() 挂到 DOMContentLoaded 上而不立即执行，
      // 于是我们只测计分逻辑，不需要真的 DOM。
      readyState: 'loading',
      addEventListener() {},
      querySelector: () => null,
      querySelectorAll: () => []
    },
    location: { hash: '', replace() {} },
    localStorage: {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => { mem.set(k, String(v)); },
      removeItem: (k) => { mem.delete(k); }
    },
    setTimeout: () => 0,
    clearTimeout: () => {},
    addEventListener() {},
    scrollTo() {},
    Math, Date, JSON, Number, String, Boolean, Array, Object, Error, isNaN, parseInt, parseFloat
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return vm.createContext(sandbox);
}

const ctx = makeSandbox();
for (const f of SANDBOX_FILES) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}

const XX = ctx.XX;
const S = XX.__scoring;
const BN = XX.BNSG;
const SW = XX.SWLS;
const C = XX.COPY;
const T = XX.TAROT;

/* ---------- 断言小工具 ---------- */
let pass = 0;
const ok = (label, fn) => {
  try { fn(); pass++; console.log('  ✓ ' + label); }
  catch (e) { console.error('  ✗ ' + label + '\n    ' + e.message); process.exitCode = 1; }
};

const answersAll = (v) => Object.fromEntries(BN.items.map((i) => [i.no, v]));
const byKey = (r, k) => r.factors.find((f) => f.key === k);

/* ---------- 1. 数据完整性 ---------- */
console.log('\n[1] 量表数据');
ok('BNSG-S 共 15 题', () => assert.equal(BN.items.length, 15));
ok('四因子条目数 4/4/4/3', () => {
  const counts = BN.factors.map((f) => BN.items.filter((i) => i.factor === f.key).length);
  assert.equal(counts.join(','), '4,4,4,3');
});
ok('每题都有 factor 且属于已声明因子', () => {
  const keys = BN.factors.map((f) => f.key);
  BN.items.forEach((i) => assert.ok(keys.includes(i.factor), '第 ' + i.no + ' 题因子非法'));
});
ok('题号 1–15 不重复', () => {
  assert.equal(BN.items.map((i) => i.no).sort((a, b) => a - b).join(','),
    Array.from({ length: 15 }, (_, k) => k + 1).join(','));
});
ok('SWLS 共 5 题、7 点、总分上限 35', () => {
  assert.equal(SW.items.length, 5);
  assert.equal(SW.min, 1); assert.equal(SW.max, 7);
  assert.equal(SW.items.length * SW.max, 35);
});

/* ---------- 2. 方向归一：满足类 / 受阻类 ---------- */
console.log('\n[2] 计分方向（关键：不可简单按数值排序）');
ok('全选 1 分：满足类问题指数 100，受阻类 0', () => {
  const r = S.scoreBnsg(answersAll(1));
  assert.equal(byKey(r, 'autoSat').problem, 100);
  assert.equal(byKey(r, 'belongSat').problem, 100);
  assert.equal(byKey(r, 'autoFru').problem, 0);
  assert.equal(byKey(r, 'belongFru').problem, 0);
});
ok('全选 5 分：受阻类 100，满足类 0', () => {
  const r = S.scoreBnsg(answersAll(5));
  assert.equal(byKey(r, 'autoFru').problem, 100);
  assert.equal(byKey(r, 'belongFru').problem, 100);
  assert.equal(byKey(r, 'autoSat').problem, 0);
});
ok('全选 3 分：四因子都在 50 附近，且同时突出 2 个', () => {
  const r = S.scoreBnsg(answersAll(3));
  r.factors.forEach((f) => assert.equal(f.problem, 50));
  assert.equal(r.balanced, false);
  assert.equal(r.focus.length, 2);
});
ok('同一分数在两类因子上含义相反（原始分都是 8，问题指数不同）', () => {
  // 自主满足 4 题全选 2 = 8 分；自主受阻 4 题全选 2 = 8 分
  const ans = answersAll(3);
  BN.items.filter((i) => i.factor === 'autoSat').forEach((i) => { ans[i.no] = 2; });
  BN.items.filter((i) => i.factor === 'autoFru').forEach((i) => { ans[i.no] = 2; });
  const r = S.scoreBnsg(ans);
  const sat = byKey(r, 'autoSat'), fru = byKey(r, 'autoFru');
  assert.equal(sat.sum, fru.sum, '两边原始分应相同');
  assert.ok(sat.problem > 50 && fru.problem < 50,
    '原始分相同时，问题指数必须一高一低（得到 ' + sat.problem + ' / ' + fru.problem + '）');
});

/* ---------- 3. 反向计分 ---------- */
console.log('\n[3] 反向计分');
ok('reverse 条目先做 1↔5 换算再累加', () => {
  const target = BN.items.find((i) => i.factor === 'autoSat');
  const ans = answersAll(3);
  ans[target.no] = 1;
  const before = byKey(S.scoreBnsg(ans), 'autoSat').sum;
  target.reverse = true;
  const after = byKey(S.scoreBnsg(ans), 'autoSat').sum;
  target.reverse = false;
  assert.equal(after - before, 4, '反向计分应让该条从 1 分变成 5 分（差 4）');
});

/* ---------- 4. 突出规则 ---------- */
console.log('\n[4] 突出 1–2 个因子的规则');
ok('明显偏高时只突出 1 个', () => {
  // 归属满足压到 1 分（问题指数 100），另外三个因子只到 25 分左右（< 45）
  const ans = {};
  BN.items.forEach((i) => {
    const f = BN.factors.find((x) => x.key === i.factor);
    if (f.key === 'belongSat') ans[i.no] = 1;
    else if (f.kind === 'sat') ans[i.no] = 4;
    else ans[i.no] = 2;
  });
  const r = S.scoreBnsg(ans);
  assert.equal(r.balanced, false);
  assert.equal(r.focus.length, 1);
  assert.equal(r.focus[0].key, 'belongSat');
  assert.equal(r.focus[0].problem, 100);
  assert.ok(r.ranked[1].problem < 45, '第二名应低于 45，实际 ' + r.ranked[1].problem);
});
ok('问题指数都不高时判为均衡，且不贴「问题」标签', () => {
  const ans = {};
  BN.items.forEach((i) => {
    const f = BN.factors.find((x) => x.key === i.factor);
    ans[i.no] = f.kind === 'sat' ? 5 : 1;   // 满足类拉满、受阻类压到底 = 最健康
  });
  const r = S.scoreBnsg(ans);
  assert.equal(r.balanced, true);
  assert.ok(r.ranked[0].problem <= 30);
});
ok('focus 与 rest 不重叠、并集为全部 4 个因子', () => {
  const r = S.scoreBnsg(answersAll(2));
  const all = [...r.focus, ...r.rest].map((f) => f.key).sort();
  assert.equal(all.join(','), 'autoFru,autoSat,belongFru,belongSat');
});
ok('缺失作答按中点 3 分兜底，不产生 NaN', () => {
  const r = S.scoreBnsg({ 1: 5 });
  r.factors.forEach((f) => assert.ok(Number.isFinite(f.problem)));
});

/* ---------- 5. SWLS 分档 ---------- */
console.log('\n[5] SWLS 分档');
ok('七档：5–35 的每个关键分数都落在正确档位', () => {
  const cases = [[5, 'vlow'], [9, 'vlow'], [10, 'low'], [14, 'low'], [15, 'slightLow'],
    [19, 'slightLow'], [20, 'neutral'], [21, 'slightHigh'], [25, 'slightHigh'],
    [26, 'high'], [30, 'high'], [31, 'vhigh'], [35, 'vhigh']];
  cases.forEach(([score, key]) => assert.equal(S.swlsBand(score).key, key, score + ' 分应落在 ' + key));
});
ok('七档标签与档位一一对应，且覆盖 5–35 无空隙', () => {
  assert.equal(SW.bands.length, 7);
  assert.equal(SW.bands[SW.bands.length - 1].max, 35);
  SW.bands.forEach((b, i) => {
    assert.ok(b.label, '第 ' + (i + 1) + ' 档缺 label');
    if (i > 0) assert.ok(b.max > SW.bands[i - 1].max, '档位上界必须递增');
  });
  assert.equal(S.swlsBand(5).label, '非常不满意');
  assert.equal(S.swlsBand(35).label, '非常满意');
});

/* ---------- 6. 文案齐全性 ---------- */
console.log('\n[6] 文案');
ok('四因子都有 desc + advice，且建议不是空话', () => {
  BN.factors.forEach((f) => {
    const c = C.factors[f.key];
    assert.ok(c && c.desc && c.advice, f.key + ' 文案缺失');
    assert.ok(c.advice.length >= 20, f.key + ' 的建议太短');
  });
});
ok('七档 SWLS 文案、三种结果开场、推荐语齐全', () => {
  SW.bands.forEach((b) => assert.ok(C.swls[b.key] && C.swls[b.key].explain && C.swls[b.key].lead,
    '缺 ' + b.key + ' 的文案'));
  ['focusOne', 'focusTwo', 'balanced'].forEach((k) => assert.ok(C.resultIntro[k]));
  ['autoSat', 'autoFru', 'belongSat', 'belongFru', 'balanced'].forEach((k) => assert.ok(C.resultReco[k]));
});
ok('空话黑名单：没有「多关注当下」「你要坚强」', () => {
  const all = JSON.stringify(C);
  ['多关注当下', '你要坚强', '放轻松就好'].forEach((bad) => assert.ok(!all.includes(bad), '出现禁用语：' + bad));
});
ok('免责声明含「不能替代」与求助指引', () => {
  assert.ok(C.disclaimer.includes('不能替代'));
  assert.ok(C.disclaimer.includes('咨询') || C.disclaimer.includes('求助'));
});
ok('池底纸条 ≥ 10 条且非空', () => {
  assert.ok(C.pool.length >= 10);
  C.pool.forEach((t) => assert.ok(t.trim().length >= 8));
});

/* ---------- 7. 塔罗数据 ---------- */
console.log('\n[7] 塔罗牌');
ok('22 张大阿卡纳，编号与罗马数字都不重复', () => {
  assert.equal(T.cards.length, 22);
  assert.equal(new Set(T.cards.map((c) => c.id)).size, 22);
  assert.equal(new Set(T.cards.map((c) => c.no)).size, 22);
  assert.equal(new Set(T.cards.map((c) => c.roman)).size, 22);
  assert.equal(T.cards.map((c) => c.no).sort((a, b) => a - b).join(','),
    Array.from({ length: 22 }, (_, k) => k).join(','));
});
ok('每张牌都有正位 / 逆位的关键词与牌义', () => {
  T.cards.forEach((c) => {
    ['up', 'rev'].forEach((side) => {
      assert.ok(c[side] && c[side].key && c[side].text, c.name + ' 缺 ' + side);
      assert.ok(c[side].text.length >= 20, c.name + ' 的 ' + side + ' 牌义太短');
      assert.ok(c[side].text !== c.up.text || side === 'up', c.name + ' 逆位不应照抄正位');
    });
  });
});
ok('RWS 编号：8 = 力量、11 = 正义', () => {
  assert.equal(T.cards.find((c) => c.no === 8).id, 'strength');
  assert.equal(T.cards.find((c) => c.no === 11).id, 'justice');
});
ok('22 张牌面图片齐全（images/tarot/<两位序号>-<id>.jpg）', () => {
  T.cards.forEach((c) => {
    const f = path.join(ROOT, T.assetDir, String(c.no).padStart(2, '0') + '-' + c.id + '.jpg');
    assert.ok(fs.existsSync(f), '缺图：' + f);
  });
});

console.log('\n' + (process.exitCode ? '有断言失败' : '全部通过：' + pass + ' 项'));
