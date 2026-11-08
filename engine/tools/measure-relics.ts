// Measure every relic for the bot's shopping table (tools/relic-values.ts):
// the bot's win rate starting a run with that relic, less its win rate with
// none. Run with: node tools/measure-relics.ts [runs] [shard/of] [ruleset]
// Prints "key<TAB>win%" lines (key "none" is the baseline); shards split the
// work so several processes can run at once. Combine and write the table
// with: node tools/measure-relics.ts --write <files...>

import { readFileSync, writeFileSync } from 'node:fs';
import * as R from '../src/game/run.ts';
import * as relics from '../src/game/relics.ts';
import { playRunFrom } from './bot.ts';

if (process.argv[2] === '--write') {
	const rates = new Map<string, number>();
	for (const f of process.argv.slice(3))
		for (const line of readFileSync(f, 'utf8').split('\n')) {
			const [k, v] = line.split('\t');
			if (k && v) rates.set(k, Number(v));
		}
	const base = rates.get('none');
	if (base === undefined) throw new Error('no baseline (key "none") in the files');
	rates.delete('none');
	const rows = [...rates].map(([k, v]) => [k, v - base] as const).sort((a, b) => b[1] - a[1]);
	const out = `// How much each relic helps the bot, measured: its win rate starting a run
// with that relic, less the win rate with none (ruleset v4, baseline
// ${base.toFixed(1)}%). The bot shops by these, so it is a fairer stand-in for a
// person choosing relics than shopping by rarity and price. Regenerate with
// tools/measure-relics.ts after changing relics or rules.

export const RELIC_VALUE: Record<string, number> = {
${rows.map(([k, v]) => `\t${k}: ${v.toFixed(1)},`).join('\n')}
};
`;
	writeFileSync(new URL('./relic-values.ts', import.meta.url), out);
	console.log(`wrote ${rows.length} relics`);
} else {
	const runs = Number(process.argv[2]) || 400;
	const [shard, of] = (process.argv[3] ?? '0/1').split('/').map(Number);
	const ruleset = (process.argv[4] ?? 'v4') as R.RulesetName;
	const keys = ['none', ...relics.DEFS.map((d) => d.key)].filter((_, i) => i % of === shard);
	for (const key of keys) {
		let wins = 0;
		for (let i = 1; i <= runs; i++) {
			const run = R.newRun('RV' + i, { ruleset });
			if (key !== 'none') run.relics.push(relics.instantiate(relics.get(key)!, undefined, run.balance));
			if (playRunFrom(run).phase === R.PHASE.VICTORY) wins++;
		}
		console.log(`${key}\t${((100 * wins) / runs).toFixed(2)}`);
	}
}
