// The rules of Hearts, and AI-played hands for sanity.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as cards from '../src/rules/cards.ts';
import * as H from '../src/rules/hearts.ts';
import * as ai from '../src/rules/ai.ts';
import { newRng } from '../src/rules/rng.ts';

const { CLUBS: C, DIAMONDS: D, HEARTS: Hs, SPADES: S } = cards;
const card = cards.card;

test('points: one per heart, thirteen for the queen of spades', () => {
	assert.equal(H.points(card(Hs, 2)), 1);
	assert.equal(H.points(card(S, 12)), 13);
	assert.equal(H.points(card(S, 13)), 0);
	assert.equal(H.pointsIn(cards.newDeck()), 26);
});

test('passing goes left, right and across', () => {
	assert.equal(H.passTarget(cards.SOUTH, 'left'), cards.WEST);
	assert.equal(H.passTarget(cards.SOUTH, 'right'), cards.EAST);
	assert.equal(H.passTarget(cards.SOUTH, 'across'), cards.NORTH);
	const hands = cards.deal(newRng('PASS'));
	const passes = [[], ...[1, 2, 3, 4].map((s) => hands[s].slice(0, 3))];
	const southGave = passes[cards.SOUTH];
	const got = H.applyPasses(hands, passes, 'left');
	assert.deepEqual(got[cards.WEST].map(cards.code).sort(), southGave.map(cards.code).sort());
	for (let s = 1; s <= 4; s++) assert.equal(hands[s].length, 13);
});

test('first lead is the two of clubs; no points on the first trick', () => {
	const hands = [[], [card(C, 2), card(Hs, 5)], [card(C, 9), card(S, 12)], [card(D, 3), card(Hs, 9)], [card(C, 5), card(D, 4)]];
	const st = H.newHand(hands);
	assert.equal(st.turn, 1);
	assert.deepEqual(H.legalPlays(st, 1).map(cards.code), ['2C']);
	H.play(st, 1, st.hands[1][0]);
	H.play(st, 2, st.hands[2][0]); // 9C follows
	// South is void in clubs: may discard, but not the heart (points) when the diamond is there.
	assert.deepEqual(H.legalPlays(st, 3).map(cards.code), ['3D']);
});

test("hearts can't be led until broken", () => {
	const hands = [[], [card(C, 2), card(Hs, 5), card(D, 9)], [card(C, 9), card(Hs, 2), card(D, 2)], [card(C, 3), card(Hs, 9), card(D, 5)], [card(C, 5), card(Hs, 4), card(D, 4)]];
	const st = H.newHand(hands);
	for (const s of [1, 2, 3, 4]) H.play(st, s, H.legalPlays(st, s)[0]);
	// North's 2C lost to East's 9C; East leads and may not lead a heart.
	assert.equal(st.turn, 2);
	assert.ok(H.legalPlays(st, 2).every((c) => c.suit !== Hs));
});

test('AI plays a thousand legal hands; points always total 26', () => {
	let moons = 0;
	const byseat = [0, 0, 0, 0, 0];
	for (let i = 0; i < 1000; i++) {
		const rng = newRng('AIHAND' + i);
		const hands = cards.deal(rng);
		const passes = [[], ...[1, 2, 3, 4].map((s) => ai.choosePass(hands[s], rng))];
		H.applyPasses(hands, passes, H.PASS_ROTATION[i % 4]);
		const st = H.newHand(hands);
		ai.playOut(st, { rng });
		const pts = H.pointsTaken(st);
		assert.equal(pts.reduce((a, b) => a + b, 0), 26);
		assert.equal(st.tricks.length, 13);
		if (H.moonShooter(st)) moons++;
		for (let s = 1; s <= 4; s++) byseat[s] += pts[s];
	}
	// Symmetric players should split the points roughly evenly.
	for (let s = 1; s <= 4; s++) assert.ok(byseat[s] / 1000 > 4 && byseat[s] / 1000 < 9, `seat ${s}: ${byseat[s] / 1000}`);
	assert.ok(moons < 60, `moons ${moons}`);
});
