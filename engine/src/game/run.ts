// Run engine: tables, boards, hands, scoring and the club.
//
//   8 tables, 3 boards each. A board sets a target; you have three hands of
//   Hearts to reach it. Each hand scores chips x mult: base chips for the
//   points you dodge (or a jackpot for shooting the moon), then relics.
//   Win boards to earn money, spend it at the club, get through all 8 tables.
//
// Pure logic, deterministic from the seed, shared by the UI, the tests and
// the balance simulator. Mirrors Vulnerable's engine API where it can.

import * as cards from '../rules/cards.ts';
import * as H from '../rules/hearts.ts';
import * as ai from '../rules/ai.ts';
import * as rngLib from '../rules/rng.ts';
import * as relics from './relics.ts';
import * as seals from './seals.ts';
import * as cardEds from './cardEditions.ts';
import * as ploys from './ploys.ts';
import type { PloyDef, PloyKey } from './ploys.ts';
import * as bundles from './bundles.ts';
import * as tags from './tags.ts';
import type { DeckKey } from './decks.ts';
import type { TagKey } from './tags.ts';
import type { BundleDef, BundleKey } from './bundles.ts';
import type { CardEditionDef, CardEditionMap } from './cardEditions.ts';
import * as packs from './pack.ts';
import * as bosses from './bosses.ts';
import type { BossKey } from './bosses.ts';
import type { PackOpDef } from './pack.ts';
import type { SealDef, SealMap } from './seals.ts';
import type { Card, Hands } from '../rules/cards.ts';
import type { HandState, PassDir, Trick } from '../rules/hearts.ts';
import type { RNG } from '../rules/rng.ts';
import type { EditionKey, Relic, RelicDef, ScoreCtx } from './relics.ts';

export const TABLES = 8;
export const BOARDS_PER_TABLE = 3;
export const HANDS_PER_BOARD = 3;
export const RELIC_SLOTS = 5;
export const SHOP_SIZE = 4;
export const BASE_REROLL_COST = 5;
export const STARTING_MONEY = 6;
export const INTEREST_PER = 5;
export const MAX_INTEREST = 5;
export const MONEY_PER_BOARD = 4;
export const MONEY_PER_UNUSED_HAND = 1;

/** Chips for shooting the moon with a standard pack: three times a perfect dodge. */
export const MOON_CHIPS = 78;
/** Bonus chips for a hand where you take no points at all. */
export const CLEAN_BONUS = 10;
/** Chips the Pickpocket (v3) fines you per passed card you take back. */
export const PICKPOCKET_FINE = 16;

// Target for the first board of each table, fitted with tools/simulate.
export const TABLE_BASE = [34, 67, 120, 208, 360, 610, 1005, 1650];
/** Gentler targets (the iPad app's): a first board that bad luck alone
 *  rarely loses, and late tables about 20% lower. Measured with the bot on
 *  the iPad's full rules (bosses, expansion relics, moon AI, AI curve;
 *  2 x 3000 runs): about 28% wins. TABLE_BASE gives about 14% on the
 *  plain rules. */
export const GENTLE_TABLE_BASE = [22, 52, 106, 184, 308, 500, 820, 1320];
/** Ruleset v3's targets: about 10% above v2's, because v3 pays for beating
 *  a goal by a margin. Bot on v3, 2 x 3000 runs: about 28% wins. */
export const V3_TABLE_BASE = [24, 57, 117, 203, 340, 550, 905, 1455];
// Board 1, board 2, and the high board.
export const BOARD_SCALE = [1.0, 1.3, 1.65];

export const PHASE = {
	PASS: 'pass',
	PLAY: 'play',
	HAND_SCORED: 'hand_scored',
	BOARD_WON: 'board_won',
	SHOP: 'shop',
	GAME_OVER: 'game_over',
	VICTORY: 'victory'
} as const;
export type Phase = (typeof PHASE)[keyof typeof PHASE];

export interface Line {
	label: string;
	/** Money earned (Gilded seals), paid when the hand is banked. */
	money?: number;
	chips?: number;
	mult?: number;
	xmult?: number;
	/** Set on a relic edition's line, for its own sound and color. */
	edition?: EditionKey;
}

export interface Breakdown {
	lines: Line[];
	chips: number;
	mult: number;
	total: number;
	myPoints: number;
	shooter: number | null;
	points: number[];
	money: number;
}

export interface Hand {
	dealt: Hands;
	passDir: PassDir;
	passed: Card[];
	received: Card[];
	state: HandState | null;
	result: Breakdown | null;
	/** Card objects that came to you in the pass, for the UI. */
	receivedFrom: Map<Card, number>;
	/** Leftover cards when the pack doesn't split evenly; won with the first trick. */
	kitty: Card[];
	/** Ploys in play this hand: Spyglass (the trick it shows), Umbrella, Fall Guy (from which trick). */
	spyTrick?: number;
	umbrella?: boolean;
	fallGuyFrom?: number;
}

export interface Stats {
	handsPlayed: number;
	/** Boards skipped for tags. */
	boardsSkipped?: number;
	moons: number;
	cleanHands: number;
	bestHand: number;
	totalScore: number;
	pointsTaken: number;
}

export interface LogEntry {
	table: number;
	board: number;
	points: number;
	score: number;
	moon: boolean;
}

/**
 * Upgrades: permanent levels for the three kinds of hand, like Vulnerable's
 * conventions. Each level past the first adds chips and mult whenever that
 * kind of hand is scored.
 */
export type UpgradeKey = 'dodge' | 'clean' | 'moon';
export interface UpgradeDef {
	key: UpgradeKey;
	name: string;
	text: string;
	icon: string;
	chips: number;
	mult: number;
}
export const UPGRADES: Record<UpgradeKey, UpgradeDef> = {
	dodge: { key: 'dodge', name: 'The Dodge', text: 'Level up every hand you don\'t shoot the moon', icon: 'psych', chips: 6, mult: 0.4 },
	clean: { key: 'clean', name: 'Clean Sheet', text: 'Level up hands where you take no points', icon: 'safety_play', chips: 12, mult: 0.6 },
	moon: { key: 'moon', name: 'Moonshot', text: 'Level up shooting the moon', icon: 'phantom_trick', chips: 40, mult: 1 }
};

/** An upgrade's text under a balance version: from balance 4 (ruleset v4)
 *  a moon scores the Dodge and Clean Sheet levels too. */
export function upgradeText(key: UpgradeKey, balance = 1): string {
	if (balance >= 4 && key === 'dodge') return 'Level up every hand, the moon included';
	if (balance >= 4 && key === 'clean') return 'Level up hands where you take no points, and the moon';
	return UPGRADES[key].text;
}

/** Balance 4: the moon's extra mult. */
export const MOON_X = 2;

export function upgradeBonus(key: UpgradeKey, level: number): [number, number] {
	const extra = Math.max(0, level - 1);
	return [extra * UPGRADES[key].chips, extra * UPGRADES[key].mult];
}

