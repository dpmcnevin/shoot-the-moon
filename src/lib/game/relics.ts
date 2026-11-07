// Relics: the items that turn a hand of Hearts into a big number.
//
// Each hand scores chips x mult. Base chips come from the points you dodge
// (26 minus what you took) or the jackpot for shooting the moon. Relics add
// chips, add mult, or multiply it, and some grow over the run. Several pull
// against the core instinct of dodging -- Bleeding Heart and Collector pay
// you for taking hearts -- so a build can go hunting instead of hiding.
//
// Icons reuse Vulnerable's pixel art for now (`icon`).

import * as cards from '../rules/cards.ts';
import * as H from '../rules/hearts.ts';
import type { Card } from '../rules/cards.ts';
import type { PassDir, Trick } from '../rules/hearts.ts';
import type { RNG } from '../rules/rng.ts';

export const RARITY_NAME = ['', 'Common', 'Uncommon', 'Rare', 'Legendary'];

export interface ScoreCtx {
	/** Points you took this hand. */
	myPoints: number;
	/** Hearts you took. */
	heartsTaken: number;
	tookQueen: boolean;
	/** Seat that shot the moon (after relic rules), or null. */
	shooter: number | null;
	/** Tricks you won. */
	myTricks: Trick[];
	/** Tricks you led. */
	tricksLed: number;
	/** Every trick of the hand. */
	tricks: Trick[];
	passDir: PassDir;
	passed: Card[];
	received: Card[];
	/** You held the queen of spades after passing. */
	heldQueen: boolean;
	/** You played the queen of spades into a trick someone else won. */
	dumpedQueen: boolean;
	/** Suits you were void in once the passing was done. */
	voidsAfterPass: number;
	/** You took the jack of diamonds. */
	tookJackOfDiamonds: boolean;
	/** Boards won so far this table, moons shot this run. */
	boardsWonThisTable: number;
	moonsThisRun: number;
}

export interface Effect {
	chips?: number;
	mult?: number;
	xmult?: number;
}

export interface RelicState {
	mult?: number;
	x?: number;
	streak?: number;
}

export interface Relic {
	key: string;
	def: RelicDef;
	name: string;
	cost: number;
	state: RelicState;
	edition?: EditionKey;
}

// ------------------------------------------------------------------ editions
//
// A relic in the club sometimes comes with an edition: a bonus on top of
// what the relic does, every hand, for a higher price. Off unless the run
// turns them on (the iPad app does; the web game doesn't yet).

export type EditionKey = 'etched' | 'lacquered' | 'prismatic' | 'phantom';

export interface EditionDef {
	key: EditionKey;
	name: string;
	text: string;
	/** Added to the relic's price. */
	cost: number;
	/** The bonus every hand, or null (Phantom's gift is the slot). */
	effect: Effect | null;
	/** Relative chance among editions. */
	weight: number;
}

export const EDITIONS: Record<EditionKey, EditionDef> = {
	etched: { key: 'etched', name: 'Etched', text: '+10 chips every hand', cost: 3, effect: { chips: 10 }, weight: 0.4 },
	lacquered: { key: 'lacquered', name: 'Lacquered', text: '+0.5 mult every hand', cost: 4, effect: { mult: 0.5 }, weight: 0.3 },
	prismatic: { key: 'prismatic', name: 'Prismatic', text: 'x1.25 mult every hand', cost: 6, effect: { xmult: 1.25 }, weight: 0.2 },
	phantom: { key: 'phantom', name: 'Phantom', text: 'Takes no relic slot', cost: 5, effect: null, weight: 0.1 }
};
export const EDITION_KEYS = Object.keys(EDITIONS) as EditionKey[];

/** Chance a relic offered in the club has an edition. */
export const EDITION_CHANCE = 0.08;

export function rollEdition(rng: RNG): EditionKey | undefined {
	if (rng.next() >= EDITION_CHANCE) return undefined;
	let roll = rng.next();
	for (const k of EDITION_KEYS) {
		roll -= EDITIONS[k].weight;
		if (roll < 0) return k;
	}
	return 'etched';
}

export interface RelicDef {
	key: string;
	name: string;
	rarity: number;
	cost: number;
	icon: string;
	text: string;
	score?: (ctx: ScoreCtx, relic: Relic) => Effect | null;
	/** Called after each hand is scored; scaling relics grow here. */
	onHandEnd?: (ctx: ScoreCtx, relic: Relic) => void;
	onBoardWin?: (relic: Relic) => { money?: number } | void;
	describe?: (relic: Relic) => string;
	/** Rule-changing relics. */
	halfMoon?: boolean;
	moonX?: number;
	baseX?: number;
}

