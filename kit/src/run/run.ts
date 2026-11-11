// The generic run: what every card roguelike in this style shares, whatever
// game is played at the table.
//
//   tables x boards x hands   Each board has a goal; reach it within its
//                             hands to win the board, earn money and visit
//                             the club. Win every board of every table.
//   score                     A hand scores chips x mult: the game's base
//                             lines, then upgrade levels, then relics (in
//                             the order you hold them), then ploys.
//   the club                  Relics, upgrades and ploys; reroll, sell.
//   saves                     A run is its seed and its actions: replaying
//                             them rebuilds it exactly (see save.ts).
//
// The game itself lives in a GameModule: how a hand is dealt, the actions a
// player takes before and during play (passing, bidding, playing a card),
// when the hand is over, its base score, and its content (relics, upgrades,
// ploys). The run calls the module; the module never reaches into the run
// beyond `run.hand`, `run.ext` and the helpers here.

import { newRng, randomSeedString, type RNG } from '../core/rules/rng.ts';

// ------------------------------------------------------------------ scoring

export interface Line {
	label: string;
	chips?: number;
	mult?: number;
	xmult?: number;
	money?: number;
}

/** What a relic, upgrade or ploy adds to a hand. */
export interface Effect {
	chips?: number;
	/** Vulnerable's relics say points; the same thing. */
	points?: number;
	mult?: number;
	xmult?: number;
	money?: number;
}

/** A hand's score, line by line. */
export interface Breakdown {
	/** A headline for the score panel ("Clean hand!", "4♠ made"). */
	title: string;
	/** False when the hand scores nothing at all (a failed contract). */
	made: boolean;
	lines: Line[];
	chips: number;
	mult: number;
	total: number;
	money: number;
	/** Anything the game wants to show with it (points taken, tricks). */
	detail?: unknown;
}

/** The game's own part of a hand's score, before levels and relics. */
export interface BaseScore<S> {
	title: string;
	made: boolean;
	lines: Line[];
	/** What relics see: the game's facts about the hand. */
	ctx: S;
	/** Which upgrades this hand levels (their keys). */
	levels: string[];
	detail?: unknown;
}

// ------------------------------------------------------------------ content

export interface Relic<S = unknown> {
	key: string;
	def: RelicDef<S>;
	name: string;
	cost: number;
	/** Scaling relics keep what they've grown here. */
	state: Record<string, any>;
}

export interface RelicDef<S = unknown> {
	key: string;
	name: string;
	rarity: number;
	cost: number;
	icon: string;
	text: string;
	/** Live text, for relics whose value changes. */
	describe?: (relic: Relic<S>) => string;
	score?: (ctx: S, relic: Relic<S>) => Effect | null | void;
	/** After each hand is banked (scaling relics grow here); may pay money. */
	onHandEnd?: (ctx: S, relic: Relic<S>, made: boolean, run: Run) => { money?: number } | void;
	onBoardWin?: (relic: Relic<S>, run: Run) => { money?: number } | void;
}

/** A permanent level for one kind of hand: each level past the first adds
 *  `chips` and `mult` whenever the game says that kind of hand was played. */
export interface UpgradeDef {
	key: string;
	name: string;
	icon: string;
	text: string;
	chips: number;
	mult: number;
}

export interface PloyDef {
	key: string;
	name: string;
	text: string;
	cost: number;
	icon: string;
	/** When it can be used. */
	when: Phase[];
	canUse?: (run: Run) => [boolean, string?];
	use: (run: Run) => void;
}

export const RARITY_NAME = ['', 'Common', 'Uncommon', 'Rare', 'Legendary'];

// ------------------------------------------------------------------ module

export interface GameModule<H = any, A = any, S = any> {
	id: string;
	title: string;
	tagline: string;
	/** What the game calls things. */
	words: {
		table: string; // "Table", "Rubber"
		hand: string; // "hand", "deal"
		hands: string;
		chips: string; // "chips", "points"
		/** The pre-play step, if any: "Pass", "Bid". */
		pre?: string;
	};
	tables: number;
	boardsPerTable: number;
	handsPerBoard: number;
	startMoney: number;
	goal(table: number, board: number): number;
	boardName?(run: Run<H>): string;
	/** Called as each board starts (vulnerability, a boss...). */
	startBoard?(run: Run<H>): void;
	/** Deal a new hand. Return 'pre' to ask for the pre-play step first. */
	deal(run: Run<H>): { hand: H; phase: 'pre' | 'play' };
	/** Apply one of the game's own actions; throw if it's illegal. The module
	 *  runs the AI seats after it until it's the player's turn again. */
	act(run: Run<H>, action: A): void;
	/** The hand has been played out. */
	handOver(run: Run<H>): boolean;
	/** The game's part of the score. */
	score(run: Run<H>): BaseScore<S>;
	relics: RelicDef<S>[];
	upgrades: UpgradeDef[];
	/** The game's own ploys; the kit adds its generic ones. */
	ploys?: PloyDef[];
	/** A sensible action for the player right now: autoplay and tests. Any
	 *  randomness comes from `rng`, never the run's own (replays must match). */
	bot(run: Run<H>, rng: RNG): A;
	/** The club's mix: chance of an upgrade and of a ploy (the rest relics). */
	shopOdds?: { upgrade: number; ploy: number };
}

