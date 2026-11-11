// Hearts, as in Shoot the Moon: pass three, play the hand out against three
// AI opponents, and score the points you dodged (or 78 for the moon).
// 8 tables x 3 boards x 3 hands.
//
// A prototype port: the rules, AI, upgrades and the relics that only score.
// Relics that change the rules (Half Moon, Wildcard...), bosses, seals and
// card editions stay in the full game until the kit grows hooks for them.

import * as cards from '../../src/core/rules/cards.ts';
import * as H from './rules/hearts.ts';
import * as ai from './rules/ai.ts';
import * as relicsLib from './relics.ts';
import * as R from '../../src/run/run.ts';
import type { Card, Hands } from '../../src/core/rules/cards.ts';
import type { HandState, PassDir } from './rules/hearts.ts';
import type { GameModule, RelicDef, Run, UpgradeDef, Line } from '../../src/run/run.ts';

export interface HeartsHand {
	dealt: Hands;
	passDir: PassDir;
	passed: Card[];
	received: Card[];
	state: HandState | null;
}

export type HeartsAction = { t: 'pass'; cards: string[] } | { t: 'play'; card: string } | { t: 'playOut' };

const TABLE_BASE = [25, 60, 123, 213, 357, 578, 950, 1528];
const BOARD_SCALE = [1, 1.4, 1.9];
const CLEAN_BONUS = 10;

const round5 = (n: number) => (n < 100 ? Math.round(n / 5) * 5 : Math.round(n / 10) * 10);
const findCard = (hand: Card[], code: string) => hand.find((c) => cards.code(c) === code);

function aiCtx(run: Run, rng = run.rng): ai.AIContext {
	return { rng, skill: 0.85 + 0.015 * run.table, plausible: true };
}

function advanceAI(run: Run<HeartsHand>) {
	const st = run.hand.state!;
	let guard = 0;
	while (!st.complete && st.turn !== H.PLAYER) {
		if (++guard > 200) throw new Error('hearts: AI stuck');
		H.play(st, st.turn, ai.chooseCard(st, st.turn, aiCtx(run)));
	}
}

function beginPlay(run: Run<HeartsHand>, stepwise = false) {
	const h = run.hand;
	h.state = H.newHand(h.dealt);
	const seats = [1, 2, 4].filter((s) => ai.moonWorthy(h.state!.hands[s]) && run.rng.chance(0.7));
	if (seats.length) h.state.moonSeats = seats;
	run.phase = R.PHASE.PLAY;
	if (!stepwise) advanceAI(run);
}

function scoreCtx(run: Run<HeartsHand>): relicsLib.ScoreCtx {
	const h = run.hand;
	const st = h.state!;
	const pts = H.pointsTaken(st);
	const mine = st.taken[H.PLAYER];
	const afterPass = st.played.filter((p) => p.seat === H.PLAYER).map((p) => p.card);
	return {
		myPoints: pts[H.PLAYER],
		heartsTaken: mine.filter((c) => c.suit === H.HEARTS).length,
		tookQueen: mine.some(H.isQueenOfSpades),
		shooter: H.moonShooter(st),
		myTricks: st.tricks.filter((t) => t.winner === H.PLAYER),
		tricksLed: st.tricks.filter((t) => t.leader === H.PLAYER).length,
		tricks: st.tricks,
		passDir: h.passDir,
		passed: h.passed,
		received: h.received,
		heldQueen: afterPass.some(H.isQueenOfSpades),
		dumpedQueen: st.tricks.some((t) => t.winner !== H.PLAYER && t.plays.some((p) => p.seat === H.PLAYER && H.isQueenOfSpades(p.card))),
		voidsAfterPass: [1, 2, 3, 4].filter((s) => !afterPass.some((c) => c.suit === s)).length,
		tookJackOfDiamonds: mine.some((c) => c.suit === H.DIAMONDS && c.rank === 11),
		boardsWonThisTable: run.boardsWonThisTable,
		moonsThisRun: run.ext.moons ?? 0,
		taken: mine.slice(),
		pts: st.pts,
		firstHandOfBoard: run.handsLeft === run.module.handsPerBoard,
		lastHandOfBoard: run.handsLeft === 1,
		behindGoal: run.score < run.target,
		bossBoard: false,
		cardsBurned: 0,
		sealedTaken: 0,
		editionCount: 0,
		passedPointsAway: h.passed.filter((c) => st.pts(c) > 0 && [1, 2, 4].some((s) => st.taken[s].includes(c))).length,
		opponentVoids: [1, 2, 4].reduce((n, s) => n + Object.values(st.voids[s]).filter(Boolean).length, 0),
		balance: 4,
		relicCount: run.relics.length,
		commonRelics: run.relics.filter((r) => r.def.rarity === 1).length,
		editionsPlayed: 0
	};
}

