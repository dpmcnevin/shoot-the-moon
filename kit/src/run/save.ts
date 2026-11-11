// A run is its game, seed and actions: replaying the actions through the
// engine rebuilds it exactly, whatever the game.

import * as R from './run.ts';
import type { GameModule, Run } from './run.ts';

export type Action =
	| { t: 'game'; a: unknown }
	| { t: 'next' }
	| { t: 'shop' }
	| { t: 'buy'; slot: number; card?: number }
	| { t: 'pick'; index: number }
	| { t: 'skip' }
	| { t: 'endless' }
	| { t: 'sell'; slot: number }
	| { t: 'reroll' }
	| { t: 'leave' }
	| { t: 'ploy'; slot: number };

export interface Save {
	version: 1;
	game: string;
	seed: string | number;
	/** The starting deck (Standard if absent). */
	deck?: string;
	actions: Action[];
}

export function apply(run: Run, a: Action) {
	switch (a.t) {
		case 'game':
			return R.act(run, a.a);
		case 'next':
			return R.next(run);
		case 'shop':
			return R.enterShop(run);
		case 'buy':
			return R.buy(run, a.slot, a.card);
		case 'pick':
			return R.pick(run, a.index);
		case 'skip':
			return R.skipBoard(run);
		case 'endless':
			return R.goEndless(run);
		case 'sell':
			return R.sellRelic(run, a.slot);
		case 'reroll':
			return R.reroll(run);
		case 'leave':
			return R.leaveShop(run);
		case 'ploy':
			return R.usePloy(run, a.slot);
	}
}

export function replay(module: GameModule, save: Save): Run {
	if (save.game !== module.id) throw new Error(`save is for ${save.game}, not ${module.id}`);
	const run = R.newRun(module, save.seed, { deck: save.deck });
	for (const a of save.actions) apply(run, a);
	return run;
}