export type ShopItem =
	| { kind: 'relic'; def: RelicDef; name: string; cost: number; sold?: boolean; edition?: EditionKey }
	| { kind: 'upgrade'; def: UpgradeDef; name: string; cost: number; sold?: boolean }
	| { kind: 'seal'; def: SealDef; name: string; cost: number; sold?: boolean }
	| { kind: 'pack'; def: PackOpDef; name: string; cost: number; sold?: boolean }
	| { kind: 'edition'; def: CardEditionDef; name: string; cost: number; sold?: boolean }
	| { kind: 'ploy'; def: PloyDef; name: string; cost: number; sold?: boolean }
	| { kind: 'bundle'; def: BundleDef; name: string; cost: number; sold?: boolean };

/** One of a bundle's three choices. */
export type BundleChoice =
	| { kind: 'relic'; def: RelicDef; edition?: EditionKey }
	| { kind: 'ploy'; def: PloyDef }
	| { kind: 'edition'; cardId: number; edition: cardEds.CardEditionKey };

export interface Payout {
	board: number;
	unused: number;
	interest: number;
	relics: number;
	/** Bonus for beating a boss (bosses on only). */
	boss?: number;
	/** Bonus for beating the goal by a margin (balance 3). */
	overshoot?: number;
	total: number;
}

/** Balance 3 pays for beating the goal by a margin: $1 per full 50% over,
 *  up to $3. */
export function overshootBonus(score: number, target: number): number {
	if (target <= 0) return 0;
	return Math.min(3, Math.max(0, Math.floor((score / target - 1) / 0.5)));
}

export interface Run {
	seed: string | number;
	rng: RNG;
	table: number;
	board: number;
	boardsWonThisTable: number;
	handCount: number;
	money: number;
	relics: Relic[];
	levels: Record<UpgradeKey, number>;
	/** Seals on cards, by pack card id. */
	seals: SealMap;
	/** Editions on cards, by pack card id (ruleset v4). */
	cardEditions: CardEditionMap;
	/** The club offers card editions (off by default). */
	packEditions: boolean;
	/** The club offers the v4 relics too (off by default). */
	v4Relics: boolean;
	/** Ploys and bundles in the club (ruleset v5). */
	ploysOn: boolean;
	/** The ploys you hold (at most ploys.PLOY_SLOTS). */
	ploys: PloyKey[];
	/** Spotlight: your next hand scores x2 mult. */
	spotlight: boolean;
	/** A bundle being opened in the club: its choices. */
	opening: { bundle: BundleKey; options: BundleChoice[] } | null;
	/** Skipping boards for tags (ruleset v5). */
	tagsOn: boolean;
	/** This table's tags, for boards 1 and 2 (index 0 and 1). */
	tagOffers: TagKey[];
	/** Tags taken whose reward is still to come (a club, a payout). */
	pendingTags: TagKey[];
	/** Free Rerolls tag: rerolls cost nothing in this club. */
	freeRerolls?: boolean;
	/** Boards of this table that were skipped. */
	skipped?: number[];
	/** The starting deck. */
	deck: DeckKey;
	/** The run's pack: every hand is dealt from it. */
	pack: Card[];
	nextCardId: number;
	score: number;
	target: number;
	handsLeft: number;
	phase: Phase;
	hand: Hand;
	shop: { items: ShopItem[] } | null;
	rerollCost: number;
	aiSkill: number;
	log: LogEntry[];
	stats: Stats;
	lastPayout?: Payout;
	/** Running points per seat across the board, for the table display. */
	boardPoints: number[];
	/** Relics in the club can come with editions (off by default). */
	editions: boolean;
	/** A club never offers the same item twice at once (off by default, so
	 *  older saves replay against the same offers). */
	noRepeats: boolean;
	/** Each table's base target, if not the standard TABLE_BASE. */
	tableBase?: number[];
	/** Each table's High Board has a boss (off by default). */
	bosses: boolean;
	/** This table's boss, chosen when the table starts. */
	boss: BossKey | null;
	bossesSeen: BossKey[];
	/** The relic the Jinx has switched off this board. */
	jinxed: string | null;
	/** Hands this board started with (the Shortchanger takes one). */
	handsThisBoard: number;
	/** The club offers the expansion relics too (off by default). */
	moreRelics: boolean;
	moonAI: boolean;
	aiCurve: boolean;
	/** The ruleset the run was started with (or 'classic'). */
	ruleset: RulesetName;
	balance: number;
}

export interface RunOptions {
	/** A named set of rules (RULESETS); options given beside it override it. */
	ruleset?: RulesetName;
	money?: number;
	aiSkill?: number;
	editions?: boolean;
	/** The club offers editions for cards in your pack (off by default). */
	packEditions?: boolean;
	/** The club offers the relics added with ruleset v4 (off by default). */
	v4Relics?: boolean;
	/** Ploys and bundles in the club (off by default). */
	ploys?: boolean;
	/** Boards can be skipped for tags (off by default). */
	tags?: boolean;
	/** The starting deck (decks.ts; 'standard' by default). */
	deck?: DeckKey;
	noRepeats?: boolean;
	tableBase?: number[];
	bosses?: boolean;
	moreRelics?: boolean;
	/** Opponents sometimes go for the moon (off by default). */
	moonAI?: boolean;
	/** Opponents' mistakes look like a person's, and they sharpen table by
	 *  table (off by default). */
	aiCurve?: boolean;
	/** Balance version: 1 (default) or 3 (ruleset v3's relic, boss and
	 *  economy numbers). */
	balance?: number;
}

/** Opponent skill at a table, with aiCurve: looser early, sharper late. */
export function tableSkill(run: Run): number {
	if (!run.aiCurve) return run.aiSkill;
	return Math.min(0.97, 0.8 + 0.025 * (Math.min(run.table, TABLES) - 1));
}

/** Does an active relic have this rule? */
function hasRule(run: Run, rule: keyof RelicDef): boolean {
	return activeRelics(run).some((r) => !!r.def[rule]);
}

/** Relic slots: the Collector's Album adds one. */
export function relicSlots(run: Run): number {
	return RELIC_SLOTS + (run.relics.some((r) => r.def.extraSlot) ? 1 : 0);
}

/**
 * Named rulesets, so the web game and the iPad app can share rules by
 * name instead of a list of flags that drift apart. `classic` is the
 * original game (the web game today); `v2` adds editions, bosses, the
 * expansion relics, moon AI, the AI curve, gentler targets and no repeat
 * offers (the iPad app). A save records its ruleset, so changing what a
 * future ruleset means never changes a run in progress: add `v3` instead.
 */
export type RulesetName = 'classic' | 'v2' | 'v3' | 'v4' | 'v5';
export const RULESETS: Record<RulesetName, Omit<RunOptions, 'ruleset' | 'money' | 'aiSkill'>> = {
	classic: {},
	v2: {
		editions: true,
		noRepeats: true,
		tableBase: GENTLE_TABLE_BASE,
		bosses: true,
		moreRelics: true,
		moonAI: true,
		aiCurve: true
	},
	v3: {
		editions: true,
		noRepeats: true,
		tableBase: V3_TABLE_BASE,
		bosses: true,
		moreRelics: true,
		moonAI: true,
		aiCurve: true,
		balance: 3
	},
	/** v3 plus editions for the cards in your pack (offered in place of some
	 *  upgrades) and the clean-top-card relics. */
	v4: {
		editions: true,
		packEditions: true,
		v4Relics: true,
		noRepeats: true,
		tableBase: V3_TABLE_BASE,
		bosses: true,
		moreRelics: true,
		moonAI: true,
		aiCurve: true,
		balance: 4
	},
	/** v4 plus ploys and bundles in the club (and more to come). */
	v5: {
		editions: true,
		packEditions: true,
		v4Relics: true,
		ploys: true,
		tags: true,
		noRepeats: true,
		tableBase: V3_TABLE_BASE,
		bosses: true,
		moreRelics: true,
		moonAI: true,
		aiCurve: true,
		balance: 4
	}
};