const dodging = (ctx: ScoreCtx) => ctx.shooter === null;

export const DEFS: RelicDef[] = [
	// ---------------------------------------------------------------- common
	{
		key: 'clean_hands', name: 'Clean Hands', rarity: 1, cost: 4, icon: 'safety_play',
		text: '+15 chips if you take no points',
		score: (ctx) => (ctx.myPoints === 0 && dodging(ctx) ? { chips: 15 } : null)
	},
	{
		key: 'spade_shield', name: 'Spade Shield', rarity: 1, cost: 5, icon: 'insurance',
		text: '+25 chips if you hold the queen of spades after passing and still avoid taking her',
		score: (ctx) => (ctx.heldQueen && !ctx.tookQueen ? { chips: 25 } : null)
	},
	{
		key: 'low_road', name: 'Low Road', rarity: 1, cost: 4, icon: 'shape_shifter',
		text: '+4 chips for each trick you win with a seven or lower',
		score: (ctx) => ({ chips: 4 * ctx.myTricks.filter((t) => t.winningCard.rank <= 7).length })
	},
	{
		key: 'trickster', name: 'Trickster', rarity: 1, cost: 5, icon: 'psych',
		text: '+4 chips for each trick you win that holds no points',
		score: (ctx) => ({ chips: 4 * ctx.myTricks.filter((t) => t.points === 0).length })
	},
	{
		key: 'passing_fancy', name: 'Passing Fancy', rarity: 1, cost: 4, icon: 'transfer',
		text: '+5 chips for each ten or higher you pass',
		score: (ctx) => ({ chips: 5 * ctx.passed.filter((c) => c.rank >= 10).length })
	},
	{
		key: 'diamond_jack', name: 'Diamond Jack', rarity: 1, cost: 5, icon: 'the_finesse',
		text: 'Taking the jack of diamonds is worth +20 chips (a classic house rule)',
		score: (ctx) => (ctx.tookJackOfDiamonds ? { chips: 20 } : null)
	},
	{
		key: 'leader', name: 'Leader', rarity: 1, cost: 4, icon: 'lead_out_of_turn',
		text: '+3 chips for each trick you lead',
		score: (ctx) => ({ chips: 3 * ctx.tricksLed })
	},
	{
		key: 'last_word', name: 'Last Word', rarity: 1, cost: 5, icon: 'endplay',
		text: '+20 chips if you win the last trick',
		score: (ctx) => {
			const last = ctx.tricks[ctx.tricks.length - 1];
			return last && last.winner === H.PLAYER ? { chips: 20 } : null;
		}
	},
	{
		key: 'steady_hand', name: 'Steady Hand', rarity: 1, cost: 5, icon: 'master_points',
		text: 'Gains +0.25 mult each hand you take no points',
		describe: (r) => `Gains +0.25 mult each hand you take no points (now +${(r.state.mult ?? 0).toFixed(2)})`,
		onHandEnd: (ctx, r) => {
			if (ctx.myPoints === 0 && dodging(ctx)) r.state.mult = (r.state.mult ?? 0) + 0.25;
		},
		score: (_ctx, r) => ((r.state.mult ?? 0) > 0 ? { mult: r.state.mult } : null)
	},

	// -------------------------------------------------------------- uncommon
	{
		key: 'bleeding_heart', name: 'Bleeding Heart', rarity: 2, cost: 6, icon: 'partners_trust',
		text: '+0.4 mult for each heart you take',
		score: (ctx) => (ctx.heartsTaken > 0 ? { mult: 0.4 * ctx.heartsTaken } : null)
	},
	{
		key: 'black_widow', name: 'Black Widow', rarity: 2, cost: 7, icon: 'the_void',
		text: 'x2 if you drop the queen of spades on someone else',
		score: (ctx) => (ctx.dumpedQueen ? { xmult: 2 } : null)
	},
	{
		key: 'void_walker', name: 'Void Walker', rarity: 2, cost: 6, icon: 'ruffing_void',
		text: 'x1.5 for each suit you are void in after passing',
		score: (ctx) => (ctx.voidsAfterPass > 0 ? { xmult: 1.5 ** ctx.voidsAfterPass } : null)
	},
	{
		key: 'hold_em', name: "Hold 'Em", rarity: 2, cost: 6, icon: 'strong_partner',
		text: 'x2 on hands with no passing',
		score: (ctx) => (ctx.passDir === 'hold' ? { xmult: 2 } : null)
	},
	{
		key: 'sweeper', name: 'Sweeper', rarity: 2, cost: 6, icon: 'clean_sweep',
		text: '+0.2 mult for each trick you win',
		score: (ctx) => (ctx.myTricks.length > 0 ? { mult: 0.2 * ctx.myTricks.length } : null)
	},
	{
		key: 'pickpocket', name: 'Pickpocket', rarity: 2, cost: 6, icon: 'coup',
		text: '+6 chips for each queen, king or ace you receive in the pass',
		score: (ctx) => ({ chips: 6 * ctx.received.filter((c) => c.rank >= 12).length })
	},
	{
		key: 'rainmaker', name: 'Rainmaker', rarity: 2, cost: 6, icon: 'rubber_baron',
		text: 'Earn $4 extra each time you win a board',
		onBoardWin: () => ({ money: 4 })
	},

	// ------------------------------------------------------------------ rare
	{
		key: 'moonstruck', name: 'Moonstruck', rarity: 3, cost: 8, icon: 'phantom_trick',
		text: 'Shooting the moon pays double',
		moonX: 2
	},
	{
		key: 'half_moon', name: 'Half Moon', rarity: 3, cost: 9, icon: 'vulnerable',
		text: 'Taking every heart counts as shooting the moon, even without the queen',
		halfMoon: true
	},
	{
		key: 'collector', name: 'Collector', rarity: 3, cost: 9, icon: 'ace_collector',
		text: 'x1.1 for each point you take',
		score: (ctx) => (ctx.myPoints > 0 && dodging(ctx) ? { xmult: 1.1 ** ctx.myPoints } : null)
	},
	{
		key: 'queens_favor', name: "Queen's Favor", rarity: 3, cost: 8, icon: 'grand_design',
		text: 'Taking the queen of spades is worth +40 chips instead of costing you',
		score: (ctx) => (ctx.tookQueen && dodging(ctx) ? { chips: 40 + 13 } : null)
	},
	{
		key: 'night_owl', name: 'Night Owl', rarity: 3, cost: 9, icon: 'slam_hunter',
		text: 'Gains x0.5 every time you shoot the moon',
		describe: (r) => `Gains x0.5 every time you shoot the moon (now x${(1 + (r.state.x ?? 0)).toFixed(1)})`,
		onHandEnd: (ctx, r) => {
			if (ctx.shooter === H.PLAYER) r.state.x = (r.state.x ?? 0) + 0.5;
		},
		score: (_ctx, r) => ((r.state.x ?? 0) > 0 ? { xmult: 1 + r.state.x! } : null)
	},

	// ------------------------------------------------------------- legendary
	{
		key: 'house_rules', name: 'House Rules', rarity: 4, cost: 12, icon: 'milton_work',
		text: 'Base chips are doubled',
		baseX: 2
	},
	{
		key: 'full_moon', name: 'Full Moon', rarity: 4, cost: 13, icon: 'life_master',
		text: 'x1.5, and x1.5 again for every board already won at this table',
		score: (ctx) => ({ xmult: 1.5 ** (1 + ctx.boardsWonThisTable) })
	}
];