// ------------------------------------------------------------------ the run

export const PHASE = {
	PRE: 'pre',
	PLAY: 'play',
	SCORED: 'scored',
	WON: 'won',
	SHOP: 'shop',
	OVER: 'over',
	VICTORY: 'victory'
} as const;
export type Phase = (typeof PHASE)[keyof typeof PHASE];

export type ShopItem =
	| { kind: 'relic'; def: RelicDef; name: string; cost: number; sold?: boolean }
	| { kind: 'upgrade'; def: UpgradeDef; name: string; cost: number; sold?: boolean }
	| { kind: 'ploy'; def: PloyDef; name: string; cost: number; sold?: boolean };

export interface Payout {
	board: number;
	unused: number;
	interest: number;
	relics: number;
	total: number;
}

export interface Stats {
	hands: number;
	made: number;
	best: number;
	total: number;
	ploysUsed: number;
}

export interface Run<H = any> {
	game: string;
	module: GameModule<H>;
	seed: string | number;
	rng: RNG;
	table: number;
	board: number;
	boardsWonThisTable: number;
	money: number;
	score: number;
	target: number;
	handsLeft: number;
	phase: Phase;
	hand: H;
	result: Breakdown | null;
	relics: Relic[];
	/** Ploy keys held. */
	ploys: string[];
	levels: Record<string, number>;
	shop: { items: ShopItem[] } | null;
	rerollCost: number;
	/** Spotlight: the next hand scores x2. */
	spotlight?: boolean;
	lastPayout?: Payout;
	stats: Stats;
	/** The game's own run state (vulnerability, a pass rotation...). */
	ext: Record<string, any>;
}

export const RELIC_SLOTS = 5;
export const PLOY_SLOTS = 2;
export const SHOP_SIZE = 4;
export const BASE_REROLL = 5;
export const MONEY_PER_BOARD = 4;
export const MONEY_PER_UNUSED = 1;
export const INTEREST_PER = 5;
export const MAX_INTEREST = 5;

/** Ploys every game gets. */
export const GENERIC_PLOYS: PloyDef[] = [
	{
		key: 'encore', name: 'Encore', text: '+1 hand on this board', cost: 5, icon: 'ploy_encore',
		when: [PHASE.PRE, PHASE.PLAY, PHASE.SCORED],
		canUse: (run) => (run.phase === PHASE.SCORED && run.score >= run.target ? [false, 'the board is won'] : [true]),
		use: (run) => run.handsLeft++
	},
	{
		key: 'spotlight', name: 'Spotlight', text: 'Your next hand scores x2 mult', cost: 4, icon: 'ploy_spotlight',
		when: [PHASE.PRE, PHASE.PLAY],
		canUse: (run) => (run.spotlight ? [false, 'already in the spotlight'] : [true]),
		use: (run) => (run.spotlight = true)
	},
	{
		key: 'windfall', name: 'Windfall', text: 'Gain $5', cost: 2, icon: 'ploy_windfall',
		when: [PHASE.PRE, PHASE.PLAY, PHASE.SCORED, PHASE.SHOP],
		use: (run) => (run.money += 5)
	}
];

export function allPloys(m: GameModule): PloyDef[] {
	return [...GENERIC_PLOYS, ...(m.ploys ?? [])];
}
export function ployDef(run: Run, key: string): PloyDef | undefined {
	return allPloys(run.module).find((p) => p.key === key);
}

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

export function newRun<H>(module: GameModule<H>, seed?: string | number, opts: { money?: number } = {}): Run<H> {
	seed = seed ?? randomSeedString(newRng());
	const run: Run<H> = {
		game: module.id,
		module,
		seed,
		rng: newRng(seed),
		table: 1,
		board: 1,
		boardsWonThisTable: 0,
		money: opts.money ?? module.startMoney,
		score: 0,
		target: 0,
		handsLeft: 0,
		phase: PHASE.PRE,
		hand: null as H,
		result: null,
		relics: [],
		ploys: [],
		levels: Object.fromEntries(module.upgrades.map((u) => [u.key, 1])),
		shop: null,
		rerollCost: BASE_REROLL,
		stats: { hands: 0, made: 0, best: 0, total: 0, ploysUsed: 0 },
		ext: {}
	};
	startBoard(run);
	return run;
}