/** The options a ruleset name stands for, with any explicit options on top. */
export function resolveOptions(opts: RunOptions = {}): RunOptions {
	const base = opts.ruleset ? RULESETS[opts.ruleset] : {};
	if (opts.ruleset && !base) throw new Error(`unknown ruleset ${opts.ruleset}`);
	return { ...base, ...opts };
}

/** Is this board the boss's? */
export function bossActive(run: Run): boolean {
	return run.bosses && run.boss !== null && run.board === BOARDS_PER_TABLE;
}

function bossIs(run: Run, key: BossKey): boolean {
	return bossActive(run) && run.boss === key;
}

/** Relics that count right now (the Jinx switches one off). */
export function activeRelics(run: Run): Relic[] {
	return run.jinxed && bossIs(run, 'jinx') ? run.relics.filter((r) => r.key !== run.jinxed) : run.relics;
}

/** Relic slots in use: Phantom relics take none. */
export function relicSlotsUsed(run: Run): number {
	return run.relics.filter((r) => r.edition !== 'phantom' && !r.def.extraSlot).length;
}

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

function round5(n: number): number {
	if (n < 100) return Math.floor(n / 5 + 0.5) * 5;
	const mag = 10 ** Math.max(1, Math.floor(Math.log10(n)) - 1);
	return Math.floor(n / mag + 0.5) * mag;
}

export function targetFor(table: number, board: number, tableBase: number[] = TABLE_BASE): number {
	let base = tableBase[Math.min(table, tableBase.length) - 1];
	if (table > tableBase.length) base *= 1.6 ** (table - tableBase.length);
	return round5(base * BOARD_SCALE[board - 1]);
}

export function boardName(run: Run): string {
	return run.board === BOARDS_PER_TABLE ? 'High Board' : `Board ${run.board}`;
}

// ------------------------------------------------------------------ run

export function newRun(seed?: string | number, options: RunOptions = {}): Run {
	const opts = resolveOptions(options);
	seed = seed ?? rngLib.randomSeedString(rngLib.newRng());
	const run = {
		seed,
		rng: rngLib.newRng(seed),
		table: 1,
		board: 1,
		boardsWonThisTable: 0,
		handCount: 0,
		money: opts.money ?? STARTING_MONEY,
		relics: [],
		levels: { dodge: 1, clean: 1, moon: 1 },
		seals: {},
		cardEditions: {},
		packEditions: opts.packEditions ?? false,
		v4Relics: opts.v4Relics ?? false,
		ploysOn: opts.ploys ?? false,
		ploys: [],
		spotlight: false,
		opening: null,
		tagsOn: opts.tags ?? false,
		deck: opts.deck ?? 'standard',
		tagOffers: [],
		pendingTags: [],
		pack: packs.standardPack(),
		nextCardId: 53,
		score: 0,
		target: 0,
		handsLeft: 0,
		phase: PHASE.PASS,
		hand: null as unknown as Hand,
		shop: null,
		rerollCost: BASE_REROLL_COST,
		aiSkill: opts.aiSkill ?? ai.DEFAULT_SKILL,
		log: [],
		stats: { handsPlayed: 0, moons: 0, cleanHands: 0, bestHand: 0, totalScore: 0, pointsTaken: 0 },
		boardPoints: [0, 0, 0, 0, 0],
		editions: opts.editions ?? false,
		noRepeats: opts.noRepeats ?? false,
		...(opts.tableBase ? { tableBase: opts.tableBase } : {}),
		bosses: opts.bosses ?? false,
		boss: null,
		bossesSeen: [],
		jinxed: null,
		handsThisBoard: HANDS_PER_BOARD,
		moreRelics: opts.moreRelics ?? false,
		moonAI: opts.moonAI ?? false,
		aiCurve: opts.aiCurve ?? false,
		ruleset: opts.ruleset ?? 'classic',
		balance: opts.balance ?? 1
	} as Run;
	applyDeck(run);
	startBoard(run);
	return run;
}

/** Set up the start a deck gives. */
function applyDeck(run: Run) {
	const spade = (rank: number) => run.pack.find((c) => c.suit === H.SPADES && c.rank === rank);
	if (run.deck === 'burned') {
		run.pack = run.pack.filter((c) => !H.isQueenOfSpades(c));
	} else if (run.deck === 'gilded') run.money = 8;
	else if (run.deck === 'royal') {
		const ace = spade(14);
		if (ace) run.cardEditions[String(ace.id)] = 'etched';
	} else if (run.deck === 'schemer') {
		while (run.ploys.length < ploys.PLOY_SLOTS) run.ploys.push(ploys.rollPloy(run.rng).key);
	} else if (run.deck === 'collector') {
		const commons = relics.DEFS.filter((d) => d.rarity === 1 && (run.moreRelics || !d.expansion) && (run.v4Relics || !d.v4Only) && (run.ploysOn || !d.v5Only));
		run.relics.push(relics.instantiate(commons[run.rng.int(1, commons.length) - 1], undefined, run.balance));
		run.money = 2;
	}
}

export function startBoard(run: Run) {
	// A new table: choose its boss now, so the player sees it coming.
	if (run.bosses && run.board === 1) {
		run.boss = bosses.pickBoss(run.rng, run.table, run.bossesSeen, run.balance);
		run.bossesSeen.push(run.boss);
	}
	// And its tags, for skipping Board 1 or 2.
	if (run.tagsOn && run.board === 1) {
		run.tagOffers = [tags.rollTag(run.rng), tags.rollTag(run.rng)];
		run.skipped = [];
	}
	run.jinxed = null;
	if (bossIs(run, 'jinx') && run.relics.length > 0) run.jinxed = run.relics[run.rng.int(1, run.relics.length) - 1].key;
	run.target = targetFor(run.table, run.board, run.tableBase);
	if (bossIs(run, 'shortchanger') && run.balance >= 3) run.target = Math.round(run.target * 0.8);
	run.score = 0;
	run.handsThisBoard = HANDS_PER_BOARD - (bossIs(run, 'shortchanger') ? 1 : 0);
	run.handsLeft = run.handsThisBoard;
	run.boardPoints = [0, 0, 0, 0, 0];
	startHand(run);
}

/** Deal a hand and ask for a pass (or go straight to play on a hold hand). */
export function startHand(run: Run) {
	const { hands: dealt, kitty } = H.dealPack(run.rng, run.pack);
	seals.applyHoming(run.seals, dealt);
	const passDir = H.PASS_ROTATION[run.handCount % H.PASS_ROTATION.length];
	run.hand = { dealt, passDir, passed: [], received: [], state: null, result: null, receivedFrom: new Map(), kitty };
	if (passDir === 'hold') {
		beginPlay(run);
	} else {
		run.phase = PHASE.PASS;
	}
}

