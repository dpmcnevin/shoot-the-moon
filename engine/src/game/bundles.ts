// Bundles: a club item you open to pick one of three (ruleset v5). A Relic
// Bundle offers three relics, a Ploy Bundle three ploys, an Edition Bundle
// three cards of your pack, each with an edition to put on it.

import type { RNG } from '../rules/rng.ts';

export type BundleKey = 'relic' | 'ploy' | 'edition';

export interface BundleDef {
	key: BundleKey;
	name: string;
	text: string;
	cost: number;
	icon: string;
	weight: number;
}

export const BUNDLES: Record<BundleKey, BundleDef> = {
	relic: { key: 'relic', name: 'Relic Bundle', text: 'Open it and choose one of three relics', cost: 6, icon: 'bundle_relic', weight: 0.45 },
	ploy: { key: 'ploy', name: 'Ploy Bundle', text: 'Open it and choose one of three ploys', cost: 4, icon: 'bundle_ploy', weight: 0.3 },
	edition: { key: 'edition', name: 'Edition Bundle', text: 'Open it and choose one of three cards to get an edition', cost: 5, icon: 'bundle_edition', weight: 0.25 }
};
export const BUNDLE_KEYS = Object.keys(BUNDLES) as BundleKey[];

/** How many choices a bundle holds. */
export const BUNDLE_SIZE = 3;

export function rollBundle(rng: RNG): BundleDef {
	let roll = rng.next();
	for (const k of BUNDLE_KEYS) {
		roll -= BUNDLES[k].weight;
		if (roll < 0) return BUNDLES[k];
	}
	return BUNDLES.relic;
}
