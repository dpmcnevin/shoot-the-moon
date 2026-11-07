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
import type { Card, Hands } from '../rules/cards.ts';
import type { HandState, PassDir, Trick } from '../rules/hearts.ts';
import type { RNG } from '../rules/rng.ts';
import type { Relic, RelicDef, ScoreCtx } from './relics.ts';

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

/** Chips for shooting the moon, before relics: three times a perfect dodge. */
export const MOON_CHIPS = 78;
/** Bonus chips for a hand where you take no points at all. */
export const CLEAN_BONUS = 10;

// Target for the first board of each table, fitted with tools/simulate.
export const TABLE_BASE = [35, 70, 130, 230, 400, 680, 1150, 1900];
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
	chips?: number;
	mult?: number;
	xmult?: number;
}

export interface Breakdown {
	lines: Line[];
	chips: number;
	mult: number;
	total: number;
	myPoints: number;
	shooter: number | null;
	points: number[];
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
}

export interface Stats {
	handsPlayed: number;
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

export function upgradeBonus(key: UpgradeKey, level: number): [number, number] {
	const extra = Math.max(0, level - 1);
	return [extra * UPGRADES[key].chips, extra * UPGRADES[key].mult];
}

export type ShopItem =
	| { kind: 'relic'; def: RelicDef; name: string; cost: number; sold?: boolean }
	| { kind: 'upgrade'; def: UpgradeDef; name: string; cost: number; sold?: boolean };

export interface Payout {
	board: number;
	unused: number;
	interest: number;
	relics: number;
	total: number;
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
}

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

function round5(n: number): number {
	if (n < 100) return Math.floor(n / 5 + 0.5) * 5;
	const mag = 10 ** Math.max(1, Math.floor(Math.log10(n)) - 1);
	return Math.floor(n / mag + 0.5) * mag;
}

export function targetFor(table: number, board: number): number {
	let base = TABLE_BASE[Math.min(table, TABLE_BASE.length) - 1];
	if (table > TABLE_BASE.length) base *= 1.6 ** (table - TABLE_BASE.length);
	return round5(base * BOARD_SCALE[board - 1]);
}

export function boardName(run: Run): string {
	return run.board === BOARDS_PER_TABLE ? 'High Board' : `Board ${run.board}`;
}

// ------------------------------------------------------------------ run

export function newRun(seed?: string | number, opts: { money?: number; aiSkill?: number } = {}): Run {
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
		boardPoints: [0, 0, 0, 0, 0]
	} as Run;
	startBoard(run);
	return run;
}

export function startBoard(run: Run) {
	run.target = targetFor(run.table, run.board);
	run.score = 0;
	run.handsLeft = HANDS_PER_BOARD;
	run.boardPoints = [0, 0, 0, 0, 0];
	startHand(run);
}

/** Deal a hand and ask for a pass (or go straight to play on a hold hand). */
export function startHand(run: Run) {
	const dealt = cards.deal(run.rng);
	const passDir = H.PASS_ROTATION[run.handCount % H.PASS_ROTATION.length];
	run.hand = { dealt, passDir, passed: [], received: [], state: null, result: null, receivedFrom: new Map() };
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
		passes[seat] = seat === H.PLAYER ? chosen : ai.choosePass(hand.dealt[seat], run.rng, run.aiSkill);
	}
	const received = H.applyPasses(hand.dealt, passes, hand.passDir);
	hand.passed = chosen.slice();
	hand.received = received[H.PLAYER];
	const from = H.passTarget(H.PLAYER, hand.passDir === 'left' ? 'right' : hand.passDir === 'right' ? 'left' : hand.passDir);
	for (const c of hand.received) hand.receivedFrom.set(c, from);
	beginPlay(run, opts);
}

function beginPlay(run: Run, opts?: { stepwise?: boolean }) {
	run.hand.state = H.newHand(run.hand.dealt);
	run.phase = PHASE.PLAY;
	if (!opts?.stepwise) advanceAI(run);
}

