// Paired boss test: node tools/boss-test.ts [runs]. Plays v3 runs with bosses
// off; at each High Board, forks the state and plays just that board with each
// boss and with a ruleless one (so boss-board relics count in both), then
// prints how many more High Boards each boss loses than the same boards
// without it.
import * as run_ from '../src/game/run.ts';
import * as bosses from '../src/game/bosses.ts';
import * as bot from './bot.ts';
import type { Run } from '../src/game/run.ts';

function clone<T>(x: T, seen = new Map()): T {
	if (x === null || typeof x !== 'object') return x;
	if (seen.has(x)) return seen.get(x);
	if (Array.isArray(x)) { const a: any[] = []; seen.set(x, a); for (const v of x) a.push(clone(v, seen)); return a as T; }
	const o = Object.create(Object.getPrototypeOf(x)); seen.set(x, o);
	for (const k of Object.keys(x)) o[k] = clone((x as any)[k], seen);
	return o;
}

const N = Number(process.argv[2]) || 300;
const keys = [null, ...bosses.BOSS_KEYS] as (bosses.BossKey | null)[];
const stat: Record<string, { n: number; lost: number; ratio: number; t: number }> = {};
const atFork = (x: Run) => x.phase === run_.PHASE.BOARD_WON && x.board === run_.BOARDS_PER_TABLE - 1;
const over = (x: Run) => x.phase === run_.PHASE.GAME_OVER || x.phase === run_.PHASE.VICTORY;
for (let i = 1; i <= N; i++) {
	const run = run_.newRun('PB' + i, { ruleset: 'v3', bosses: false });
	while (true) {
		bot.playUntil(run, (x) => atFork(x) || over(x));
		if (over(run)) break;
		const maxTier = run.table >= 6 ? 3 : run.table >= 3 ? 2 : 1;
		for (const key of keys) {
			if (key !== null && bosses.bossAt(key, 3).tier > maxTier) continue;
			const c = clone(run);
			c.bosses = true; // a ruleless boss as the control, so boss-board relics count in both
			c.boss = (key ?? 'none') as any;
			const table = c.table;
			bot.shop(c); // leaves the shop and starts the High Board
			bot.playUntil(c, (x) => x.phase === run_.PHASE.BOARD_WON || over(x));
			const won = c.phase !== run_.PHASE.GAME_OVER;
			for (const tier of [1, 2, 3]) {
				if (tier > maxTier || (key !== null && bosses.bossAt(key, 3).tier !== tier)) continue;
				const s = (stat[`${key ?? 'none'}|${tier}`] ??= { n: 0, lost: 0, ratio: 0, t: 0 });
				s.n++; if (!won) s.lost++; s.ratio += Math.log(Math.max(1, c.score) / c.target); s.t += table;
			}
		}
		bot.playUntil(run, (x) => !atFork(x));
	}
}
const rows = Object.entries(stat)
	.filter(([k]) => !k.startsWith('none|'))
	.map(([k, v]) => {
		const [b, tier] = k.split('|');
		const base = stat[`none|${tier}`];
		const lost = (100 * v.lost) / v.n, without = (100 * base.lost) / base.n;
		return { b, tier, n: v.n, lost, without, ratio: Math.exp(v.ratio / v.n - base.ratio / base.n) };
	})
	.sort((a, b) => b.lost - b.without - (a.lost - a.without));
for (const r of rows)
	console.log(`${r.b.padEnd(13)} tier ${r.tier}  n ${String(r.n).padStart(5)}  lost ${r.lost.toFixed(1).padStart(5)}%  without ${r.without.toFixed(1).padStart(5)}%  +${(r.lost - r.without).toFixed(1).padStart(5)}  score/goal x${r.ratio.toFixed(2)}`);
