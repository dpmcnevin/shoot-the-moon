// Bosses: each table's High Board comes with a named opponent and a house
// rule that bends Hearts for that board. The boss is chosen when the table
// starts, so the player sees it coming and can shop for it. Off unless the
// run turns them on (the iPad app does; the web game doesn't yet).
//
// Where each rule lives: card points (Widow, Diamond Jack) in run.beginPlay;
// hearts broken from the start (Open Book) there too; hands per board
// (Shortchanger) in run.startBoard; scoring (Moon Thief, Auditor, Taxman,
// Jinx) in run.scoreHand; the pass you receive (Pickpocket) in
// run.commitPass; opponent play (Shark, Cartel) through the AI context.
// Blindfold and Fog only change what the player is shown, so they live in
// the app's UI.

import type { RNG } from '../rules/rng.ts';

export type BossKey =
	| 'open_book'
	| 'moon_thief'
	| 'diamond_jack'
	| 'auditor'
	| 'taxman'
	| 'blindfold'
	| 'widow'
	| 'pickpocket'
	| 'fog'
	| 'jinx'
	| 'shortchanger'
	| 'shark'
	| 'cartel';

export interface BossDef {
	key: BossKey;
	name: string;
	/** The rule, as the player reads it. */
	text: string;
	/** 1 from the first table, 2 from table 3, 3 from table 6. */
	tier: 1 | 2 | 3;
	/** What changes under balance version 3 (ruleset v3). */
	v3?: { text?: string; tier?: 1 | 2 | 3 };
}

/** A boss as it stands under a balance version. */
export function bossAt(key: BossKey, balance = 1): BossDef {
	const d = BOSSES[key];
	return balance >= 3 && d.v3 ? { ...d, ...d.v3 } : d;
}

const defs: BossDef[] = [
	{ key: 'open_book', name: 'The Open Book', text: 'Hearts are broken from the first trick.', tier: 1, v3: { text: 'Hearts are broken from the first trick, and every heart counts 2 points.' } },
	{ key: 'moon_thief', name: 'The Moon Thief', text: "Shooting the moon doesn't count: taking every point is just taking every point.", tier: 1 },
	{ key: 'diamond_jack', name: 'The Diamond Jack', text: 'The jack of diamonds is worth 10 points.', tier: 1 },
	{ key: 'auditor', name: 'The Auditor', text: "No clean-hand bonus, and Clean Sheet doesn't pay.", tier: 1 },
	{ key: 'taxman', name: 'The Taxman', text: 'Each heart you take costs 5 chips.', tier: 1, v3: { text: 'Each heart you take costs 3 chips.', tier: 2 } },
	{ key: 'blindfold', name: 'The Blindfold', text: 'You choose your pass before you see your hand.', tier: 1 },
	{ key: 'widow', name: 'The Widow', text: 'The queen of spades counts double.', tier: 2 },
	{ key: 'pickpocket', name: 'The Pickpocket', text: 'The cards passed to you are always the most dangerous ones.', tier: 2 },
	{ key: 'fog', name: 'The Fog', text: 'Cards played after the lead stay face down until the trick is over.', tier: 2 },
	{ key: 'jinx', name: 'The Jinx', text: 'One of your relics, chosen at random, does nothing this board.', tier: 2 },
	{ key: 'shortchanger', name: 'The Shortchanger', text: 'You get 2 hands for this board instead of 3.', tier: 2, v3: { text: 'You get 2 hands for this board instead of 3, against a goal 20% lower.' } },
	{ key: 'shark', name: 'The Shark', text: 'North plays sharp and tries to dump points on you.', tier: 3 },
	{ key: 'cartel', name: 'The Cartel', text: 'All three opponents work together to push points onto you.', tier: 3 }
];

export const BOSSES = Object.fromEntries(defs.map((d) => [d.key, d])) as Record<BossKey, BossDef>;
export const BOSS_KEYS = defs.map((d) => d.key);

/** Extra money for beating a boss. */
export const BOSS_BONUS = 1;

/** The seat the Shark plays from. */
export const SHARK_SEAT = 1; // North

/** Choose a table's boss: harsher tiers on later tables, no repeats in a run while there are others left. */
export function pickBoss(rng: RNG, table: number, seen: BossKey[], balance = 1): BossKey {
	const maxTier = table >= 6 ? 3 : table >= 3 ? 2 : 1;
	const all = defs.map((d) => bossAt(d.key, balance));
	let pool = all.filter((d) => d.tier <= maxTier && !seen.includes(d.key));
	if (pool.length === 0) pool = all.filter((d) => d.tier <= maxTier);
	// Lean toward the newest tier unlocked, so later tables feel harder.
	const weighted = pool.flatMap((d) => (d.tier === maxTier ? [d, d] : [d]));
	return weighted[rng.int(1, weighted.length) - 1].key;
}
