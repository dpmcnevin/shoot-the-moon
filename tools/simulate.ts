// Headless balance simulator. Run with: node tools/simulate.ts [runs] [prefix]

import * as run_ from '../src/lib/game/run.ts';
import { playRun } from './bot.ts';

const runs = Number(process.argv[2]) || 300;
const prefix = process.argv[3] ?? 'SIM';
const reached: Record<number, number> = {};
const deaths: Record<string, number> = {};
let wins = 0,
	moons = 0,
	hands = 0;
const scores: number[] = [];
for (let i = 1; i <= runs; i++) {
	const run = playRun(prefix + i);
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
	console.log(`  ${k}  target ${String(run_.targetFor(t, b)).padStart(6)}  deaths ${deaths[k]}`);
}
scores.sort((a, b) => a - b);
const pct = (p: number) => scores[Math.max(0, Math.floor(scores.length * p) - 1)];
console.log(`\nPer-hand score  p25 ${pct(0.25)}  median ${pct(0.5)}  p75 ${pct(0.75)}  p95 ${pct(0.95)}`);