/** Pass three cards (ignored on a hold hand). The AI seats pass too. */
export function commitPass(run: Run, chosen: Card[], opts?: { stepwise?: boolean }) {
	assert(run.phase === PHASE.PASS, 'commitPass: not passing');
	const hand = run.hand;
	const mine = hand.dealt[H.PLAYER];
	assert(chosen.length === 3 && chosen.every((c) => mine.includes(c)), 'commitPass: pick three of your cards');
	const passes: Card[][] = [[], [], [], [], []];
	for (let seat = 1; seat <= 4; seat++) {
		passes[seat] = seat === H.PLAYER ? chosen : run.aiCurve ? ai.choosePassPlausible(hand.dealt[seat], run.rng, tableSkill(run)) : ai.choosePass(hand.dealt[seat], run.rng, run.aiSkill);
	}
	// The Pickpocket: whoever passes to you sends their worst three.
	if (bossIs(run, 'pickpocket')) {
		const from = H.passSource(H.PLAYER, hand.passDir);
		passes[from] = ai.mostDangerous(hand.dealt[from], 3);
	}
	const received = H.applyPasses(hand.dealt, passes, hand.passDir);
	hand.passed = chosen.slice();
	hand.received = received[H.PLAYER];
	const from = H.passSource(H.PLAYER, hand.passDir);
	for (const c of hand.received) hand.receivedFrom.set(c, from);
	beginPlay(run, opts);
}

function beginPlay(run: Run, opts?: { stepwise?: boolean }) {
	const base = (c: Card) => seals.cardPoints(run.seals, c);
	let pts = base;
	if (bossIs(run, 'widow')) pts = (c) => (H.isQueenOfSpades(c) ? base(c) * 2 : base(c));
	if (bossIs(run, 'open_book') && run.balance >= 3) pts = (c) => (c.suit === H.HEARTS ? base(c) * 4 : base(c));
	if (bossIs(run, 'diamond_jack')) {
		const jack = (c: Card) => c.suit === H.DIAMONDS && c.rank === 11;
		// v3: every diamond counts a point too.
		pts = run.balance >= 3 ? (c) => (c.suit === H.DIAMONDS ? base(c) + 1 + (jack(c) ? 9 : 0) : base(c)) : (c) => (jack(c) ? base(c) + 10 : base(c));
	}
	run.hand.state = H.newHand(run.hand.dealt, { kitty: run.hand.kitty, pts });
	if (bossIs(run, 'open_book')) run.hand.state.heartsBroken = true;
	// Opponents with a strong hand sometimes go for the moon (decided after the pass).
	if (run.moonAI) {
		const seats = [1, 2, 4].filter((s) => ai.moonWorthy(run.hand.state!.hands[s]) && run.rng.chance(0.7));
		if (seats.length) run.hand.state.moonSeats = seats;
	}
	if (hasRule(run, 'wildcard')) {
		run.hand.state.wildSeat = H.PLAYER;
		run.hand.state.wildLeft = 3;
	}
	run.phase = PHASE.PLAY;
	if (!opts?.stepwise) advanceAI(run);
}

export function isPlayerTurn(run: Run): boolean {
	const st = run.hand?.state;
	return !!st && !st.complete && st.turn === H.PLAYER;
}

/** How a seat plays. Bosses can change it: the Shark (one sharp seat) and
 *  the Cartel (everyone) push points onto you. Your own seat, on autopilot,
 *  always plays normally. */
function aiCtx(run: Run, seat?: number): ai.AIContext {
	const ctx: ai.AIContext = { rng: run.rng, skill: run.aiSkill };
	if (run.aiCurve && seat !== H.PLAYER) {
		ctx.skill = tableSkill(run);
		ctx.plausible = true;
	}
	if (seat === undefined || seat === H.PLAYER) return ctx;
	if (bossIs(run, 'cartel')) ctx.target = H.PLAYER;
	// The Widow and the Diamond Jack (v3): their card is saved for you.
	if (bossIs(run, 'widow') && run.balance >= 3) ctx.saveFor = { seat: H.PLAYER, card: H.isQueenOfSpades };
	if (bossIs(run, 'diamond_jack') && run.balance >= 3) ctx.saveFor = { seat: H.PLAYER, card: (c) => c.suit === H.DIAMONDS && c.rank === 11 };
	if (bossIs(run, 'shark') && seat === bosses.SHARK_SEAT) {
		ctx.target = H.PLAYER;
		ctx.skill = 1;
	}

	return ctx;
}

export function advanceAI(run: Run): Trick[] {
	const st = run.hand.state!;
	const done: Trick[] = [];
	let guard = 0;
	while (!st.complete && st.turn !== H.PLAYER) {
		assert(++guard < 60, 'advanceAI: stuck');
		const t = H.play(st, st.turn, ai.chooseCard(st, st.turn, aiCtx(run, st.turn)));
		if (t) done.push(t);
	}
	if (st.complete) finishHand(run);
	return done;
}

export function playerPlay(run: Run, card: Card, opts?: { stepwise?: boolean }): Trick[] {
	assert(run.phase === PHASE.PLAY && isPlayerTurn(run), 'playerPlay: not your turn');
	const st = run.hand.state!;
	const t = H.play(st, H.PLAYER, card);
	if (opts?.stepwise) {
		if (st.complete) finishHand(run);
		return t ? [t] : [];
	}
	const more = advanceAI(run);
	if (t) more.unshift(t);
	return more;
}

/** One AI card. */
export function stepAI(run: Run): { trick: Trick | null; seat: number; card: Card } | null {
	const st = run.hand.state;
	if (run.phase !== PHASE.PLAY || !st || st.complete || st.turn === H.PLAYER) return null;
	const seat = st.turn;
	const card = ai.chooseCard(st, seat, aiCtx(run, seat));
	const trick = H.play(st, seat, card);
	if (st.complete) finishHand(run);
	return { trick, seat, card };
}

/** Hand your seat to the autopilot for the rest of the hand. */
export function playOut(run: Run) {
	assert(run.phase === PHASE.PLAY, 'playOut: not in play');
	ai.playOut(run.hand.state!, (seat) => aiCtx(run, seat));
	finishHand(run);
}

// ------------------------------------------------------------------ scoring