export const BY_KEY: Record<string, RelicDef> = {};
for (const d of DEFS) BY_KEY[d.key] = d;

export function get(key: string): RelicDef | undefined {
	return BY_KEY[key];
}

export function instantiate(def: RelicDef, edition?: EditionKey): Relic {
	const cost = def.cost + (edition ? EDITIONS[edition].cost : 0);
	return { key: def.key, def, name: def.name, cost, state: {}, ...(edition ? { edition } : {}) };
}

export function textFor(relic: Relic): string {
	return relic.def.describe ? relic.def.describe(relic) : relic.def.text;
}

/** Weighted rarity roll, never offering a relic you already own. */
export function randomUnowned(rng: RNG, owned: { key: string }[]): RelicDef | undefined {
	const weights = [0.6, 0.3, 0.085, 0.015];
	const have = new Set(owned.map((o) => o.key));
	for (let attempt = 0; attempt < 40; attempt++) {
		const roll = rng.next();
		let acc = 0,
			rarity = 1;
		for (let r = 1; r <= 4; r++) {
			acc += weights[r - 1];
			if (roll <= acc) {
				rarity = r;
				break;
			}
		}
		const pool = DEFS.filter((d) => d.rarity === rarity && !have.has(d.key));
		const pick = rng.pick(pool);
		if (pick) return pick;
	}
	return DEFS.find((d) => !have.has(d.key));
}

void cards;
