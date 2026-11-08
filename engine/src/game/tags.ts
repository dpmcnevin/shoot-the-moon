// Tags: the reward for skipping a board (ruleset v5). Each table's first
// two boards come with a tag, shown in the table overview; skip the board
// (before its first pass) and you take the tag instead of the board's pay.

import type { RNG } from '../rules/rng.ts';

export type TagKey = 'bundle' | 'interest' | 'reroll' | 'ploy' | 'edition' | 'cash';

export interface TagDef {
	key: TagKey;
	name: string;
	text: string;
	icon: string;
}

export const TAGS: Record<TagKey, TagDef> = {
	bundle: { key: 'bundle', name: 'Free Bundle', text: 'The next club has a free Relic Bundle', icon: 'bundle_relic' },
	interest: { key: 'interest', name: 'Double Interest', text: 'Double interest at the next payout', icon: 'interest_rate' },
	reroll: { key: 'reroll', name: 'Free Rerolls', text: 'Rerolls are free in the next club', icon: 'redeal' },
	ploy: { key: 'ploy', name: 'Free Ploy', text: 'A ploy now (or $3 if your ploys are full)', icon: 'bundle_ploy' },
	edition: { key: 'edition', name: 'Edition', text: 'A random card in your pack gets an edition', icon: 'bundle_edition' },
	cash: { key: 'cash', name: 'Cash', text: 'Gain $8 now', icon: 'tip_jar' }
};
export const TAG_KEYS = Object.keys(TAGS) as TagKey[];

export function rollTag(rng: RNG): TagKey {
	return TAG_KEYS[rng.int(1, TAG_KEYS.length) - 1];
}
