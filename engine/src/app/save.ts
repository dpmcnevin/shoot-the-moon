// Auto-save, by replay (the same design as Vulnerable).
//
// The engine is seeded and deterministic, so a run is its seed plus the list
// of actions taken. The game applies every action through `applyAction` and
// appends it to the log; loading replays the log through the same function.

import * as H from '../rules/hearts.ts';
import * as R from '../game/run.ts';
import type { Card } from '../rules/cards.ts';
import type { Run } from '../game/run.ts';
import type { Trick } from '../rules/hearts.ts';

export type Action =
	| { t: 'pass'; cards: number[] }
	| { t: 'play'; card: number }
	| { t: 'ai' }
	| { t: 'playOut' }
	| { t: 'continue' }
	| { t: 'shop' }
	| { t: 'buy'; slot: number; card?: number }
	| { t: 'sellRelic'; slot: number }
	| { t: 'reroll' }
	| { t: 'leave' }
	| { t: 'ploy'; slot: number }
	| { t: 'pick'; index: number }
	| { t: 'skip' }
	| { t: 'endless' };

export interface Save {
	version: number;
	seed: string | number;
	actions: Action[];
	/** Run options (the iPad app turns on editions); absent on web saves. */
	opts?: R.RunOptions;
	/** The run's id in the player's profile (its history entry). */
	id?: string;
}

export const SAVE_VERSION = 3; // 3: the pack can change; cards are saved by id
const STORAGE_KEY = 'shoot-the-moon.save';

export interface Outcome {
	ok: boolean;
	tricks?: Trick[];
	step?: ReturnType<typeof R.stepAI>;
}

function find(hand: Card[], id: number): Card {
	const c = hand.find((x) => x.id === id);
	if (!c) throw new Error(`replay: card ${id} not in hand`);
	return c;
}

export function applyAction(run: Run, a: Action): Outcome {
	switch (a.t) {
		case 'pass': {
			const hand = run.hand.dealt[H.PLAYER];
			R.commitPass(run, a.cards.map((c) => find(hand, c)), { stepwise: true });
			return { ok: true };
		}
		case 'play':
			return { ok: true, tricks: R.playerPlay(run, find(run.hand.state!.hands[H.PLAYER], a.card), { stepwise: true }) };
		case 'ai':
			return { ok: true, step: R.stepAI(run) };
		case 'playOut':
			R.playOut(run);
			return { ok: true };
		case 'continue':
			R.continueAfterHand(run);
			return { ok: true };
		case 'shop':
			R.enterShop(run);
			return { ok: true };
		case 'buy':
			return { ok: R.buy(run, a.slot, a.card)[0] };
		case 'sellRelic':
			return { ok: R.sellRelic(run, a.slot) };
		case 'reroll':
			return { ok: R.reroll(run) };
		case 'leave':
			R.leaveShop(run);
			return { ok: true };
		case 'ploy':
			return { ok: R.usePloy(run, a.slot)[0] };
		case 'pick':
			return { ok: R.pickFromBundle(run, a.index)[0] };
		case 'skip':
			return { ok: R.skipBoard(run)[0] };
		case 'endless':
			return { ok: R.goEndless(run)[0] };
	}
}

export function replay(save: Save): Run {
	const run = R.newRun(save.seed, save.opts);
	for (const a of save.actions) applyAction(run, a);
	return run;
}

export function store(save: Save) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
	} catch {
		/* ignore */
	}
}

export function load(): Save | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const s = JSON.parse(raw) as Save;
		return s.version === SAVE_VERSION && Array.isArray(s.actions) ? s : null;
	} catch {
		return null;
	}
}

export function clear() {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		/* ignore */
	}
}
