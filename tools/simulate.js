#!/usr/bin/env node
/*
 * Проверка баланса: бот-стратег играет N кампаний на каждой сложности.
 * Запуск: node tools/simulate.js [N=30] [easy|normal|hard|all]
 */
'use strict';
const { runCampaign } = require('./bot.js');

const N = Number(process.argv[2]) || 30;
const which = process.argv[3] || 'all';
const diffs = which === 'all' ? ['easy', 'normal', 'hard'] : [which];

for (const d of diffs) {
  const t0 = Date.now();
  const res = [];
  for (let i = 0; i < N; i++) res.push(runCampaign(1000 + i * 7919, d, 200));
  const wins = res.filter((r) => r.victory);
  const avg = (arr, f) => (arr.length ? (arr.reduce((a, x) => a + f(x), 0) / arr.length).toFixed(1) : '—');
  const by = {};
  for (const r of res) by[r.result] = (by[r.result] || 0) + 1;
  console.log('\n=== Сложность: ' + d + ' (' + N + ' кампаний, ' + ((Date.now() - t0) / 1000).toFixed(1) + ' с) ===');
  console.log('Побед: ' + wins.length + ' из ' + N + ' (' + Math.round((wins.length / N) * 100) + '%)');
  console.log('Исходы: ' + Object.keys(by).map((k) => k + ' ' + by[k]).join(', '));
  console.log('Средний день окончания: ' + avg(res, (r) => r.day) + ', сигнал флоту в среднем на день ' + avg(res.filter((r) => r.signalDay), (r) => r.signalDay));
  console.log('Выживших в победах: ' + avg(wins, (r) => r.alive) + ', погибших в среднем: ' + avg(res, (r) => r.deaths) + ', боёв: ' + avg(res, (r) => r.battles));
  console.log('Средний счёт: ' + avg(res, (r) => r.score));
}
