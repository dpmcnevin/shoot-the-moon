// Card editions: Etched, Lacquered and Prismatic, as on relics, but on a
// card in your pack. Like a seal, an edition belongs to one card (say, the
// seven of diamonds) for the rest of the run, and that card turns up in a
// different hand each deal. It pays when you play it, so it only counts in
// the hands where you're dealt it (or passed it) and keep it.
// Under ruleset v4 the club offers them; off before that.

import type { Card } from '../rules/cards.ts';
import type { RNG } from '../rules/rng.ts';
import { sealKey } from './seals.ts';

export type CardEditionKey = 'etched' | 'lacquered' | 'prismatic';

export interface CardEditionDef {
	key: CardEditionKey;
	name: string;
	text: string;
	cost: number;
	/** What playing the card adds to the hand. */
	effect: { chips?: number; mult?: number; xmult?: number };
	/** Relative chance among editions in the club. */
	weight: number;
}

export const CARD_EDITIONS: Record<CardEditionKey, CardEditionDef> = {
	etched: { key: 'etched', name: 'Etched', text: '+15 chips when you play this card', cost: 3, effect: { chips: 15 }, weight: 0.45 },
	lacquered: { key: 'lacquered', name: 'Lacquered', text: '+1 mult when you play this card', cost: 4, effect: { mult: 1 }, weight: 0.35 },
	prismatic: { key: 'prismatic', name: 'Prismatic', text: 'x1.5 mult when you play this card', cost: 6, effect: { xmult: 1.5 }, weight: 0.2 }
};
export const CARD_EDITION_KEYS = Object.keys(CARD_EDITIONS) as CardEditionKey[];

/** Editions on cards, by pack card id. */
export type CardEditionMap = Record<string, CardEditionKey>;

export function editionOf(map: CardEditionMap | undefined, c: Card): CardEditionKey | undefined {
	return map?.[sealKey(c)];
}

/** A card edition for a club offer, weighted. */
export function rollCardEdition(rng: RNG): CardEditionDef {
	let roll = rng.next();
	for (const k of CARD_EDITION_KEYS) {
		roll -= CARD_EDITIONS[k].weight;
		if (roll < 0) return CARD_EDITIONS[k];
	}
	return CARD_EDITIONS.etched;
}
