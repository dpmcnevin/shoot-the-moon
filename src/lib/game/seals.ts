// Seals: lasting marks on particular cards.
//
// Every hand deals a fresh 52-card pack, so a seal belongs to a card (say,
// the seven of diamonds) rather than to a deck you keep. The sealed card
// turns up every hand -- sometimes in your hand, sometimes an opponent's --
// so each hand asks whether to keep it, pass it, or dump it on someone.

import * as cards from '../rules/cards.ts';
import * as H from '../rules/hearts.ts';
import type { Card, Hands } from '../rules/cards.ts';
import type { Trick } from '../rules/hearts.ts';

export type SealKey = 'gilded' | 'ward' | 'thorn' | 'crown' | 'homing';

export interface SealDef {
	key: SealKey;
	name: string;
	/** One letter for the wax badge. */
	glyph: string;
	color: string;
	cost: number;
	text: string;
}

export const SEALS: Record<SealKey, SealDef> = {
	gilded: {
		key: 'gilded', name: 'Gilded Seal', glyph: 'G', color: '#d9a441', cost: 4,
		text: 'Earn $2 each time you win a trick holding this card'
	},
	ward: {
		key: 'ward', name: 'Ward Seal', glyph: 'W', color: '#3a7bd5', cost: 6,
		text: 'This card carries no points (put it on a heart, or the queen)'
	},
	thorn: {
		key: 'thorn', name: 'Thorn Seal', glyph: 'T', color: '#23804e', cost: 5,
		text: 'Whoever takes this card takes 3 extra points. +12 chips when an opponent takes it'
	},
	crown: {
		key: 'crown', name: 'Crown Seal', glyph: 'C', color: '#7a4fc1', cost: 5,
		text: '+0.5 mult each time you win a trick with this card'
	},
	homing: {
		key: 'homing', name: 'Homing Seal', glyph: 'H', color: '#c8323c', cost: 4,
		text: 'This card is always dealt to you'
	}
};

export const SEAL_KEYS = Object.keys(SEALS) as SealKey[];

/** Seals on cards, by card code ("7D"). */
export type SealMap = Record<string, SealKey>;

export function sealOf(seals: SealMap, c: Card): SealKey | undefined {
	return seals[cards.code(c)];
}

/** Points a card carries, with Ward and Thorn applied. */
export function cardPoints(seals: SealMap, c: Card): number {
	const s = sealOf(seals, c);
	if (s === 'ward') return 0;
	return H.points(c) + (s === 'thorn' ? 3 : 0);
}

/** Points each seat took, with seals applied. */
export function pointsTaken(seals: SealMap, taken: Card[][]): number[] {
	return [0, 1, 2, 3, 4].map((s) => (s === 0 ? 0 : taken[s].reduce((n, c) => n + cardPoints(seals, c), 0)));
}

/** Points in a trick, with seals applied. */
export function trickPoints(seals: SealMap, t: Trick): number {
	return t.plays.reduce((n, p) => n + cardPoints(seals, p.card), 0);
}

/**
 * Homing: move each homing card into your hand right after the deal,
 * swapping it for your lowest card that isn't homing itself. Deterministic,
 * so replays stay exact.
 */
export function applyHoming(seals: SealMap, hands: Hands) {
	const mine = hands[H.PLAYER];
	for (let seat = 1; seat <= 4; seat++) {
		if (seat === H.PLAYER) continue;
		for (const c of hands[seat].slice()) {
			if (sealOf(seals, c) !== 'homing') continue;
			const give = mine
				.filter((m) => sealOf(seals, m) !== 'homing')
				.reduce<Card | undefined>((lo, m) => (!lo || m.rank < lo.rank || (m.rank === lo.rank && m.suit < lo.suit) ? m : lo), undefined);
			if (!give) continue;
			cards.removeCard(hands[seat], c);
			cards.removeCard(mine, give);
			hands[seat].push(give);
			mine.push(c);
		}
	}
	for (let seat = 1; seat <= 4; seat++) cards.sortHand(hands[seat]);
}
