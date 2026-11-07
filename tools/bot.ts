// A reasonable but unspectacular player, for balance simulation.
// Passes and plays with the same AI as the opponents and shops by a simple rule.

import * as run_ from '../src/lib/game/run.ts';
import * as ai from '../src/lib/rules/ai.ts';
import * as H from '../src/lib/rules/hearts.ts';
import type { Run } from '../src/lib/game/run.ts';
import type { RelicDef } from '../src/lib/game/relics.ts';
import * as packs from '../src/lib/game/pack.ts';
import type { PackOpDef } from '../src/lib/game/pack.ts';

const value = (d: RelicDef) => d.rarity * 10 + d.cost;

/** The card a simple player would use a pack item on, if any. */
function packTarget(run: Run, def: PackOpDef): number | undefined {
	if (def.key === 'burn') {
		const q = run.pack.find((c) => c.suit === 4 && c.rank === 12);
		return q && packs.canApply(run, def, q)[0] ? q.id : undefined;
	}
	if (def.key === 'recolor' && def.suit !== 3) {
		const h = run.pack.filter((c) => c.suit === 3).sort((a, b) => b.rank - a.rank)[0];
		return h ? h.id : undefined;
	}
	return undefined;
}

export function shop(run: Run) {
	run_.enterShop(run);
	for (let k = 0; k < 6; k++) {
		let best = -1,
			bestScore = -1;
		run.shop!.items.forEach((item, i) => {
			if (item.sold || run.money < item.cost) return;
			if (item.kind === 'pack') {
				// Burn the queen of spades, or recolor a heart into a safe suit.
				const target = packTarget(run, item.def);
				// Measured: flat pack fixes cost this bot more than they gain (relics
				// compound), so the balance baseline is a player who skips them.
				const score = target === undefined ? -1 : -1;
				if (score > bestScore) {
					best = i;
					bestScore = score;
				}
				return;
			}
			if (item.kind === 'seal') {
				// The one obvious seal: ward the queen of spades.
				const qs = run.pack.find((c) => c.suit === 4 && c.rank === 12);
				const score = item.def.key === 'ward' && qs && run.seals[String(qs.id)] !== 'ward' ? 25 : -1;
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
			let score = value(item.def) + (item.edition ? EDITION_VALUE[item.edition] : 0);
			const slotted = run.relics.filter((r) => r.edition !== 'phantom');
			if (item.edition !== 'phantom' && run_.relicSlotsUsed(run) >= run_.RELIC_SLOTS) {
				const weakest = Math.min(...slotted.map((r) => value(r.def)));
				if (score <= weakest + 5) return;
			}
			if (score > bestScore) {
				best = i;
				bestScore = score;
			}
		});
		if (best < 0) break;
		const pick = run.shop!.items[best];
		if (pick.kind === 'relic' && pick.edition !== 'phantom' && run_.relicSlotsUsed(run) >= run_.RELIC_SLOTS) {
			// Sell the weakest relic that takes a slot (never a Phantom).
			let wi = -1;
			run.relics.forEach((r, i) => {
				if (r.edition === 'phantom') return;
				if (wi < 0 || value(r.def) < value(run.relics[wi].def)) wi = i;
			});
			run_.sellRelic(run, wi);
		}
		const it = run.shop!.items[best];
		const card =
			it.kind === 'seal'
				? run.pack.find((c) => c.suit === 4 && c.rank === 12)?.id
				: it.kind === 'pack'
					? packTarget(run, it.def)
					: undefined;
		if (!run_.buy(run, best, card)[0]) break;
	}
	if (run.money >= 20 && run_.reroll(run)) {
		run.shop!.items.forEach((_, i) => {
			if (run.shop!.items[i].kind === 'relic' && run_.canBuy(run, i)[0]) run_.buy(run, i);
		});
	}
	run_.leaveShop(run);
}

/** What an edition adds to a relic, in the same rough units as `value`. */
const EDITION_VALUE: Record<string, number> = { etched: 6, lacquered: 10, prismatic: 16, phantom: 8 };

export function playRun(seed: string | number, opts: run_.RunOptions = {}): Run {
	const run = run_.newRun(seed, opts);
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
