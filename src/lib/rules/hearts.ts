// The rules of Hearts: passing, legal plays, tricks and points.
//
// Four players, no partners. You sit South. Each hand: everyone passes three
// cards (left, right, across, or not at all, in rotation), the holder of the
// two of clubs leads, players follow suit if they can, and the highest card
// of the led suit wins the trick. Every heart taken costs a point and the
// queen of spades costs thirteen, unless one player takes all 26 points:
// shooting the moon.
//
// Standard rules: no points on the first trick unless a hand holds nothing
// else, and hearts can't be led until one has been played (or the leader
// holds only hearts).

import * as cards from './cards.ts';
import type { Card, Hand, Hands } from './cards.ts';

export const { CLUBS, DIAMONDS, HEARTS, SPADES, NORTH, EAST, SOUTH, WEST } = cards;

/** Seat names for Hearts (no dummy, no partners). You are South. */
export const SEAT_NAMES: Record<number, string> = { 1: 'North', 2: 'East', 3: 'South', 4: 'West' };
export const PLAYER = cards.SOUTH;

export const TOTAL_POINTS = 26;

export type PassDir = 'left' | 'right' | 'across' | 'hold';
export const PASS_ROTATION: PassDir[] = ['left', 'right', 'across', 'hold'];

export function isQueenOfSpades(c: Card): boolean {
	return c.suit === SPADES && c.rank === 12;
}

/** Penalty points a card carries. */
export function points(c: Card): number {
	if (c.suit === HEARTS) return 1;
	if (isQueenOfSpades(c)) return 13;
	return 0;
}

export function pointsIn(list: Card[]): number {
	let n = 0;
	for (const c of list) n += points(c);
	return n;
}

/** Who receives a seat's passed cards. Seats run clockwise N, E, S, W. */
export function passTarget(seat: number, dir: PassDir): number {
	if (dir === 'left') return cards.nextSeat(seat);
	if (dir === 'across') return cards.partner(seat);
	if (dir === 'right') return cards.nextSeat(cards.nextSeat(cards.nextSeat(seat)));
	return seat;
}

/**
 * Exchange the passed cards. `passes[seat]` is the three cards that seat
 * gives away. Returns, for each seat, the cards it received.
 */
export function applyPasses(hands: Hands, passes: Card[][], dir: PassDir): Card[][] {
	const received: Card[][] = [[], [], [], [], []];
	if (dir === 'hold') return received;
	for (let seat = 1; seat <= 4; seat++) {
		for (const c of passes[seat]) {
			if (!cards.removeCard(hands[seat], c)) throw new Error('pass: card not in hand');
		}
	}
	for (let seat = 1; seat <= 4; seat++) {
		const to = passTarget(seat, dir);
		for (const c of passes[seat]) {
			hands[to].push(c);
			received[to].push(c);
		}
	}
	for (let seat = 1; seat <= 4; seat++) cards.sortHand(hands[seat]);
	return received;
}

export interface Played {
	seat: number;
	card: Card;
}

export interface Trick {
	index: number;
	leader: number;
	ledSuit: number;
	plays: Played[];
	winner: number;
	winningCard: Card;
	points: number;
}

export interface HandState {
	hands: Hands;
	turn: number;
	leader: number;
	trick: Played[];
	ledSuit: number | null;
	tricks: Trick[];
	heartsBroken: boolean;
	/** Cards each seat has won. */
	taken: Card[][];
	/** Revealed voids, per seat then suit, for the AI. */
	voids: Record<number, boolean>[];
	played: Played[];
	complete: boolean;
}

/** Seat holding the two of clubs. */
export function twoOfClubsSeat(hands: Hands): number {
	for (let seat = 1; seat <= 4; seat++) {
		if (hands[seat].some((c) => c.suit === CLUBS && c.rank === 2)) return seat;
	}
	throw new Error('no two of clubs');
}

export function newHand(hands: Hands): HandState {
	const leader = twoOfClubsSeat(hands);
	return {
		hands: [[], ...[1, 2, 3, 4].map((s) => cards.copyHand(hands[s]))],
		turn: leader,
		leader,
		trick: [],
		ledSuit: null,
		tricks: [],
		heartsBroken: false,
		taken: [[], [], [], [], []],
		voids: [{}, {}, {}, {}, {}],
		played: [],
		complete: false
	};
}