function scoreContext(run: Run): ScoreCtx {
	const hand = run.hand;
	const st = hand.state!;
	const pts = H.pointsTaken(st);
	const mine = st.taken[H.PLAYER];
	const heartsTaken = mine.filter((c) => c.suit === H.HEARTS).length;
	let shooter = H.moonShooter(st);
	// Half Moon: every heart counts as the moon, even without the queen.
	const packHearts = st.pack.filter((c) => c.suit === H.HEARTS).length;
	if (shooter === null && packHearts > 0 && heartsTaken === packHearts && activeRelics(run).some((r) => r.def.halfMoon)) shooter = H.PLAYER;
	// Shadow Moon: all but one point counts as the moon.
	if (shooter === null && hasRule(run, 'shadowMoon') && pts[H.PLAYER] > 0 && pts[H.PLAYER] >= H.positiveTotal(st) - 3) shooter = H.PLAYER;
	// The Moon Thief: your moon doesn't count.
	if (shooter === H.PLAYER && bossIs(run, 'moon_thief')) shooter = null;
	const myTricks = st.tricks.filter((t) => t.winner === H.PLAYER);
	const afterPass = [...st.played.filter((p) => p.seat === H.PLAYER).map((p) => p.card)];
	const voids = [1, 2, 3, 4].filter((s) => !afterPass.some((c) => c.suit === s)).length;
	// Umbrella: the queen counts nothing for you this hand.
	const umbrellaOff = hand.umbrella && mine.some(H.isQueenOfSpades) ? st.pts(mine.find(H.isQueenOfSpades)!) : 0;
	return {
		myPoints: pts[H.PLAYER] - umbrellaOff,
		heartsTaken,
		tookQueen: mine.some(H.isQueenOfSpades),
		shooter,
		myTricks,
		tricksLed: st.tricks.filter((t) => t.leader === H.PLAYER).length,
		tricks: st.tricks,
		passDir: hand.passDir,
		passed: hand.passed,
		received: hand.received,
		heldQueen: afterPass.some(H.isQueenOfSpades),
		dumpedQueen: st.tricks.some((t) => t.winner !== H.PLAYER && t.plays.some((p) => p.seat === H.PLAYER && H.isQueenOfSpades(p.card))),
		voidsAfterPass: voids,
		tookJackOfDiamonds: mine.some((c) => c.suit === H.DIAMONDS && c.rank === 11),
		boardsWonThisTable: run.boardsWonThisTable,
		moonsThisRun: run.stats.moons,
		taken: mine.slice(),
		pts: st.pts,
		firstHandOfBoard: run.handsLeft === run.handsThisBoard,
		lastHandOfBoard: run.handsLeft === 1,
		behindGoal: run.score < run.target,
		bossBoard: bossActive(run),
		cardsBurned: Math.max(0, 52 - run.pack.filter((c) => (c.id ?? 0) <= 52).length),
		sealedTaken: mine.filter((c) => seals.sealOf(run.seals, c)).length,
		editionCount: run.relics.filter((r) => r.edition).length,
		passedPointsAway: hand.passed.filter((c) => st.pts(c) > 0 && [1, 2, 4].some((s) => st.taken[s].includes(c))).length,
		opponentVoids: [1, 2, 4].reduce((n, s) => n + Object.values(st.voids[s]).filter(Boolean).length, 0),
		balance: run.balance,
		relicCount: run.relics.length,
		commonRelics: run.relics.filter((r) => r.def.rarity === 1).length,
		editionsPlayed: st.played.filter((p) => p.seat === H.PLAYER && cardEds.editionOf(run.cardEditions, p.card)).length
	};
}

/** Score the hand just played: base chips, then every relic. */
export function scoreHand(run: Run): Breakdown {
	const st = run.hand.state!;
	const ctx = scoreContext(run);
	const lines: Line[] = [];
	const live = activeRelics(run);
	const baseX = live.reduce((x, r) => x * (r.def.baseX ?? 1), 1);
	let chips = 0,
		mult = 1,
		relicMoney = 0;
	if (ctx.shooter === H.PLAYER) {
		const moonX = live.reduce((x, r) => x * (r.def.moonX ?? 1), 1);
		chips = 3 * H.positiveTotal(st) * moonX * baseX;
		lines.push({ label: 'Shot the moon!', chips });
	} else if (ctx.shooter !== null) {
		lines.push({ label: `${H.SEAT_NAMES[ctx.shooter]} shot the moon`, chips: 0 });
	} else {
		// Always out of 26, whatever the pack holds: burning point cards makes
		// dodging safer without shrinking the prize; copying them raises the risk.
		const moonlit = hasRule(run, 'moonlighter') && ctx.myPoints >= 13;
		// v3: the Moon Thief doubles the points you take; the Cartel triples them.
		const v3 = run.balance >= 3;
		const counted = ctx.myPoints * (v3 && bossIs(run, 'cartel') ? 3 : v3 && bossIs(run, 'moon_thief') ? 2 : 1);
		const dodged = moonlit ? H.TOTAL_POINTS : Math.max(0, H.TOTAL_POINTS - counted);
		chips = dodged * baseX;
		lines.push({
			label: moonlit ? `Moonlighter: ${ctx.myPoints} points taken, scored as dodged` : ctx.myPoints > 0 ? `26 less ${ctx.myPoints} point${ctx.myPoints === 1 ? '' : 's'} taken` : 'Dodged every point',
			chips
		});
		if (ctx.myPoints === 0 && !bossIs(run, 'auditor')) {
			chips += CLEAN_BONUS;
			lines.push({ label: 'Clean hand', chips: CLEAN_BONUS });
		}
		if (bossIs(run, 'taxman') && ctx.heartsTaken > 0) {
			const tax = (run.balance >= 3 ? 3 : 5) * ctx.heartsTaken;
			chips -= tax;
			lines.push({ label: `The Taxman: ${ctx.heartsTaken} heart${ctx.heartsTaken === 1 ? '' : 's'}`, chips: -tax });
		}
		// The Pickpocket (v3): each card passed to you that you take back costs chips.
		if (bossIs(run, 'pickpocket') && run.balance >= 3) {
			const got = new Set(run.hand.received.map((c) => c.id));
			const back = ctx.taken.filter((c) => got.has(c.id)).length;
			if (back > 0) {
				chips -= PICKPOCKET_FINE * back;
				lines.push({ label: `The Pickpocket: ${back} passed card${back === 1 ? '' : 's'} taken back`, chips: -PICKPOCKET_FINE * back });
			}
		}
	}
	const level = (key: UpgradeKey, applies: boolean) => {
		if (!applies) return;
		const [c, m] = upgradeBonus(key, run.levels[key]);
		if (c > 0 || m > 0) {
			chips += c;
			mult += m;
			lines.push({ label: `${UPGRADES[key].name} level ${run.levels[key]}`, chips: c, mult: m });
		}
	};
	// Balance 4: the moon is the best hand there is, so it scores the Dodge
	// and Clean Sheet levels too, and doubles the mult.
	const bigMoon = run.balance >= 4 && ctx.shooter === H.PLAYER;
	level('moon', ctx.shooter === H.PLAYER);
	level('dodge', ctx.shooter === null || bigMoon);
	level('clean', (ctx.shooter === null && ctx.myPoints === 0 && !bossIs(run, 'auditor')) || bigMoon);
	const moonX = bigMoon ? MOON_X : 1;
	for (const relic of live) {
		const e = relic.def.score?.(ctx, relic);
		if (e && (e.chips || e.mult || e.money || (e.xmult && e.xmult !== 1))) {
			if (e.chips) chips += e.chips;
			if (e.mult) mult += e.mult;
			if (e.xmult) mult *= e.xmult;
			if (e.money) relicMoney += e.money;
			lines.push({ label: relic.name, chips: e.chips || undefined, mult: e.mult || undefined, xmult: e.xmult, money: e.money || undefined });
		}
		const ed = relic.edition ? relics.EDITIONS[relic.edition] : null;
		if (ed?.effect) {
			const f = ed.effect;
			if (f.chips) chips += f.chips;
			if (f.mult) mult += f.mult;
			if (f.xmult) mult *= f.xmult;
			lines.push({ label: `${ed.name} ${relic.name}`, chips: f.chips, mult: f.mult, xmult: f.xmult, edition: ed.key });
		}
	}
	// Seals on the cards that changed hands this deal.
	let money = relicMoney;
	for (const t of st.tricks) {
		for (const p of t.plays) {
			// A card edition pays when you play the card.
			const ed = p.seat === H.PLAYER ? cardEds.editionOf(run.cardEditions, p.card) : undefined;
			if (ed) {
				const e = cardEds.CARD_EDITIONS[ed];
				if (e.effect.chips) chips += e.effect.chips;
				if (e.effect.mult) mult += e.effect.mult;
				if (e.effect.xmult) mult *= e.effect.xmult;
				lines.push({ label: `${e.name} ${cards.name(p.card)}`, chips: e.effect.chips, mult: e.effect.mult, xmult: e.effect.xmult, edition: ed });
			}
			const seal = seals.sealOf(run.seals, p.card);
			if (!seal) continue;
			const name = `${seals.SEALS[seal].name.replace(' Seal', '')} ${cards.name(p.card)}`;
			if (seal === 'gilded' && t.winner === H.PLAYER) {
				money += 2;
				lines.push({ label: name, money: 2 });
			} else if (seal === 'thorn' && t.winner !== H.PLAYER && ctx.shooter === null) {
				chips += 12;
				lines.push({ label: `${name} (to ${H.SEAT_NAMES[t.winner]})`, chips: 12 });
			} else if (seal === 'crown' && t.winner === H.PLAYER && t.winningCard === p.card) {
				mult += 0.5;
				lines.push({ label: name, mult: 0.5 });
			}
		}
	}
	if (moonX !== 1) {
		mult *= moonX;
		lines.push({ label: 'The moon', xmult: moonX });
	}
	if (run.spotlight) {
		mult *= 2;
		lines.push({ label: 'Spotlight', xmult: 2 });
	}
	// The Shark (v3): a hand where you take more points than North loses a quarter.
	if (bossIs(run, 'shark') && run.balance >= 3 && ctx.shooter === null && ctx.myPoints > H.pointsTaken(st)[bosses.SHARK_SEAT]) {
		mult *= 0.75;
		lines.push({ label: `The Shark: more points than ${H.SEAT_NAMES[bosses.SHARK_SEAT]}`, xmult: 0.75 });
	}
	// The Widow (v3): the hand you take her queen in scores half.
	if (bossIs(run, 'widow') && run.balance >= 3 && ctx.tookQueen && ctx.shooter !== H.PLAYER) {
		mult *= 0.5;
		lines.push({ label: 'The Widow: you took her queen', xmult: 0.5 });
	}
	return {
		lines,
		chips,
		mult,
		total: Math.max(0, Math.floor(chips * mult)),
		myPoints: ctx.myPoints,
		shooter: ctx.shooter,
		points: H.pointsTaken(st),
		money
	};
}