export function isPlayerTurn(run: Run): boolean {
	const st = run.hand?.state;
	return !!st && !st.complete && st.turn === H.PLAYER;
}

function aiCtx(run: Run): ai.AIContext {
	return { rng: run.rng, skill: run.aiSkill };
}

export function advanceAI(run: Run): Trick[] {
	const st = run.hand.state!;
	const done: Trick[] = [];
	let guard = 0;
	while (!st.complete && st.turn !== H.PLAYER) {
		assert(++guard < 60, 'advanceAI: stuck');
		const t = H.play(st, st.turn, ai.chooseCard(st, st.turn, aiCtx(run)));
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
	const card = ai.chooseCard(st, seat, aiCtx(run));
	const trick = H.play(st, seat, card);
	if (st.complete) finishHand(run);
	return { trick, seat, card };
}

/** Hand your seat to the autopilot for the rest of the hand. */
export function playOut(run: Run) {
	assert(run.phase === PHASE.PLAY, 'playOut: not in play');
	ai.playOut(run.hand.state!, aiCtx(run));
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
	if (shooter === null && heartsTaken === 13 && run.relics.some((r) => r.def.halfMoon)) shooter = H.PLAYER;
	const myTricks = st.tricks.filter((t) => t.winner === H.PLAYER);
	const myHand = hand.dealt; // after passing, before play
	void myHand;
	const afterPass = [...st.played.filter((p) => p.seat === H.PLAYER).map((p) => p.card)];
	const voids = [1, 2, 3, 4].filter((s) => !afterPass.some((c) => c.suit === s)).length;
	return {
		myPoints: pts[H.PLAYER],
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
		moonsThisRun: run.stats.moons
	};
}

/** Score the hand just played: base chips, then every relic. */
export function scoreHand(run: Run): Breakdown {
	const st = run.hand.state!;
	const ctx = scoreContext(run);
	const lines: Line[] = [];
	const baseX = run.relics.reduce((x, r) => x * (r.def.baseX ?? 1), 1);
	let chips = 0,
		mult = 1;
	if (ctx.shooter === H.PLAYER) {
		const moonX = run.relics.reduce((x, r) => x * (r.def.moonX ?? 1), 1);
		chips = MOON_CHIPS * moonX * baseX;
		lines.push({ label: 'Shot the moon!', chips });
	} else if (ctx.shooter !== null) {
		lines.push({ label: `${H.SEAT_NAMES[ctx.shooter]} shot the moon`, chips: 0 });
	} else {
		chips = (H.TOTAL_POINTS - ctx.myPoints) * baseX;
		lines.push({ label: `Dodged ${H.TOTAL_POINTS - ctx.myPoints} of 26 points`, chips });
		if (ctx.myPoints === 0) {
			chips += CLEAN_BONUS;
			lines.push({ label: 'Clean hand', chips: CLEAN_BONUS });
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
	level('moon', ctx.shooter === H.PLAYER);
	level('dodge', ctx.shooter === null);
	level('clean', ctx.shooter === null && ctx.myPoints === 0);
	for (const relic of run.relics) {
		const e = relic.def.score?.(ctx, relic);
		if (e && (e.chips || e.mult || (e.xmult && e.xmult !== 1))) {
			if (e.chips) chips += e.chips;
			if (e.mult) mult += e.mult;
			if (e.xmult) mult *= e.xmult;
			lines.push({ label: relic.name, chips: e.chips || undefined, mult: e.mult || undefined, xmult: e.xmult });
		}
	}
	const points = H.pointsTaken(st);
	return {
		lines,
		chips,
		mult,
		total: Math.max(0, Math.floor(chips * mult)),
		myPoints: ctx.myPoints,
		shooter: ctx.shooter,
		points
	};
}

export function finishHand(run: Run): Breakdown {
	const hand = run.hand;
	if (hand.result) return hand.result;
	const ctx = scoreContext(run);
	const b = scoreHand(run);
	hand.result = b;
	run.score += b.total;
	run.handsLeft--;
	run.handCount++;
	for (let s = 1; s <= 4; s++) run.boardPoints[s] += b.points[s];
	run.stats.handsPlayed++;
	run.stats.totalScore += b.total;
	run.stats.pointsTaken += b.myPoints;
	if (b.total > run.stats.bestHand) run.stats.bestHand = b.total;
	if (b.shooter === H.PLAYER) run.stats.moons++;
	if (b.myPoints === 0 && b.shooter === null) run.stats.cleanHands++;
	for (const r of run.relics) r.def.onHandEnd?.(ctx, r);
	run.log.push({ table: run.table, board: run.board, points: b.myPoints, score: b.total, moon: b.shooter === H.PLAYER });
	run.phase = PHASE.HAND_SCORED;
	return b;
}

export function continueAfterHand(run: Run): Phase {
	assert(run.phase === PHASE.HAND_SCORED, 'continueAfterHand: nothing to continue');
	if (run.score >= run.target) winBoard(run);
	else if (run.handsLeft <= 0) run.phase = PHASE.GAME_OVER;
	else startHand(run);
	return run.phase;
}

// ------------------------------------------------------------------ economy

export function interest(run: Run): number {
	return Math.min(MAX_INTEREST, Math.floor(run.money / INTEREST_PER));
}

export function winBoard(run: Run): Payout {
	let bonus = 0;
	for (const r of run.relics) {
		const out = r.def.onBoardWin?.(r);
		if (out && out.money) bonus += out.money;
	}
	const p: Payout = {
		board: MONEY_PER_BOARD,
		unused: Math.max(0, run.handsLeft) * MONEY_PER_UNUSED_HAND,
		interest: interest(run),
		relics: bonus,
		total: 0
	};
	p.total = p.board + p.unused + p.interest + p.relics;
	run.money += p.total;
	run.lastPayout = p;
	run.boardsWonThisTable++;
	run.phase = PHASE.BOARD_WON;
	return p;
}

export function enterShop(run: Run) {
	assert(run.phase === PHASE.BOARD_WON, 'enterShop: no board won');
	run.phase = PHASE.SHOP;
	run.rerollCost = BASE_REROLL_COST;
	run.shop = { items: [] };
	for (let i = 0; i < SHOP_SIZE; i++) run.shop.items[i] = rollShopItem(run);
}

export function rollShopItem(run: Run): ShopItem {
	if (run.rng.next() < 0.3) {
		const r = run.rng.next();
		const key: UpgradeKey = r < 0.6 ? 'dodge' : r < 0.85 ? 'clean' : 'moon';
		const def = UPGRADES[key];
		return { kind: 'upgrade', def, name: def.name, cost: 4 + run.levels[key] };
	}
	const owned = [
		...run.relics,
		...(run.shop?.items ?? []).filter((i) => i && i.kind === 'relic').map((i) => ({ key: i.def.key }))
	];
	const def = relics.randomUnowned(run.rng, owned) ?? relics.DEFS[0];
	return { kind: 'relic', def, name: def.name, cost: def.cost };
}

export function canBuy(run: Run, i: number): [boolean, string?] {
	const item = run.shop?.items[i];
	if (!item || item.sold) return [false, 'gone'];
	if (run.money < item.cost) return [false, 'too expensive'];
	if (item.kind === 'relic' && run.relics.length >= RELIC_SLOTS) return [false, 'no relic slots'];
	return [true];
}

export function buy(run: Run, i: number): [boolean, string?] {
	const check = canBuy(run, i);
	if (!check[0]) return check;
	const item = run.shop!.items[i];
	run.money -= item.cost;
	if (item.kind === 'relic') run.relics.push(relics.instantiate(item.def));
	else run.levels[item.def.key]++;
	item.sold = true;
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
	run.shop!.items = [];
	for (let i = 0; i < SHOP_SIZE; i++) run.shop!.items[i] = rollShopItem(run);
	return true;
}

export function leaveShop(run: Run): Phase {
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