export function boardName(run: Run): string {
	return run.module.boardName?.(run) ?? `Board ${run.board}`;
}

function startBoard(run: Run) {
	run.target = run.module.goal(run.table, run.board);
	run.score = 0;
	run.handsLeft = run.module.handsPerBoard;
	run.module.startBoard?.(run);
	startHand(run);
}

function startHand(run: Run) {
	run.result = null;
	const { hand, phase } = run.module.deal(run);
	run.hand = hand;
	run.phase = phase === 'pre' ? PHASE.PRE : PHASE.PLAY;
	// A module may finish a hand inside deal (an all-AI hand); bank it.
	afterGameStep(run);
}

/** One of the game's own actions: pass, bid, play a card, play it out. */
export function act(run: Run, action: unknown) {
	assert(run.phase === PHASE.PRE || run.phase === PHASE.PLAY, 'act: not at the table');
	run.module.act(run, action);
	afterGameStep(run);
}

/** Moves the module made can leave the phase at PRE or PLAY; we look at
 *  the module's state to see whether the hand is done. */
function afterGameStep(run: Run) {
	if ((run.phase === PHASE.PRE || run.phase === PHASE.PLAY) && run.module.handOver(run)) finishHand(run);
}

/** The game's base score, then levels, relics and ploys: the hand's total. */
export function pipeline<S>(run: Run, base: BaseScore<S>): Breakdown {
	const lines = base.lines.slice();
	let chips = lines.reduce((n, l) => n + (l.chips ?? 0), 0);
	let mult = (1 + lines.reduce((n, l) => n + (l.mult ?? 0), 0)) * lines.reduce((x, l) => x * (l.xmult ?? 1), 1);
	let money = 0;
	if (!base.made) return { title: base.title, made: false, lines, chips, mult, total: 0, money: 0, detail: base.detail };
	for (const key of base.levels) {
		const u = run.module.upgrades.find((x) => x.key === key);
		const lvl = run.levels[key] ?? 1;
		if (!u || lvl <= 1) continue;
		const c = (lvl - 1) * u.chips,
			m = (lvl - 1) * u.mult;
		chips += c;
		mult += m;
		lines.push({ label: `${u.name} level ${lvl}`, chips: c, mult: m });
	}
	for (const relic of run.relics) {
		const e = relic.def.score?.(base.ctx as never, relic as never);
		if (!e) continue;
		const c = e.chips ?? e.points ?? 0;
		if (!c && !e.mult && !e.money && (!e.xmult || e.xmult === 1)) continue;
		chips += c;
		mult += e.mult ?? 0;
		if (e.xmult) mult *= e.xmult;
		money += e.money ?? 0;
		lines.push({ label: relic.name, chips: c || undefined, mult: e.mult || undefined, xmult: e.xmult, money: e.money || undefined });
	}
	if (run.spotlight) {
		mult *= 2;
		lines.push({ label: 'Spotlight', xmult: 2 });
	}
	return { title: base.title, made: true, lines, chips, mult, total: Math.max(0, Math.floor(chips * mult)), money, detail: base.detail };
}

function finishHand(run: Run) {
	const base = run.module.score(run);
	const b = pipeline(run, base);
	run.result = b;
	run.spotlight = false;
	run.score += b.total;
	run.money += b.money;
	run.handsLeft--;
	run.stats.hands++;
	if (b.made) run.stats.made++;
	run.stats.total += b.total;
	run.stats.best = Math.max(run.stats.best, b.total);
	for (const r of run.relics) {
		const out = r.def.onHandEnd?.(base.ctx as never, r as never, b.made, run);
		if (out?.money) run.money += out.money;
	}
	run.phase = PHASE.SCORED;
}

/** After the score panel: the next hand, the board won, or the end. */
export function next(run: Run) {
	assert(run.phase === PHASE.SCORED, 'next: nothing scored');
	if (run.score >= run.target) winBoard(run);
	else if (run.handsLeft <= 0) run.phase = PHASE.OVER;
	else startHand(run);
}

export function interest(run: Run): number {
	return Math.min(MAX_INTEREST, Math.floor(run.money / INTEREST_PER));
}