/** Fall Guy: the first trick you won from the trick it was played on goes,
 *  cards and points, to the player on your left (West). */
function applyFallGuy(run: Run) {
	const st = run.hand.state!;
	const from = run.hand.fallGuyFrom;
	if (from === undefined) return;
	const t = st.tricks.slice(from).find((x) => x.winner === H.PLAYER);
	if (!t) return;
	const moved = new Set([...t.plays.map((p) => p.card), ...t.kitty]);
	const left = H.WEST;
	st.taken[H.PLAYER] = st.taken[H.PLAYER].filter((c) => !moved.has(c));
	st.taken[left] = [...st.taken[left], ...moved];
}

/** The Fixer: each hand, the first heart you took goes to whoever has the
 *  most points (never when you're shooting the moon). */
function applyFixer(run: Run) {
	const fixer = activeRelics(run).find((r) => r.def.fixer);
	const st = run.hand.state!;
	if (!fixer || H.moonShooter(st) === H.PLAYER) return;
	const won = st.tricks.filter((t) => t.winner === H.PLAYER);
	const heart = won.flatMap((t) => [...t.plays.map((p) => p.card), ...t.kitty]).find((c) => c.suit === H.HEARTS && st.taken[H.PLAYER].includes(c));
	if (!heart) return;
	const pts = H.pointsTaken(st);
	const to = [1, 2, 4].reduce((a, b) => (pts[b] > pts[a] ? b : a));
	st.taken[H.PLAYER].splice(st.taken[H.PLAYER].indexOf(heart), 1);
	st.taken[to].push(heart);
	fixer.state.used = `${run.table}.${run.board}.${run.handCount}`;
}

export function finishHand(run: Run): Breakdown {
	const hand = run.hand;
	if (hand.result) return hand.result;
	applyFallGuy(run);
	applyFixer(run);
	const ctx = scoreContext(run);
	const b = scoreHand(run);
	run.spotlight = false;
	hand.result = b;
	run.score += b.total;
	run.money += b.money;
	run.handsLeft--;
	run.handCount++;
	for (let s = 1; s <= 4; s++) run.boardPoints[s] += b.points[s];
	run.stats.handsPlayed++;
	run.stats.totalScore += b.total;
	run.stats.pointsTaken += b.myPoints;
	if (b.total > run.stats.bestHand) run.stats.bestHand = b.total;
	if (b.shooter === H.PLAYER) run.stats.moons++;
	if (b.myPoints === 0 && b.shooter === null) run.stats.cleanHands++;
	for (const r of activeRelics(run)) r.def.onHandEnd?.(ctx, r);
	run.log.push({ table: run.table, board: run.board, points: b.myPoints, score: b.total, moon: b.shooter === H.PLAYER });
	run.phase = PHASE.HAND_SCORED;
	return b;
}

/** Can you look at the deck now? Any time but mid-hand: once the first
 *  trick is done it would tell you who holds what, unless you have the Glass
 *  Deck. */
export function canSeeDeck(run: Run): boolean {
	// The Blindfold: your hand is hidden while you pass, and the deck would show it.
	if (run.phase === PHASE.PASS && bossIs(run, 'blindfold')) return false;
	if (run.phase !== PHASE.PLAY) return true;
	if (activeRelics(run).some((r) => r.def.seeDeck)) return true;
	return (run.hand.state?.tricks.length ?? 0) === 0;
}

/** Is this the last board of the run (the last table's High Board)? */
export function isFinalBoard(run: Run): boolean {
	return run.table >= TABLES && run.board >= BOARDS_PER_TABLE;
}

export function continueAfterHand(run: Run): Phase {
	assert(run.phase === PHASE.HAND_SCORED, 'continueAfterHand: nothing to continue');
	if (run.score >= run.target) {
		winBoard(run);
		// The last table's High Board: the run is won; no club after it.
		if (isFinalBoard(run)) run.phase = PHASE.VICTORY;
	} else if (run.handsLeft <= 0) run.phase = PHASE.GAME_OVER;
	else startHand(run);
	return run.phase;
}

// ------------------------------------------------------------------ economy

