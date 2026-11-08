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
		if (run.phase === R.PHASE.PASS) act({ t: 'pass', cards: me.sample(run.hand.dealt[H.PLAYER], 3).map((c) => c.id) });
		else if (run.phase === R.PHASE.PLAY) {
			if (R.isPlayerTurn(run)) act({ t: 'play', card: me.pick(H.legalPlays(run.hand.state, H.PLAYER)).id });
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
		const idOf = (code) => String(run.pack.find((c) => cards.code(c) === code).id);
		run.seals = { [idOf('QS')]: 'homing', [idOf('2C')]: 'homing' };
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
		for (const c of run.pack) if (c.suit === cards.CLUBS) run.seals[String(c.id)] = i % 2 ? 'gilded' : 'crown';
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
	const qs = run.pack.find((c) => cards.code(c) === 'QS');
	assert.ok(R.buy(run, 0, qs.id)[0]);
	assert.equal(run.seals[String(qs.id)], 'ward');
	assert.equal(run.money, 94);
});

// ------------------------------------------------------------------ the pack

import * as packs from '../src/lib/game/pack.ts';

function shopWith(run, def) {
	run.phase = R.PHASE.BOARD_WON;
	run.money = 100;
	R.enterShop(run);
	run.shop.items[0] = { kind: 'pack', def, name: def.name, cost: def.cost };
}

test('Burn removes a card; odd packs leave a kitty for the first trick', () => {
	const run = R.newRun('BURN');
	const qs = run.pack.find((c) => cards.code(c) === 'QS');
	shopWith(run, packs.OPS.burn);
	assert.ok(R.buy(run, 0, qs.id)[0]);
	assert.equal(run.pack.length, 51);
	assert.ok(!run.pack.some((c) => cards.code(c) === 'QS'));
	R.leaveShop(run);
	assert.equal(run.hand.kitty.length, 3, '51 cards: 12 each, 3 in the kitty');
	for (let s = 1; s <= 4; s++) assert.equal(run.hand.dealt[s].length, 12);
	finish(run);
	const st = run.hand.state;
	assert.equal(st.tricks.length, 12);
	assert.equal(st.totalPoints, 13, 'no queen: only the hearts carry points');
	const first = st.tricks[0];
	for (const c of st.kitty) assert.ok(st.taken[first.winner].includes(c), 'the kitty goes with the first trick');
	const pts = H.pointsTaken(st);
	assert.equal(pts.reduce((a, b) => a + b, 0), 13);
});

test('Copy makes duplicates that play and score correctly', () => {
	const run = R.newRun('COPY');
	const qs = run.pack.find((c) => cards.code(c) === 'QS');
	for (let k = 0; k < 4; k++) {
		shopWith(run, packs.OPS.copy);
		assert.ok(R.buy(run, 0, qs.id)[0]);
	}
	assert.equal(run.pack.filter((c) => cards.code(c) === 'QS').length, 5);
	assert.equal(run.pack.length, 56);
	R.leaveShop(run);
	for (let s = 1; s <= 4; s++) assert.equal(run.hand.dealt[s].length, 14);
	finish(run);
	assert.equal(run.hand.state.totalPoints, 13 + 5 * 13);
	assert.equal(H.pointsTaken(run.hand.state).reduce((a, b) => a + b, 0), 78);
});

test('Recolor and Promote change cards; limits are enforced', () => {
	const run = R.newRun('RECOLOR');
	const ah = run.pack.find((c) => cards.code(c) === 'AH');
	shopWith(run, packs.recolorDef(cards.CLUBS));
	assert.ok(R.buy(run, 0, ah.id)[0]);
	assert.equal(cards.code(run.pack.find((c) => c.id === ah.id)), 'AC');
	const two = run.pack.find((c) => cards.code(c) === '2C');
	shopWith(run, packs.OPS.promote);
	assert.ok(R.buy(run, 0, two.id)[0]);
	assert.equal(run.pack.filter((c) => cards.code(c) === '3C').length, 2);
	const ace = run.pack.find((c) => c.rank === 14);
	shopWith(run, packs.OPS.promote);
	assert.equal(R.buy(run, 0, ace.id)[0], false, "an ace can't be promoted");
	R.leaveShop(run);
	finish(run);
	assert.equal(run.hand.state.totalPoints, 25);
});

test('with no two of clubs, the lowest club leads', () => {
	const run = R.newRun('NOTWO');
	const two = run.pack.find((c) => cards.code(c) === '2C');
	shopWith(run, packs.OPS.burn);
	assert.ok(R.buy(run, 0, two.id)[0]);
	R.leaveShop(run);
	if (run.phase === R.PHASE.PASS) R.commitPass(run, run.hand.dealt[H.PLAYER].slice(0, 3), { stepwise: true });
	assert.equal(cards.code(run.hand.state.firstLead), '3C');
});

test('the pack stays between 36 and 64 cards', () => {
	const run = { pack: packs.standardPack().slice(0, 36), nextCardId: 99, seals: {} };
	assert.equal(packs.canApply(run, packs.OPS.burn, run.pack[0])[0], false);
	const big = { pack: Array.from({ length: 64 }, (_, i) => ({ suit: 1, rank: 2, id: i })), nextCardId: 99, seals: {} };
	assert.equal(packs.canApply(big, packs.OPS.copy, big.pack[0])[0], false);
});

