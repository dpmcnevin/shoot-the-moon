// The run engine, scoring, relics, upgrades and auto-save.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as cards from '../src/lib/rules/cards.ts';
import * as H from '../src/lib/rules/hearts.ts';
import * as ai from '../src/lib/rules/ai.ts';
import * as R from '../src/lib/game/run.ts';
import * as relics from '../src/lib/game/relics.ts';
import { applyAction, replay } from '../src/lib/app/save.ts';
import { newRng } from '../src/lib/rules/rng.ts';
import { playRun } from '../tools/bot.ts';

/** Play the current hand to the end by autopilot. */
function finish(run) {
	if (run.phase === R.PHASE.PASS) R.commitPass(run, ai.choosePass(run.hand.dealt[H.PLAYER], run.rng));
	if (run.phase === R.PHASE.PLAY) R.playOut(run);
	return run.hand.result;
}

test('a hand scores 26 minus your points, plus a clean bonus', () => {
	for (let i = 0; i < 40; i++) {
		const run = R.newRun('SCORE' + i);
		const b = finish(run);
		if (b.shooter === null) {
			const expect = 26 - b.myPoints + (b.myPoints === 0 ? R.CLEAN_BONUS : 0);
			assert.equal(b.total, expect);
		} else if (b.shooter === H.PLAYER) assert.equal(b.total, R.MOON_CHIPS);
		else assert.equal(b.total, 0);
		assert.equal(run.score, b.total);
		assert.equal(run.handsLeft, R.HANDS_PER_BOARD - 1);
	}
});

test('passes rotate left, right, across, hold', () => {
	const run = R.newRun('ROT');
	run.target = 1e9; // stay on this board
	run.handsLeft = 99;
	const dirs = [];
	for (let k = 0; k < 4; k++) {
		dirs.push(run.hand.passDir);
		finish(run);
		R.continueAfterHand(run);
		if (run.phase !== R.PHASE.PASS && run.phase !== R.PHASE.PLAY) break;
	}
	assert.deepEqual(dirs.slice(0, 3), ['left', 'right', 'across']);
});

test('your pass goes to the right seat and you receive three cards', () => {
	const run = R.newRun('PASSING');
	const mine = run.hand.dealt[H.PLAYER];
	const give = mine.slice(0, 3);
	R.commitPass(run, give, { stepwise: true });
	const west = run.hand.state.hands[cards.WEST];
	for (const c of give) assert.ok(west.includes(c), 'left pass goes to West');
	assert.equal(run.hand.received.length, 3);
	assert.equal(run.hand.state.hands[H.PLAYER].length, 13);
});

test('relics add chips and multiply', () => {
	const run = R.newRun('RELICS');
	run.relics.push(relics.instantiate(relics.get('house_rules')));
	run.relics.push(relics.instantiate(relics.get('full_moon')));
	const b = finish(run);
	if (b.shooter === null) {
		const base = (26 - b.myPoints) * 2 + (b.myPoints === 0 ? R.CLEAN_BONUS : 0);
		assert.equal(b.total, Math.floor(base * 1.5));
	}
});

test('upgrades add chips and mult to their kind of hand', () => {
	const run = R.newRun('UPGRADE');
	run.levels.dodge = 3;
	const b = finish(run);
	if (b.shooter === null) {
		const base = 26 - b.myPoints + (b.myPoints === 0 ? R.CLEAN_BONUS : 0) + 12;
		assert.equal(b.total, Math.floor(base * 1.8));
	}
});

test('the club: buy, slots, sell, reroll', () => {
	const run = R.newRun('CLUB');
	run.phase = R.PHASE.BOARD_WON;
	run.money = 100;
	R.enterShop(run);
	assert.equal(run.shop.items.length, R.SHOP_SIZE);
	const before = run.money;
	assert.ok(R.buy(run, 0)[0]);
	assert.equal(run.money, before - run.shop.items[0].cost);
	assert.equal(R.buy(run, 0)[0], false);
	const cost = run.rerollCost;
	assert.ok(R.reroll(run));
	assert.equal(run.rerollCost, cost + 1);
	const keys = run.shop.items.filter((i) => i.kind === 'relic').map((i) => i.def.key);
	assert.equal(new Set(keys).size, keys.length, 'no duplicate relics on offer');
});