export function interest(run: Run): number {
	const cap = Math.max(MAX_INTEREST, ...run.relics.map((r) => r.def.interestCap ?? 0));
	return Math.min(cap, Math.floor(run.money / INTEREST_PER));
}

export function winBoard(run: Run): Payout {
	let bonus = 0;
	for (const r of run.relics) {
		const out = r.def.onBoardWin?.(r, { boss: bossActive(run), seals: Object.keys(run.seals).length, balance: run.balance });
		if (out && out.money) bonus += out.money;
	}
	const p: Payout = {
		board: MONEY_PER_BOARD,
		unused: Math.max(0, run.handsLeft) * MONEY_PER_UNUSED_HAND,
		interest: interest(run) * (run.pendingTags.includes('interest') ? 2 : 1),
		relics: bonus,
		total: 0
	};
	if (bossActive(run)) p.boss = bosses.BOSS_BONUS;
	if (run.balance >= 3) {
		const o = overshootBonus(run.score, run.target);
		if (o > 0) p.overshoot = o;
	}
	run.pendingTags = run.pendingTags.filter((t) => t !== 'interest');
	p.total = p.board + p.unused + p.interest + p.relics + (p.boss ?? 0) + (p.overshoot ?? 0);
	run.money += p.total;
	run.lastPayout = p;
	run.boardsWonThisTable++;
	run.phase = PHASE.BOARD_WON;
	return p;
}

export function enterShop(run: Run) {
	assert(run.phase === PHASE.BOARD_WON, 'enterShop: no board won');
	run.phase = PHASE.SHOP;
	run.rerollCost = run.relics.some((r) => r.def.bargain) ? 0 : BASE_REROLL_COST;
	run.shop = { items: [] };
	for (let i = 0; i < SHOP_SIZE; i++) run.shop.items[i] = rollShopItem(run);
	// Tags taken by skipping: a free bundle, free rerolls.
	if (run.pendingTags.includes('bundle')) run.shop.items.push({ kind: 'bundle', def: bundles.BUNDLES.relic, name: 'Free Relic Bundle', cost: 0 });
	if (run.pendingTags.includes('reroll')) run.rerollCost = 0;
	run.freeRerolls = run.pendingTags.includes('reroll');
	run.pendingTags = run.pendingTags.filter((t) => t !== 'bundle' && t !== 'reroll');
}

/** What makes two club items the same offer. */
function offerKey(item: ShopItem): string {
	return `${item.kind}:${item.def.key}`;
}

export function rollShopItem(run: Run): ShopItem {
	let item = rollOffer(run);
	if (!run.noRepeats) return item;
	const taken = new Set((run.shop?.items ?? []).filter(Boolean).map(offerKey));
	for (let i = 0; i < 30 && taken.has(offerKey(item)); i++) item = rollOffer(run);
	return item;
}

function rollOffer(run: Run): ShopItem {
	const roll = run.rng.next();
	if (roll >= 0.12 && roll < 0.24) {
		const def = packs.rollOp(run.rng);
		return { kind: 'pack', def, name: def.name, cost: def.cost };
	}
	if (roll < 0.12) {
		const def = seals.SEALS[seals.SEAL_KEYS[run.rng.int(1, seals.SEAL_KEYS.length) - 1]];
		return { kind: 'seal', def, name: def.name, cost: def.cost };
	}
	// v4: card editions take 12% of offers, from the upgrades' share and the
	// relics' (measured: all from upgrades costs the bot a quarter of its
	// wins; all from relics adds a third).
	// v5: ploys (8%) and bundles (8%), from the upgrades', editions' and relics' shares.
	const v5 = run.ploysOn;
	const edLo = v5 ? 0.38 : 0.42,
		edHi = v5 ? 0.48 : 0.54;
	if (v5 && roll >= 0.48 && roll < 0.56) {
		const def = ploys.rollPloy(run.rng);
		return { kind: 'ploy', def, name: def.name, cost: def.cost };
	}
	if (v5 && roll >= 0.56 && roll < 0.64) {
		const def = bundles.rollBundle(run.rng);
		return { kind: 'bundle', def, name: def.name, cost: def.cost };
	}
	if (run.packEditions && roll >= edLo && roll < edHi) {
		const def = cardEds.rollCardEdition(run.rng);
		return { kind: 'edition', def, name: `${def.name} card`, cost: def.cost };
	}
	if (roll < (run.packEditions ? edLo : 0.5)) {
		const r = run.rng.next();
		const key: UpgradeKey = r < 0.6 ? 'dodge' : r < 0.85 ? 'clean' : 'moon';
		const def = UPGRADES[key];
		return { kind: 'upgrade', def, name: def.name, cost: 4 + run.levels[key] };
	}
	const owned = [
		...run.relics,
		...(run.shop?.items ?? []).filter((i) => i && i.kind === 'relic').map((i) => ({ key: i.def.key }))
	];
	const def = relics.randomUnowned(run.rng, owned, run.moreRelics, run.v4Relics, run.ploysOn) ?? relics.DEFS[0];
	// Only roll when editions are on, so runs without them keep their
	// exact sequence of shop offers.
	const edition = run.editions ? relics.rollEdition(run.rng) : undefined;
	const price = relics.costAt(def, run.balance);
	if (!edition) return { kind: 'relic', def, name: def.name, cost: price };
	return { kind: 'relic', def, name: def.name, cost: price + relics.EDITIONS[edition].cost, edition };
}

export function canBuy(run: Run, i: number): [boolean, string?] {
	const item = run.shop?.items[i];
	if (!item || item.sold) return [false, 'gone'];
	if (run.money < item.cost) return [false, 'too expensive'];
	if (item.kind === 'relic' && item.edition !== 'phantom' && !item.def.extraSlot && relicSlotsUsed(run) >= relicSlots(run)) return [false, 'no relic slots'];
	if (item.kind === 'ploy' && run.ploys.length >= ploys.PLOY_SLOTS) return [false, 'no ploy slots'];
	if (run.opening) return [false, 'open the bundle first'];
	return [true];
}

/** Buy a shop item. Seals and pack items need the id of a card in the pack. */
export function buy(run: Run, i: number, cardId?: number): [boolean, string?] {
	const check = canBuy(run, i);
	if (!check[0]) return check;
	const item = run.shop!.items[i];
	const card = run.pack.find((c) => c.id === cardId);
	if (item.kind === 'seal' && !card) return [false, 'choose a card for the seal'];
	if (item.kind === 'edition' && !card) return [false, 'choose a card for the edition'];
	if (item.kind === 'pack') {
		const ok = packs.canApply(run, item.def, card);
		if (!ok[0]) return ok;
	}
	run.money -= item.cost;
	if (item.kind === 'relic') run.relics.push(relics.instantiate(item.def, item.edition, run.balance));
	else if (item.kind === 'upgrade') run.levels[item.def.key]++;
	else if (item.kind === 'seal') run.seals[String(cardId)] = item.def.key;
	else if (item.kind === 'edition') run.cardEditions[String(cardId)] = item.def.key;
	else if (item.kind === 'ploy') run.ploys.push(item.def.key);
	else if (item.kind === 'bundle') run.opening = { bundle: item.def.key, options: bundleOptions(run, item.def.key) };
	else packs.apply(run, item.def, cardId!);
	item.sold = true;
	return [true];
}