test('taking the queen of spades breaks hearts', () => {
	const hands = [[], [cards.card(cards.SPADES, 3), cards.card(cards.CLUBS, 2), cards.card(cards.HEARTS, 2)],
		[cards.card(cards.SPADES, 12), cards.card(cards.CLUBS, 9), cards.card(cards.HEARTS, 3)],
		[cards.card(cards.SPADES, 5), cards.card(cards.CLUBS, 5), cards.card(cards.HEARTS, 4)],
		[cards.card(cards.SPADES, 14), cards.card(cards.CLUBS, 7), cards.card(cards.HEARTS, 5)]];
	const st = H.newHand(hands);
	for (const s of [1, 2, 3, 4]) H.play(st, s, H.legalPlays(st, s).find((c) => c.suit === cards.CLUBS));
	assert.equal(st.heartsBroken, false);
	// East (9C) won and leads a spade: the queen falls under the ace.
	assert.equal(st.turn, 2);
	H.play(st, 2, st.hands[2].find((c) => c.suit === cards.SPADES));
	for (const s of [3, 4, 1]) H.play(st, s, H.legalPlays(st, s).find((c) => c.suit === cards.SPADES));
	assert.equal(st.heartsBroken, true, 'hearts are broken once the queen is taken');
	assert.ok(H.legalPlays(st, 4).some((c) => c.suit === cards.HEARTS));
});

// ------------------------------------------------------------------ editions

/** Every relic offer across many fresh shops. */
function relicOffers(editions) {
	const out = [];
	for (let i = 0; i < 300; i++) {
		const run = R.newRun('ED' + i, { editions });
		run.phase = R.PHASE.BOARD_WON;
		R.enterShop(run);
		out.push(...run.shop.items.filter((it) => it.kind === 'relic'));
	}
	return out;
}

test('editions are off unless the run turns them on, and leave its shops alone', () => {
	assert.ok(relicOffers(false).every((it) => !it.edition));
	// Same seed, editions off: the same offers as a run made the old way.
	const a = R.newRun('SAME');
	const b = R.newRun('SAME', { editions: false });
	for (const r of [a, b]) {
		r.phase = R.PHASE.BOARD_WON;
		R.enterShop(r);
	}
	assert.deepEqual(a.shop.items.map((i) => i.name), b.shop.items.map((i) => i.name));
});

test('with editions on, some relic offers have one and cost more', () => {
	const offers = relicOffers(true);
	const with_ = offers.filter((it) => it.edition);
	assert.ok(with_.length > offers.length * 0.03 && with_.length < offers.length * 0.15, `${with_.length} of ${offers.length}`);
	for (const it of with_) assert.equal(it.cost, it.def.cost + relics.EDITIONS[it.edition].cost);
	assert.ok(new Set(with_.map((it) => it.edition)).size >= 3);
});

test('edition bonuses score on their own line, every hand', () => {
	const run = R.newRun('EDSCORE', { editions: true });
	run.relics.push(relics.instantiate(relics.get('house_rules'), 'etched'));
	run.relics.push(relics.instantiate(relics.get('full_moon'), 'prismatic'));
	const b = finish(run);
	const etched = b.lines.find((l) => l.edition === 'etched');
	const prism = b.lines.find((l) => l.edition === 'prismatic');
	assert.equal(etched.chips, relics.EDITIONS.etched.effect.chips);
	assert.equal(prism.xmult, relics.EDITIONS.prismatic.effect.xmult);
	assert.match(etched.label, /^Etched /);
});

test('a Phantom relic takes no relic slot', () => {
	const run = R.newRun('PHANTOM', { editions: true });
	for (const key of ['house_rules', 'full_moon', 'bleeding_heart', 'collector'])
		run.relics.push(relics.instantiate(relics.get(key)));
	run.relics.push(relics.instantiate(relics.DEFS.find((d) => !run.relics.some((r) => r.key === d.key)), 'phantom'));
	assert.equal(run.relics.length, 5);
	assert.equal(R.relicSlotsUsed(run), 4);
	// One slot is still free for an ordinary relic.
	run.phase = R.PHASE.BOARD_WON;
	R.enterShop(run);
	const def = relics.DEFS.find((d) => !run.relics.some((r) => r.key === d.key));
	run.shop.items[0] = { kind: 'relic', def, name: def.name, cost: 0 };
	assert.ok(R.buy(run, 0)[0]);
	assert.equal(R.relicSlotsUsed(run), 5);
	run.shop.items[1] = { kind: 'relic', def: relics.DEFS[0], name: 'x', cost: 0 };
	assert.equal(R.canBuy(run, 1)[1], 'no relic slots');
	run.shop.items[2] = { kind: 'relic', def: relics.DEFS[0], name: 'x', cost: 0, edition: 'phantom' };
	assert.ok(R.canBuy(run, 2)[0], 'a Phantom fits even when the slots are full');
});

test('with noRepeats, a club never offers the same item twice at once', () => {
	const key = (it) => `${it.kind}:${it.def.key}`;
	let repeatsWithout = 0;
	for (let i = 0; i < 300; i++) {
		for (const noRepeats of [true, false]) {
			const run = R.newRun('REP' + i, { noRepeats, money: 1000 });
			run.phase = R.PHASE.BOARD_WON;
			R.enterShop(run);
			for (let k = 0; k < 4; k++) {
				const keys = run.shop.items.map(key);
				const dupes = keys.length - new Set(keys).size;
				if (noRepeats) assert.equal(dupes, 0, keys.join(' '));
				else repeatsWithout += dupes;
				R.reroll(run);
			}
		}
	}
	assert.ok(repeatsWithout > 0, 'the old behavior does repeat (so the test means something)');
});

test('a run can use other targets, and keeps the standard ones by default', () => {
	assert.equal(R.newRun('T1').target, R.targetFor(1, 1));
	assert.equal(R.targetFor(1, 1), 35);
	const gentle = R.newRun('T2', { tableBase: R.GENTLE_TABLE_BASE });
	assert.equal(gentle.target, 20);
	assert.equal(R.targetFor(8, 3, R.GENTLE_TABLE_BASE), 2300);
});