// Relics that only add to the score; the rule-changers wait for kit hooks.
const RULE_FLAGS = ['halfMoon', 'moonX', 'baseX', 'moonlighter', 'shadowMoon', 'fixer', 'wildcard', 'cardCounter', 'extraSlot', 'seeDeck', 'interestCap', 'bargain'] as const;
const RELICS: RelicDef<relicsLib.ScoreCtx>[] = relicsLib.DEFS.filter((d) => (d.score || d.onHandEnd || d.onBoardWin) && !RULE_FLAGS.some((f) => d[f])).map((d) => ({
	key: d.key,
	name: d.name,
	rarity: d.rarity,
	cost: relicsLib.costAt(d, 4),
	icon: d.icon,
	text: relicsLib.textAt(d, 4),
	describe: d.describe ? (r) => d.describe!(r as never, 4) : undefined,
	score: d.score ? (ctx, r) => d.score!(ctx, r as never) : undefined,
	onHandEnd: d.onHandEnd ? (ctx, r) => void d.onHandEnd!(ctx, r as never) : undefined,
	onBoardWin: d.onBoardWin ? (r) => d.onBoardWin!(r as never, { boss: false, seals: 0, balance: 4 }) ?? undefined : undefined
}));

const UPGRADES: UpgradeDef[] = [
	{ key: 'dodge', name: 'The Dodge', icon: 'psych', text: 'Level up every hand, the moon included', chips: 6, mult: 0.4 },
	{ key: 'clean', name: 'Clean Sheet', icon: 'safety_play', text: 'Level up hands where you take no points, and the moon', chips: 12, mult: 0.6 },
	{ key: 'moon', name: 'Moonshot', icon: 'phantom_trick', text: 'Level up shooting the moon', chips: 40, mult: 1 }
];

