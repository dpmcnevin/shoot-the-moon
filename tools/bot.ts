// A reasonable but unspectacular player, for balance simulation.
// Passes and plays with the same AI as the opponents and shops by a simple rule.

import * as run_ from '../src/lib/game/run.ts';
import * as ai from '../src/lib/rules/ai.ts';
import * as H from '../src/lib/rules/hearts.ts';
import type { Run } from '../src/lib/game/run.ts';
import type { RelicDef } from '../src/lib/game/relics.ts';

const value = (d: RelicDef) => d.rarity * 10 + d.cost;

export function shop(run: Run) {
	run_.enterShop(run);
	for (let k = 0; k < 6; k++) {
		let best = -1,
			bestScore = -1;
		run.shop!.items.forEach((item, i) => {
			if (item.sold || run.money < item.cost) return;
			if (item.kind === 'seal') {
				// The one obvious seal: ward the queen of spades.
				const score = item.def.key === 'ward' && run.seals.QS !== 'ward' ? 25 : -1;
				if (score > bestScore) {
					best = i;
					bestScore = score;
				}
				return;
			}
			if (item.kind === 'upgrade') {
				const score = item.def.key === 'dodge' ? 30 : item.def.key === 'clean' ? 14 : 6;
				if (score > bestScore) {
					best = i;
					bestScore = score;
				}
				return;
			}
			let score = value(item.def);
			if (run.relics.length >= run_.RELIC_SLOTS) {
				const weakest = Math.min(...run.relics.map((r) => value(r.def)));
				if (score <= weakest + 5) return;
			}
			if (score > bestScore) {
				best = i;
				bestScore = score;
			}
		});
		if (best < 0) break;
		if (run.shop!.items[best].kind === 'relic' && run.relics.length >= run_.RELIC_SLOTS) {
			let wi = 0;
			run.relics.forEach((r, i) => {
				if (value(r.def) < value(run.relics[wi].def)) wi = i;
			});
			run_.sellRelic(run, wi);
		}
		const it = run.shop!.items[best];
		if (!run_.buy(run, best, it.kind === 'seal' ? 'QS' : undefined)[0]) break;
	}
	if (run.money >= 20 && run_.reroll(run)) {
		run.shop!.items.forEach((_, i) => {
			if (run.shop!.items[i].kind === 'relic' && run_.canBuy(run, i)[0]) run_.buy(run, i);
		});
	}
	run_.leaveShop(run);
}

export function playRun(seed: string | number): Run {
	const run = run_.newRun(seed);
	for (let k = 0; k < 5000; k++) {
		if (run.phase === run_.PHASE.PASS) {
			run_.commitPass(run, ai.choosePass(run.hand.dealt[H.PLAYER], run.rng, run.aiSkill));
		} else if (run.phase === run_.PHASE.PLAY) {
			run_.playOut(run);
		} else if (run.phase === run_.PHASE.HAND_SCORED) {
			run_.continueAfterHand(run);
		} else if (run.phase === run_.PHASE.BOARD_WON) {
			shop(run);
		} else return run;
	}
	throw new Error('run did not terminate');
}