/** Cards a seat may play now. */
export function legalPlays(state: HandState, seat: number): Card[] {
	const hand = state.hands[seat];
	const firstTrick = state.tricks.length === 0;
	if (state.trick.length === 0) {
		// Leading.
		if (firstTrick) {
			const two = hand.find((c) => c.suit === CLUBS && c.rank === 2);
			if (two) return [two];
		}
		if (!state.heartsBroken) {
			const nonHearts = hand.filter((c) => c.suit !== HEARTS);
			if (nonHearts.length > 0) return nonHearts;
		}
		return hand.slice();
	}
	const suited = cards.cardsOfSuit(hand, state.ledSuit!);
	if (suited.length > 0) return suited;
	if (firstTrick) {
		// No points on the first trick, unless there's nothing else to throw.
		const clean = hand.filter((c) => points(c) === 0);
		if (clean.length > 0) return clean;
	}
	return hand.slice();
}

export function isLegal(state: HandState, seat: number, card: Card): boolean {
	return legalPlays(state, seat).includes(card);
}

/** Highest card of the led suit wins; there are no trumps. */
export function trickWinner(trick: Played[]): Played {
	const led = trick[0].card.suit;
	let best = trick[0];
	for (const p of trick) if (p.card.suit === led && p.card.rank > best.card.rank) best = p;
	return best;
}

/** Play a card. Returns the completed trick when the fourth card lands. */
export function play(state: HandState, seat: number, card: Card): Trick | null {
	if (state.complete) throw new Error('play: hand is over');
	if (seat !== state.turn) throw new Error("play: not this seat's turn");
	if (!isLegal(state, seat, card)) throw new Error('play: illegal card');

	if (state.ledSuit && card.suit !== state.ledSuit) state.voids[seat][state.ledSuit] = true;
	cards.removeCard(state.hands[seat], card);
	state.trick.push({ seat, card });
	state.played.push({ seat, card });
	if (state.trick.length === 1) state.ledSuit = card.suit;
	if (card.suit === HEARTS) state.heartsBroken = true;

	if (state.trick.length < 4) {
		state.turn = cards.nextSeat(seat);
		return null;
	}
	const win = trickWinner(state.trick);
	const done: Trick = {
		index: state.tricks.length + 1,
		leader: state.leader,
		ledSuit: state.trick[0].card.suit,
		plays: state.trick,
		winner: win.seat,
		winningCard: win.card,
		points: pointsIn(state.trick.map((p) => p.card))
	};
	state.tricks.push(done);
	for (const p of state.trick) state.taken[win.seat].push(p.card);
	state.trick = [];
	state.ledSuit = null;
	state.leader = win.seat;
	state.turn = win.seat;
	if (state.tricks.length >= 13) state.complete = true;
	return done;
}

/** Points each seat took this hand (raw, before any moon rule). */
export function pointsTaken(state: HandState): number[] {
	return [0, 1, 2, 3, 4].map((s) => (s === 0 ? 0 : pointsIn(state.taken[s])));
}

/** The seat that took all 26 points, if any. */
export function moonShooter(state: HandState): number | null {
	const pts = pointsTaken(state);
	for (let s = 1; s <= 4; s++) if (pts[s] === TOTAL_POINTS) return s;
	return null;
}

/** Highest unseen rank of a suit, from one seat's view (its own hand counts as seen). */
export function highestOutstanding(state: HandState, suit: number, known: Hand): number | null {
	const seen = new Set<number>();
	for (const p of state.played) if (p.card.suit === suit) seen.add(p.card.rank);
	for (const p of state.trick) if (p.card.suit === suit) seen.add(p.card.rank);
	for (const c of known) if (c.suit === suit) seen.add(c.rank);
	for (let r = 14; r >= 2; r--) if (!seen.has(r)) return r;
	return null;
}

/** Has the queen of spades been played yet? */
export function queenGone(state: HandState): boolean {
	return state.played.some((p) => isQueenOfSpades(p.card));
}
