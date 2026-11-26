/* ==========================================================================
   量表配置层 —— 题目、因子归属、计分方向全部集中在这里
   --------------------------------------------------------------------------
   换题、改计分规则只需要改本文件，计分引擎（js/app.js）与页面渲染都不用动。

   · 第一部分 SWLS：生活满意度量表中文版，5 题、7 点计分，总分 5–35，
     均为正向计分，分档见 SWLS.bands（七档）。
   · 第二部分 BNSG-S：基本心理需要满足/受阻量表，15 条目、4 因子、5 点计分。
     条目文本仍在按文献逐条核对（文件顶部 verified 为 false 时，结果页会显示一句提示），
     核对后请把条目替换为文献原文，并把 verified 改为 true、去掉各条的 draft 标记。
     参考来源：中文版基本心理需要满足量表的修订，《中华行为医学与脑科学杂志》
     2012, 21(5)（15 条目，4 因子，累计方差贡献率 63.95%）。
   ========================================================================== */

window.XX = window.XX || {};

/* ---------- 第一部分：生活满意度量表 SWLS（5 题，7 点计分，总分 5–35） ---------- */
XX.SWLS = {
  id: 'swls',
  title: '生活满意度量表',
  min: 1,
  max: 7,
  legend: { low: '强烈反对', high: '强烈同意' },
  instr: '以下 5 项陈述描述的是你对整体生活的评价。请根据你目前的生活状况，选择最符合的同意程度：1 强烈反对 · 2 反对 · 3 有点反对 · 4 中立 · 5 有点同意 · 6 同意 · 7 强烈同意。',

  // 每句一句话，逐条对应 1–7 分
  items: [
    { no: 1, text: '我的生活大致符合我的理想。' },
    { no: 2, text: '我的生活状况非常圆满。' },
    { no: 3, text: '我对自己的生活感到满意。' },
    { no: 4, text: '到目前为止，我已得到生活中想要的重要东西。' },
    { no: 5, text: '如果我能重新活一次，我几乎不会改变任何事。' }
  ],

  // 七档区间：max 为该档上限（含），按上述题目顺序累加后判定
  bands: [
    { key: 'vlow',       max: 9,  label: '非常不满意' },
    { key: 'low',        max: 14, label: '不满意' },
    { key: 'slightLow',  max: 19, label: '略不满意' },
    { key: 'neutral',    max: 20, label: '中立' },
    { key: 'slightHigh', max: 25, label: '略满意' },
    { key: 'high',       max: 30, label: '满意' },
    { key: 'vhigh',      max: 35, label: '非常满意' }
  ]
};

/* ---------- 第二部分：基本心理需要满足/受阻量表 BNSG-S（15 题，5 点计分） ----------
   kind:
     'sat'   = 满足类因子：得分越低，越值得留意
     'frust' = 受阻类因子：得分越高，越值得留意
   引擎按 kind 分别归一化成 0–100 的「问题指数」后再排序，
   所以不会出现「直接把 4 个因子按数值大小排队」的错误。
   item.reverse: true 表示该条在计入因子分前需要反向计分（1↔5）。
----------------------------------------------------------------------------- */
XX.BNSG = {
  id: 'bnsg',
  title: '基本心理需要量表',
  verified: false,          // 【核对后改为 true】
  min: 1,
  max: 5,
  legend: { low: '完全不符合', high: '完全符合' },

  factors: [
    { key: 'autoSat',   name: '自主满足', kind: 'sat',   short: '我能按自己的想法生活' },
    { key: 'autoFru',   name: '自主受阻', kind: 'frust', short: '我常被外界推着走' },
    { key: 'belongSat', name: '归属满足', kind: 'sat',   short: '我有可以依靠的人' },
    { key: 'belongFru', name: '归属受阻', kind: 'frust', short: '我常觉得自己不被理解' }
  ],

  items: [
    // —— 自主满足 ——
    { no: 1,  factor: 'autoSat',   reverse: false, draft: true, text: '我能够按照自己真实的想法去安排生活。' },
    { no: 2,  factor: 'autoSat',   reverse: false, draft: true, text: '在对自己重要的事情上，我有选择的权利。' },
    { no: 3,  factor: 'autoSat',   reverse: false, draft: true, text: '我做的决定大多是发自内心的，而不是被逼出来的。' },
    { no: 4,  factor: 'autoSat',   reverse: false, draft: true, text: '我可以说出自己真实的想法，而不必担心被否定。' },
    // —— 自主受阻 ——
    { no: 5,  factor: 'autoFru',   reverse: false, draft: true, text: '很多时候，我做出的选择并不是我真正想要的。' },
    { no: 6,  factor: 'autoFru',   reverse: false, draft: true, text: '我觉得自己的生活是被外界的要求推着往前走的。' },
    { no: 7,  factor: 'autoFru',   reverse: false, draft: true, text: '我常常因为怕麻烦，而放弃自己原本想做的事。' },
    { no: 8,  factor: 'autoFru',   reverse: false, draft: true, text: '我很少有机会按自己的节奏做事。' },
    // —— 归属满足 ——
    { no: 9,  factor: 'belongSat', reverse: false, draft: true, text: '我身边有可以放心依靠的人。' },
    { no: 10, factor: 'belongSat', reverse: false, draft: true, text: '和亲近的人在一起时，我是放松的。' },
    { no: 11, factor: 'belongSat', reverse: false, draft: true, text: '我觉得自己是某个群体里真正的一员。' },
    { no: 12, factor: 'belongSat', reverse: false, draft: true, text: '当我需要的时候，有人愿意认真听我说话。' },
    // —— 归属受阻 ——
    { no: 13, factor: 'belongFru', reverse: false, draft: true, text: '我常常觉得，身边的人并不真正了解我。' },
    { no: 14, factor: 'belongFru', reverse: false, draft: true, text: '在人群里，我有时会觉得自己是多余的。' },
    { no: 15, factor: 'belongFru', reverse: false, draft: true, text: '我很难向别人开口，说出自己的难处。' }
  ]
};