test('whole bot runs end, and a seed replays identically', () => {
	for (let i = 1; i <= 40; i++) {
		const run = playRun('WHOLE' + i);
		assert.ok(run.phase === R.PHASE.VICTORY || run.phase === R.PHASE.GAME_OVER);
		assert.ok(run.money >= 0 && run.relics.length <= R.RELIC_SLOTS);
	}
	const a = playRun('SAME'),
		b = playRun('SAME');
	assert.deepEqual(a.log, b.log);
});

test('a save replays to the same run', () => {
	const run = R.newRun('SAVEME');
	const me = newRng('chooser');
	const actions = [];
	const act = (a) => {
		actions.push(a);
		return applyAction(run, a);
	};
	for (let k = 0; k < 600; k++) {
		if (run.phase === R.PHASE.PASS) act({ t: 'pass', cards: me.sample(run.hand.dealt[H.PLAYER], 3).map(cards.code) });
		else if (run.phase === R.PHASE.PLAY) {
			if (R.isPlayerTurn(run)) act({ t: 'play', card: cards.code(me.pick(H.legalPlays(run.hand.state, H.PLAYER))) });
			else act({ t: 'ai' });
		} else if (run.phase === R.PHASE.HAND_SCORED) act({ t: 'continue' });
		else if (run.phase === R.PHASE.BOARD_WON) {
			act({ t: 'shop' });
			if (R.canBuy(run, 0)[0]) act({ t: 'buy', slot: 0 });
			act({ t: 'leave' });
		} else break;
	}
	const copy = replay({ version: 1, seed: 'SAVEME', actions: JSON.parse(JSON.stringify(actions)) });
	assert.deepEqual(copy.log, run.log);
	assert.equal(copy.phase, run.phase);
	assert.equal(copy.money, run.money);
	assert.equal(copy.rng.state, run.rng.state);
});

// ------------------------------------------------------------------ seals

import * as seals from '../src/lib/game/seals.ts';

test('Ward and Thorn change the points a card carries', () => {
	const qs = cards.card(cards.SPADES, 12), h5 = cards.card(cards.HEARTS, 5), c3 = cards.card(cards.CLUBS, 3);
	const map = { QS: 'ward', '3C': 'thorn' };
	assert.equal(seals.cardPoints(map, qs), 0);
	assert.equal(seals.cardPoints(map, h5), 1);
	assert.equal(seals.cardPoints(map, c3), 3);
});

test('Homing cards are always dealt to you', () => {
	for (let i = 0; i < 30; i++) {
		const run = R.newRun('HOME' + i);
		run.seals = { QS: 'homing', '2C': 'homing' };
		R.startHand(run);
		const mine = run.hand.dealt[H.PLAYER].map(cards.code);
		assert.ok(mine.includes('QS') && mine.includes('2C'), mine.join(' '));
		for (let s = 1; s <= 4; s++) assert.equal(run.hand.dealt[s].length, 13);
	}
});

test('Gilded pays money and Crown adds mult when you win with them', () => {
	let paid = 0, crowned = 0;
	for (let i = 0; i < 60; i++) {
		const run = R.newRun('GILD' + i);
		run.seals = {};
		for (const c of cards.newDeck()) if (c.suit === cards.CLUBS) run.seals[cards.code(c)] = i % 2 ? 'gilded' : 'crown';
		const before = run.money;
		const b = finish(run);
		const mine = run.hand.state.tricks.filter((t) => t.winner === H.PLAYER);
		if (i % 2) {
			const expect = 2 * mine.reduce((n, t) => n + t.plays.filter((p) => p.card.suit === cards.CLUBS).length, 0);
			assert.equal(run.money - before, expect);
			paid += expect;
		} else {
			const expect = mine.filter((t) => t.winningCard.suit === cards.CLUBS).length;
			assert.equal(b.lines.filter((l) => l.mult === 0.5).length, expect);
			crowned += expect;
		}
	}
	assert.ok(paid > 0 && crowned > 0);
});

test('buying a seal puts it on the chosen card', () => {
	const run = R.newRun('SEALBUY');
	run.phase = R.PHASE.BOARD_WON;
	run.money = 100;
	R.enterShop(run);
	run.shop.items[0] = { kind: 'seal', def: seals.SEALS.ward, name: 'Ward Seal', cost: 6 };
	assert.deepEqual(R.buy(run, 0), [false, 'choose a card for the seal']);
	assert.ok(R.buy(run, 0, 'QS')[0]);
	assert.equal(run.seals.QS, 'ward');
	assert.equal(run.money, 94);
});