export const hearts: GameModule<HeartsHand, HeartsAction, relicsLib.ScoreCtx> = {
	id: 'hearts',
	title: 'Shoot the Moon',
	tagline: 'a hearts roguelike',
	words: { table: 'Table', hand: 'hand', hands: 'hands', chips: 'chips', pre: 'Pass' },
	tables: 8,
	boardsPerTable: 3,
	handsPerBoard: 3,
	startMoney: 6,
	goal: (table, board) => round5(TABLE_BASE[Math.min(table, 8) - 1] * BOARD_SCALE[board - 1]),
	boardName: (run) => (run.board === 3 ? 'High Board' : `Board ${run.board}`),
	deal(run) {
		const deck = cards.newDeck().map((c, i) => ({ ...c, id: i + 1 }));
		const { hands } = H.dealPack(run.rng, deck);
		const n = run.ext.handCount ?? 0;
		run.ext.handCount = n + 1;
		const passDir = H.PASS_ROTATION[n % H.PASS_ROTATION.length];
		run.hand = { dealt: hands, passDir, passed: [], received: [], state: null };
		if (passDir === 'hold') {
			beginPlay(run);
			return { hand: run.hand, phase: 'play' };
		}
		return { hand: run.hand, phase: 'pre' };
	},
	act(run, a, opts) {
		const h = run.hand;
		const stepwise = !!opts?.stepwise;
		if (a.t === 'pass') {
			if (run.phase !== R.PHASE.PRE) throw new Error('hearts: not passing');
			const mine = h.dealt[H.PLAYER];
			const chosen = a.cards.map((code) => findCard(mine, code));
			if (chosen.length !== 3 || chosen.some((c) => !c)) throw new Error('hearts: pass three of your cards');
			const passes: Card[][] = [[], [], [], [], []];
			for (let s = 1; s <= 4; s++) passes[s] = s === H.PLAYER ? (chosen as Card[]) : ai.choosePassPlausible(h.dealt[s], run.rng);
			const received = H.applyPasses(h.dealt, passes, h.passDir);
			h.passed = chosen as Card[];
			h.received = received[H.PLAYER];
			beginPlay(run, stepwise);
		} else if (a.t === 'play') {
			const st = h.state!;
			if (st.turn !== H.PLAYER) throw new Error('hearts: not your turn');
			const card = findCard(st.hands[H.PLAYER], a.card);
			if (!card || !H.isLegal(st, H.PLAYER, card)) throw new Error('hearts: illegal card');
			H.play(st, H.PLAYER, card);
			if (!stepwise) advanceAI(run);
		} else {
			ai.playOut(h.state!, aiCtx(run));
		}
	},
	handOver: (run) => !!run.hand.state?.complete,
	aiToMove: (run) => !!run.hand.state && !run.hand.state.complete && run.hand.state.turn !== H.PLAYER,
	stepAI(run) {
		const st = run.hand.state!;
		return H.play(st, st.turn, ai.chooseCard(st, st.turn, aiCtx(run))) ? 'trick' : 'card';
	},
	score(run) {
		const ctx = scoreCtx(run);
		const lines: Line[] = [];
		const levels: string[] = [];
		let title: string;
		if (ctx.shooter === H.PLAYER) {
			run.ext.moons = (run.ext.moons ?? 0) + 1;
			title = 'You shot the moon!';
			lines.push({ label: 'Shot the moon!', chips: 3 * H.TOTAL_POINTS });
			lines.push({ label: 'The moon', xmult: 2 });
			levels.push('moon', 'dodge', 'clean');
		} else if (ctx.shooter !== null) {
			title = `${H.SEAT_NAMES[ctx.shooter]} shot the moon`;
			lines.push({ label: title, chips: 0 });
			levels.push('dodge');
		} else {
			const dodged = Math.max(0, H.TOTAL_POINTS - ctx.myPoints);
			title = ctx.myPoints === 0 ? 'Clean hand!' : `You took ${ctx.myPoints} point${ctx.myPoints === 1 ? '' : 's'}`;
			lines.push({ label: ctx.myPoints ? `26 less ${ctx.myPoints} point${ctx.myPoints === 1 ? '' : 's'} taken` : 'Dodged every point', chips: dodged });
			levels.push('dodge');
			if (ctx.myPoints === 0) {
				lines.push({ label: 'Clean hand', chips: CLEAN_BONUS });
				levels.push('clean');
			}
		}
		return { title, made: true, lines, ctx, levels, detail: { points: H.pointsTaken(run.hand.state!), shooter: ctx.shooter } };
	},
	relics: RELICS,
	upgrades: UPGRADES,
	ploys: [
		{
			key: 'stand_pat', name: 'Stand Pat', text: 'Nobody passes this hand: keep the cards you were dealt', cost: 3, icon: 'ploy_stand_pat',
			when: [R.PHASE.PRE],
			use: (run) => {
				run.hand.passDir = 'hold';
				beginPlay(run);
			}
		}
	],
	bot(run, rng) {
		const h = run.hand;
		if (run.phase === R.PHASE.PRE) return { t: 'pass', cards: ai.choosePass(h.dealt[H.PLAYER], rng).map(cards.code) };
		const st = h.state!;
		return { t: 'play', card: cards.code(ai.chooseCard(st, H.PLAYER, { ...aiCtx(run, rng), plausible: false, skill: 1 })) };
	}
};
