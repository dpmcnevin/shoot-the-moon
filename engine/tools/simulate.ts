// Headless balance simulator. Run with: node tools/simulate.ts [runs] [prefix]
// (EDITIONS=1 for relic editions, BOSSES=1 for bosses, MORE=1 for the expansion relics;
// IPAD=1 for all the iPad's rules;
// TABLE_BASE=34,67,... to try other targets; with RULESET, BOSSES=0/1 overrides it.
// For how hard each boss is, see tools/boss-test.ts.)

import * as run_ from '../src/game/run.ts';
import { playRun } from './bot.ts';

const runs = Number(process.argv[2]) || 300;
const tableBase = process.env.TABLE_BASE?.split(',').map(Number);
const opts: run_.RunOptions = process.env.RULESET ? { ruleset: process.env.RULESET as run_.RulesetName, ...(tableBase ? { tableBase } : {}), ...(process.env.BOSSES ? { bosses: process.env.BOSSES === '1' } : {}) } : {
	editions: process.env.EDITIONS === '1' || process.env.IPAD === '1',
	noRepeats: process.env.IPAD === '1',
	bosses: process.env.BOSSES ? process.env.BOSSES === '1' : process.env.IPAD === '1',
	moreRelics: process.env.MORE ? process.env.MORE === '1' : process.env.IPAD === '1',
	moonAI: process.env.MOONAI ? process.env.MOONAI === '1' : process.env.IPAD === '1',
	aiCurve: process.env.CURVE ? process.env.CURVE === '1' : process.env.IPAD === '1',
	...(tableBase ? { tableBase } : {})
};
const prefix = process.argv[3] ?? 'SIM';
const reached: Record<number, number> = {};
const deaths: Record<string, number> = {};
let wins = 0,
	moons = 0,
	hands = 0;
const scores: number[] = [];
for (let i = 1; i <= runs; i++) {
	const run = playRun(prefix + i, opts);
	if (run.phase === run_.PHASE.VICTORY) wins++;
	const t = Math.min(run.table, run_.TABLES);
	reached[t] = (reached[t] ?? 0) + 1;
	if (run.phase === run_.PHASE.GAME_OVER) deaths[`${run.table}.${run.board}`] = (deaths[`${run.table}.${run.board}`] ?? 0) + 1;
	moons += run.stats.moons;
	hands += run.stats.handsPlayed;
	for (const e of run.log) scores.push(e.score);
}
console.log(`\n${runs} runs | victories ${wins} (${((100 * wins) / runs).toFixed(1)}%) | moons ${moons} in ${hands} hands`);
console.log('\nFurthest table reached:');
for (let t = 1; t <= run_.TABLES; t++) {
	const n = reached[t] ?? 0;
	console.log(`  table ${t}  ${String(n).padStart(4)}  ${'#'.repeat(Math.floor((60 * n) / runs))}`);
}
console.log('\nWhere runs ended:');
for (const k of Object.keys(deaths).sort((a, b) => {
	const [ta, ba] = a.split('.').map(Number), [tb, bb] = b.split('.').map(Number);
	return ta - tb || ba - bb;
})) {
	const [t, b] = k.split('.').map(Number);
	console.log(`  ${k}  target ${String(run_.targetFor(t, b, tableBase)).padStart(6)}  deaths ${deaths[k]}`);
}
scores.sort((a, b) => a - b);
const pct = (p: number) => scores[Math.max(0, Math.floor(scores.length * p) - 1)];
console.log(`\nPer-hand score  p25 ${pct(0.25)}  median ${pct(0.5)}  p75 ${pct(0.75)}  p95 ${pct(0.95)}`);
