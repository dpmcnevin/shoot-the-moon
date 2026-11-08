// The run's pack, and the club items that change it.
//
// The pack is shared: every change lands in all four hands, but only you
// know what's in it. Burn the queen of spades and nobody can be hit by her;
// copy her and the danger doubles; recolor hearts into clubs and the pack
// carries fewer points. Hands are the pack split four ways, with any
// leftover cards going to a kitty won with the first trick.

import * as cards from '../rules/cards.ts';
import type { Card } from '../rules/cards.ts';
import type { RNG } from '../rules/rng.ts';
import type { SealMap } from './seals.ts';

export const MIN_PACK = 36;
export const MAX_PACK = 64;

export type PackOpKey = 'burn' | 'recolor' | 'promote' | 'copy';

export interface PackOpDef {
	key: PackOpKey;
	name: string;
	text: string;
	cost: number;
	/** The suit a Recolor turns a card into. */
	suit?: number;
	icon: string;
}

const SUIT_PLURAL: Record<number, string> = { 1: 'club', 2: 'diamond', 3: 'heart', 4: 'spade' };

export const OPS: Record<Exclude<PackOpKey, 'recolor'>, PackOpDef> = {
	burn: { key: 'burn', name: 'Burn', text: 'Remove a card from the pack for good', cost: 4, icon: 'redeal' },
	promote: { key: 'promote', name: 'Promote', text: 'Raise a card one rank (a two becomes a three)', cost: 3, icon: 'promotion' },
	copy: { key: 'copy', name: 'Copy', text: 'Add a duplicate of a card to the pack', cost: 4, icon: 'vanderbilt' }
};

export function recolorDef(suit: number): PackOpDef {
	return {
		key: 'recolor',
		name: `Recolor: ${cards.SUITS[suit].name}`,
		text: `Turn a card into a ${SUIT_PLURAL[suit]} of the same rank`,
		cost: 3,
		suit,
		icon: 'transfer'
	};
}

/** A standard 52-card pack, with ids 1 to 52. */
export function standardPack(): Card[] {
	return cards.newDeck().map((c, i) => ({ ...c, id: i + 1 }));
}

/** A random pack item for the club. */
export function rollOp(rng: RNG): PackOpDef {
	const r = rng.next();
	if (r < 0.35) return recolorDef(rng.int(1, 4));
	if (r < 0.6) return OPS.burn;
	if (r < 0.8) return OPS.promote;
	return OPS.copy;
}

export interface PackHolder {
	pack: Card[];
	nextCardId: number;
	seals: SealMap;
	/** Editions on cards (ruleset v4), cleared with the card on Burn. */
	cardEditions?: Record<string, string>;
}

/** Can this pack item be used on that card? */
export function canApply(run: PackHolder, def: PackOpDef, card: Card | undefined): [boolean, string?] {
	if (!card) return [false, 'choose a card'];
	if (def.key === 'burn' && run.pack.length <= MIN_PACK) return [false, `the pack can't go below ${MIN_PACK} cards`];
	if (def.key === 'copy' && run.pack.length >= MAX_PACK) return [false, `the pack can't go above ${MAX_PACK} cards`];
	if (def.key === 'promote' && card.rank >= 14) return [false, 'an ace is already the top rank'];
	if (def.key === 'recolor' && card.suit === def.suit) return [false, 'that card is already that suit'];
	return [true];
}

/** Apply a pack item to the card with this id. */
export function apply(run: PackHolder, def: PackOpDef, id: number) {
	const i = run.pack.findIndex((c) => c.id === id);
	if (i < 0) throw new Error('pack: no such card');
	const card = run.pack[i];
	const [ok, why] = canApply(run, def, card);
	if (!ok) throw new Error('pack: ' + why);
	if (def.key === 'burn') {
		run.pack.splice(i, 1);
		delete run.seals[String(id)];
		if (run.cardEditions) delete run.cardEditions[String(id)];
	} else if (def.key === 'promote') {
		card.rank++;
	} else if (def.key === 'recolor') {
		card.suit = def.suit!;
	} else {
		run.pack.push({ suit: card.suit, rank: card.rank, id: run.nextCardId++ });
	}
	cards.sortHand(run.pack);
}

/** The pack, sorted for display: spades, hearts, diamonds, clubs, low to high. */
export function sortedPack(pack: Card[]): Card[] {
	return pack.slice().sort((a, b) => (a.suit !== b.suit ? b.suit - a.suit : a.rank !== b.rank ? a.rank - b.rank : (a.id ?? 0) - (b.id ?? 0)));
}