// ------------------------------------------------------------------ bundles and ploys

/** A bundle's three choices, all different. */
function bundleOptions(run: Run, key: BundleKey): BundleChoice[] {
	const out: BundleChoice[] = [];
	if (key === 'relic') {
		const owned: { key: string }[] = [...run.relics, ...(run.shop?.items ?? []).filter((i) => i && i.kind === 'relic').map((i) => ({ key: i.def.key }))];
		for (let i = 0; i < bundles.BUNDLE_SIZE; i++) {
			const def = relics.randomUnowned(run.rng, owned, run.moreRelics, run.v4Relics, run.ploysOn);
			if (!def) break;
			owned.push({ key: def.key });
			out.push({ kind: 'relic', def, edition: run.editions ? relics.rollEdition(run.rng) : undefined });
		}
	} else if (key === 'ploy') {
		const seen = new Set<string>();
		for (let tries = 0; out.length < bundles.BUNDLE_SIZE && tries < 30; tries++) {
			const def = ploys.rollPloy(run.rng);
			if (seen.has(def.key)) continue;
			seen.add(def.key);
			out.push({ kind: 'ploy', def });
		}
	} else {
		const free = run.pack.filter((c) => !run.cardEditions[String(c.id)]);
		for (let i = 0; i < bundles.BUNDLE_SIZE && free.length; i++) {
			const card = free.splice(run.rng.int(1, free.length) - 1, 1)[0];
			out.push({ kind: 'edition', cardId: card.id!, edition: cardEds.rollCardEdition(run.rng).key });
		}
	}
	return out;
}

/** Take one of the open bundle's choices (or none, with -1). */
export function pickFromBundle(run: Run, i: number): [boolean, string?] {
	const open = run.opening;
	if (!open) return [false, 'no bundle open'];
	if (i < 0) {
		run.opening = null;
		return [true];
	}
	const c = open.options[i];
	if (!c) return [false, 'no such choice'];
	if (c.kind === 'relic') {
		if (c.edition !== 'phantom' && !c.def.extraSlot && relicSlotsUsed(run) >= relicSlots(run)) return [false, 'no relic slots'];
		run.relics.push(relics.instantiate(c.def, c.edition, run.balance));
	} else if (c.kind === 'ploy') {
		if (run.ploys.length >= ploys.PLOY_SLOTS) return [false, 'no ploy slots'];
		run.ploys.push(c.def.key);
	} else run.cardEditions[String(c.cardId)] = c.edition;
	run.opening = null;
	return [true];
}

/** Can the ploy in this slot be used now? */
export function canUsePloy(run: Run, slot: number): [boolean, string?] {
	const key = run.ploys[slot];
	if (!key) return [false, 'no ploy there'];
	const def = ploys.PLOYS[key];
	const when = run.phase === PHASE.PASS ? 'pass' : run.phase === PHASE.PLAY ? 'play' : run.phase === PHASE.HAND_SCORED ? 'hand_scored' : run.phase === PHASE.SHOP ? 'shop' : null;
	if (!when || !def.when.includes(when)) return [false, 'not now'];
	if (when === 'play' && (!run.hand.state || run.hand.state.complete)) return [false, 'not now'];
	if (when === 'hand_scored' && key === 'encore' && run.score >= run.target) return [false, 'the board is won'];
	if (key === 'spotlight' && run.spotlight) return [false, 'already in the spotlight'];
	if (key === 'umbrella' && run.hand.umbrella) return [false, 'already open'];
	if (key === 'fall_guy' && run.hand.fallGuyFrom !== undefined) return [false, 'already set up'];
	return [true];
}

/** Use the ploy in this slot. */
export function usePloy(run: Run, slot: number): [boolean, string?] {
	const ok = canUsePloy(run, slot);
	if (!ok[0]) return ok;
	const key = run.ploys[slot];
	const st = run.hand.state;
	if (key === 'spyglass') run.hand.spyTrick = st!.tricks.length;
	else if (key === 'umbrella') run.hand.umbrella = true;
	else if (key === 'fall_guy') run.hand.fallGuyFrom = st!.tricks.length;
	else if (key === 'encore') run.handsLeft++;
	else if (key === 'spotlight') run.spotlight = true;
	else run.money += 5;
	run.ploys.splice(slot, 1);
	return [true];
}

/** The tag for skipping the current board, if it can be skipped now:
 *  Board 1 or 2, before its first pass. */
export function skipTag(run: Run): TagKey | null {
	if (!run.tagsOn || run.board >= BOARDS_PER_TABLE) return null;
	// Before anything happens: while passing, or on a no-pass hand before the first card.
	const fresh = run.phase === PHASE.PASS || (run.phase === PHASE.PLAY && (run.hand.state?.played.length ?? 1) === 0);
	if (!fresh) return null;
	if (run.handsLeft !== run.handsThisBoard || run.score > 0) return null;
	return run.tagOffers[run.board - 1] ?? null;
}

/** Skip the current board: take its tag, and go straight to the next board
 *  (no pay, no club). */
export function skipBoard(run: Run): [boolean, string?] {
	const tag = skipTag(run);
	if (!tag) return [false, "this board can't be skipped"];
	if (tag === 'ploy') {
		if (run.ploys.length < ploys.PLOY_SLOTS) run.ploys.push(ploys.rollPloy(run.rng).key);
		else run.money += 3;
	} else if (tag === 'edition') {
		const free = run.pack.filter((c) => !run.cardEditions[String(c.id)]);
		if (free.length) run.cardEditions[String(free[run.rng.int(1, free.length) - 1].id)] = cardEds.rollCardEdition(run.rng).key;
	} else if (tag === 'cash') run.money += 8;
	else run.pendingTags.push(tag);
	run.stats.boardsSkipped = (run.stats.boardsSkipped ?? 0) + 1;
	run.skipped = [...(run.skipped ?? []), run.board];
	run.board++;
	startBoard(run);
	return [true];
}

export function sellRelic(run: Run, i: number): boolean {
	const r = run.relics[i];
	if (!r) return false;
	run.money += Math.max(1, Math.floor(r.cost / 2));
	run.relics.splice(i, 1);
	return true;
}

export function reroll(run: Run): boolean {
	if (run.money < run.rerollCost || run.opening) return false;
	run.money -= run.rerollCost;
	run.rerollCost = run.freeRerolls ? 0 : run.relics.some((r) => r.def.bargain) ? Math.max(BASE_REROLL_COST - 1, run.rerollCost + 1) : run.rerollCost + 1;
	run.shop!.items = [];
	for (let i = 0; i < SHOP_SIZE; i++) run.shop!.items[i] = rollShopItem(run);
	return true;
}

export function leaveShop(run: Run): Phase {
	run.opening = null;
	run.board++;
	if (run.board > BOARDS_PER_TABLE) {
		run.board = 1;
		run.table++;
		run.boardsWonThisTable = 0;
	}
	if (run.table > TABLES) {
		run.phase = PHASE.VICTORY;
		return run.phase;
	}
	startBoard(run);
	return run.phase;
}
