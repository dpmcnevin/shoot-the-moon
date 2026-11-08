// Ploys: one-shot cards you hold (two at most) and use when you choose,
// mostly during a hand, which is where Hearts leaves you the fewest choices.
// From the club, singly or in a Ploy Bundle (ruleset v5).

import type { RNG } from '../rules/rng.ts';

export type PloyKey = 'spyglass' | 'umbrella' | 'fall_guy' | 'encore' | 'spotlight' | 'windfall';

/** When a ploy can be used: while passing, while playing, on the score panel, in the club. */
export type PloyWhen = 'pass' | 'play' | 'hand_scored' | 'shop';

export interface PloyDef {
	key: PloyKey;
	name: string;
	text: string;
	cost: number;
	icon: string;
	when: PloyWhen[];
	/** Relative chance in the club. */
	weight: number;
}

export const PLOYS: Record<PloyKey, PloyDef> = {
	spyglass: { key: 'spyglass', name: 'Spyglass', text: "See every opponent's cards for the rest of this trick", cost: 3, icon: 'ploy_spyglass', when: ['play'], weight: 0.2 },
	umbrella: { key: 'umbrella', name: 'Umbrella', text: 'If you take the queen of spades this hand, she counts 0 points for you', cost: 3, icon: 'ploy_umbrella', when: ['pass', 'play'], weight: 0.2 },
	fall_guy: { key: 'fall_guy', name: 'Fall Guy', text: 'The next trick you win goes to the player on your left, points and all (you still lead)', cost: 3, icon: 'ploy_fall_guy', when: ['play'], weight: 0.2 },
	encore: { key: 'encore', name: 'Encore', text: '+1 hand on this board, even after the last one', cost: 5, icon: 'ploy_encore', when: ['pass', 'play', 'hand_scored'], weight: 0.12 },
	spotlight: { key: 'spotlight', name: 'Spotlight', text: 'Your next hand scores x2 mult', cost: 4, icon: 'ploy_spotlight', when: ['pass', 'play'], weight: 0.16 },
	windfall: { key: 'windfall', name: 'Windfall', text: 'Gain $5', cost: 2, icon: 'ploy_windfall', when: ['pass', 'play', 'hand_scored', 'shop'], weight: 0.12 }
};
export const PLOY_KEYS = Object.keys(PLOYS) as PloyKey[];

/** Ploys you can hold at once. */
export const PLOY_SLOTS = 2;

export function rollPloy(rng: RNG): PloyDef {
	let roll = rng.next();
	for (const k of PLOY_KEYS) {
		roll -= PLOYS[k].weight;
		if (roll < 0) return PLOYS[k];
	}
	return PLOYS.windfall;
}
