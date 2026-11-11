// Plays any game module through a run, recording its actions: tests use it
// to check that every game runs end to end and replays exactly.

import * as R from '../src/run/run.ts';
import { apply, type Action, type Save } from '../src/run/save.ts';
import type { GameModule, Run } from '../src/run/run.ts';
import { newRng } from '../src/core/rules/rng.ts';

export function playRun(module: GameModule, seed: string | number, maxSteps = 20000): { run: Run; save: Save } {
	const run = R.newRun(module, seed);
	const save: Save = { version: 1, game: module.id, seed, actions: [] };
	const rng = newRng(`${seed}|bot`);
	const go = (a: Action) => {
		save.actions.push(a);
		apply(run, a);
	};
	for (let step = 0; step < maxSteps; step++) {
		const p = run.phase;
		if (p === R.PHASE.OVER || p === R.PHASE.VICTORY) break;
		if ((p === R.PHASE.PRE || p === R.PHASE.PLAY) && (R.skipTag(run) === 'cash' || R.skipTag(run) === 'edition')) go({ t: 'skip' });
		else if (p === R.PHASE.PRE || p === R.PHASE.PLAY) {
			// Use a held ploy when it can help (Spotlight, Encore on the last hand).
			const slot = run.ploys.findIndex((k, i) => (k !== 'encore' || run.handsLeft <= 1) && R.canUsePloy(run, i)[0]);
			if (slot >= 0) go({ t: 'ploy', slot });
			else go({ t: 'game', a: module.bot(run, rng) });
		} else if (p === R.PHASE.SCORED) go({ t: 'next' });
		else if (p === R.PHASE.WON) go({ t: 'shop' });
		else if (p === R.PHASE.SHOP) {
			if (run.opening) {
				const ok = run.opening.options.findIndex((o) => (o.kind === 'relic' ? R.relicSlotsUsed(run) < R.RELIC_SLOTS : o.kind === 'ploy' ? run.ploys.length < R.PLOY_SLOTS : true));
				go({ t: 'pick', index: ok });
				continue;
			}
			const i = run.shop!.items.findIndex((_, k) => R.canBuy(run, k)[0]);
			if (i < 0) go({ t: 'leave' });
			else go({ t: 'buy', slot: i, card: R.needsCard(run.shop!.items[i]) ? rng.pick(run.pack)!.id : undefined });
		}
	}
	return { run, save };
}