function winBoard(run: Run) {
	let relics = 0;
	for (const r of run.relics) relics += r.def.onBoardWin?.(r as never, run)?.money ?? 0;
	const p: Payout = { board: MONEY_PER_BOARD, unused: Math.max(0, run.handsLeft) * MONEY_PER_UNUSED, interest: interest(run), relics, total: 0 };
	p.total = p.board + p.unused + p.interest + p.relics;
	run.money += p.total;
	run.lastPayout = p;
	run.boardsWonThisTable++;
	run.phase = run.board === run.module.boardsPerTable && run.table === run.module.tables ? PHASE.VICTORY : PHASE.WON;
}

// ------------------------------------------------------------------ the club

export function enterShop(run: Run) {
	assert(run.phase === PHASE.WON, 'enterShop: no board won');
	run.phase = PHASE.SHOP;
	run.rerollCost = BASE_REROLL;
	run.shop = { items: Array.from({ length: SHOP_SIZE }, () => rollItem(run)) };
}

const RARITY_ODDS = [0, 0.7, 0.25, 0.05];

function rollItem(run: Run): ShopItem {
	const m = run.module;
	const odds = m.shopOdds ?? { upgrade: 0.2, ploy: 0.2 };
	const roll = run.rng.next();
	if (roll < odds.upgrade && m.upgrades.length) {
		const def = run.rng.pick(m.upgrades)!;
		return { kind: 'upgrade', def, name: def.name, cost: 3 + (run.levels[def.key] ?? 1) };
	}
	if (roll < odds.upgrade + odds.ploy) {
		const def = run.rng.pick(allPloys(m))!;
		return { kind: 'ploy', def, name: def.name, cost: def.cost };
	}
	const have = new Set([...run.relics.map((r) => r.key), ...(run.shop?.items ?? []).filter((i) => i.kind === 'relic').map((i) => i.def.key)]);
	let r = run.rng.next(),
		rarity = 1;
	for (let k = 1; k < RARITY_ODDS.length; k++) {
		if (r < RARITY_ODDS[k]) {
			rarity = k;
			break;
		}
		r -= RARITY_ODDS[k];
	}
	const pool = m.relics.filter((d) => d.rarity === rarity && !have.has(d.key));
	const def = run.rng.pick(pool.length ? pool : m.relics.filter((d) => !have.has(d.key)))!;
	return { kind: 'relic', def, name: def.name, cost: def.cost };
}

export function canBuy(run: Run, i: number): [boolean, string?] {
	const it = run.shop?.items[i];
	if (!it || it.sold) return [false, 'sold'];
	if (run.money < it.cost) return [false, 'too expensive'];
	if (it.kind === 'relic' && run.relics.length >= RELIC_SLOTS) return [false, 'no relic slot'];
	if (it.kind === 'ploy' && run.ploys.length >= PLOY_SLOTS) return [false, 'no ploy slot'];
	return [true];
}

export function buy(run: Run, i: number): [boolean, string?] {
	const ok = canBuy(run, i);
	if (!ok[0]) return ok;
	const it = run.shop!.items[i];
	run.money -= it.cost;
	it.sold = true;
	if (it.kind === 'relic') run.relics.push({ key: it.def.key, def: it.def, name: it.def.name, cost: it.cost, state: {} });
	else if (it.kind === 'upgrade') run.levels[it.def.key] = (run.levels[it.def.key] ?? 1) + 1;
	else run.ploys.push(it.def.key);
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
	if (run.money < run.rerollCost) return false;
	run.money -= run.rerollCost;
	run.rerollCost++;
	run.shop!.items = Array.from({ length: SHOP_SIZE }, () => rollItem(run));
	return true;
}

export function leaveShop(run: Run) {
	assert(run.phase === PHASE.SHOP, 'leaveShop: not in the club');
	run.shop = null;
	if (run.board === run.module.boardsPerTable) {
		run.table++;
		run.board = 1;
		run.boardsWonThisTable = 0;
	} else run.board++;
	startBoard(run);
}

// ------------------------------------------------------------------ ploys

export function canUsePloy(run: Run, slot: number): [boolean, string?] {
	const key = run.ploys[slot];
	const def = key ? ployDef(run, key) : undefined;
	if (!def) return [false, 'no ploy there'];
	if (!def.when.includes(run.phase)) return [false, 'not now'];
	return def.canUse?.(run) ?? [true];
}

export function usePloy(run: Run, slot: number): [boolean, string?] {
	const ok = canUsePloy(run, slot);
	if (!ok[0]) return ok;
	const def = ployDef(run, run.ploys[slot])!;
	run.ploys.splice(slot, 1);
	def.use(run);
	run.stats.ploysUsed++;
	afterGameStep(run);
	return [true];
}
