// The run engine, scoring, relics, upgrades and auto-save.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as cards from '../src/rules/cards.ts';
import * as H from '../src/rules/hearts.ts';
import * as ai from '../src/rules/ai.ts';
import * as R from '../src/game/run.ts';
import * as relics from '../src/game/relics.ts';
import { applyAction, replay } from '../src/app/save.ts';
import { newRng } from '../src/rules/rng.ts';
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

import * as seals from '../src/game/seals.ts';

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

import * as packs from '../src/game/pack.ts';

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
	assert.equal(R.targetFor(8, 3, R.GENTLE_TABLE_BASE), 2200);
});

// ------------------------------------------------------------------ bosses

import * as bosses from '../src/game/bosses.ts';

/** A run sitting at the start of a High Board with the given boss. */
function bossRun(key, seed = 'BOSS', setup, opts = { bosses: true }) {
	const run = R.newRun(seed, opts);
	setup?.(run);
	run.board = R.BOARDS_PER_TABLE;
	run.boss = key;
	run.handCount = 0; // a left pass
	R.startBoard(run);
	return run;
}

/** Score the hand as if `taken[seat]` were what each seat won. */
function scoreWithTaken(run, taken) {
	finish(run);
	const st = run.hand.state;
	st.taken = taken;
	return R.scoreHand(run);
}

test('bosses are off unless the run turns them on', () => {
	const run = R.newRun('NOBOSS');
	assert.equal(run.boss, null);
	assert.equal(R.bossActive(run), false);
	const on = R.newRun('NOBOSS', { bosses: true });
	assert.ok(on.boss && bosses.BOSSES[on.boss].tier === 1, 'table 1 draws a first-tier boss');
	assert.equal(R.bossActive(on), false, 'not until the High Board');
});

test('later tables draw harsher bosses, without repeats', () => {
	const rng = newRng('TIERS');
	for (let i = 0; i < 200; i++) {
		assert.equal(bosses.BOSSES[bosses.pickBoss(rng, 1, [])].tier, 1);
		assert.ok(bosses.BOSSES[bosses.pickBoss(rng, 4, [])].tier <= 2);
	}
	const late = new Set(Array.from({ length: 200 }, () => bosses.BOSSES[bosses.pickBoss(rng, 7, [])].tier));
	assert.ok(late.has(3));
	const seen = ['open_book', 'moon_thief', 'diamond_jack', 'auditor', 'taxman'];
	for (let i = 0; i < 50; i++) assert.equal(bosses.pickBoss(rng, 1, seen), 'blindfold');
});

test('the Shortchanger leaves two hands', () => {
	assert.equal(bossRun('shortchanger').handsLeft, 2);
	assert.equal(bossRun('widow').handsLeft, 3);
});

test('the Widow doubles the queen; the Diamond Jack is worth ten', () => {
	const w = bossRun('widow');
	finish(w);
	const qs = w.hand.state.pack.find(H.isQueenOfSpades);
	assert.equal(w.hand.state.pts(qs), 26);
	const d = bossRun('diamond_jack');
	finish(d);
	const jd = d.hand.state.pack.find((c) => c.suit === H.DIAMONDS && c.rank === 11);
	assert.equal(d.hand.state.pts(jd), 10);
	// The moon now needs the jack too.
	const st = d.hand.state;
	const withoutJack = st.pack.filter((c) => st.pts(c) > 0 && c !== jd);
	st.taken = [[], [], [], withoutJack, st.pack.filter((c) => !withoutJack.includes(c))];
	assert.equal(H.moonShooter(st), null);
	st.taken = [[], [], [], [...withoutJack, jd], st.pack.filter((c) => !withoutJack.includes(c) && c !== jd)];
	assert.equal(H.moonShooter(st), H.PLAYER);
});

test('the Open Book breaks hearts before the first trick', () => {
	const run = bossRun('open_book');
	R.commitPass(run, run.hand.dealt[H.PLAYER].slice(0, 3), { stepwise: true });
	assert.equal(run.hand.state.heartsBroken, true);
	const plain = bossRun('taxman');
	R.commitPass(plain, plain.hand.dealt[H.PLAYER].slice(0, 3), { stepwise: true });
	assert.equal(plain.hand.state.heartsBroken, false);
});

test('the Pickpocket passes you the worst three cards', () => {
	const run = bossRun('pickpocket');
	const from = H.passSource(H.PLAYER, run.hand.passDir);
	const expect = ai.mostDangerous(run.hand.dealt[from], 3);
	R.commitPass(run, run.hand.dealt[H.PLAYER].slice(0, 3), { stepwise: true });
	assert.deepEqual(run.hand.received.map((c) => c.id).sort(), expect.map((c) => c.id).sort());
});

test('the Moon Thief cancels your moon', () => {
	const take = (run) => [[], [], [], run.hand.state.pack.slice(), []];
	const thief = bossRun('moon_thief');
	finish(thief);
	const b = scoreWithTaken(thief, take(thief));
	assert.equal(b.shooter, null);
	assert.equal(b.total, 0);
	const normal = bossRun('taxman');
	finish(normal);
	assert.equal(scoreWithTaken(normal, take(normal)).shooter, H.PLAYER);
});

test('the Auditor stops the clean bonus; the Taxman charges for hearts', () => {
	const audit = bossRun('auditor');
	finish(audit);
	const pack = audit.hand.state.pack;
	const clean = scoreWithTaken(audit, [[], pack.filter((c) => c.suit === H.HEARTS), pack.filter((c) => c.suit !== H.HEARTS), [], []]);
	assert.ok(!clean.lines.some((l) => l.label === 'Clean hand'));
	assert.equal(clean.total, 26);
	const tax = bossRun('taxman');
	finish(tax);
	const hearts = tax.hand.state.pack.filter((c) => c.suit === H.HEARTS).slice(0, 4);
	const rest = tax.hand.state.pack.filter((c) => !hearts.includes(c));
	const b = scoreWithTaken(tax, [[], [], [], hearts, rest]);
	assert.equal(b.lines.find((l) => l.label.startsWith('The Taxman')).chips, -20);
	assert.equal(b.total, 26 - 4 - 20);
});

test('the Jinx switches off one relic for the board', () => {
	const run = bossRun('jinx', 'JINX', (r) => {
		r.relics.push(relics.instantiate(relics.get('house_rules')));
		r.relics.push(relics.instantiate(relics.get('full_moon')));
	});
	assert.ok(run.jinxed);
	assert.equal(R.activeRelics(run).length, 1);
	assert.ok(!R.activeRelics(run).some((r) => r.key === run.jinxed));
});

test('the Cartel and the Shark push points onto you', () => {
	const avg = (key) => {
		let pts = 0;
		for (let i = 0; i < 300; i++) {
			const run = bossRun(key, 'GANG' + i);
			pts += finish(run).myPoints;
		}
		return pts / 300;
	};
	const base = avg('taxman');
	assert.ok(avg('cartel') > base + 1, `cartel ${avg('cartel')} vs ${base}`);
	assert.ok(avg('shark') > base, `shark ${avg('shark')} vs ${base}`);
});

test('v3 bosses: Moon Thief doubles your points, the Cartel triples them', () => {
	const v3 = (key) => bossRun(key, 'V3B', undefined, { ruleset: 'v3' });
	const takeHearts = (run, n) => {
		const pack = run.hand.state.pack;
		const hearts = pack.filter((c) => c.suit === H.HEARTS).slice(0, n);
		return [[], [], [], hearts, pack.filter((c) => !hearts.includes(c))];
	};
	const thief = v3('moon_thief');
	finish(thief);
	assert.equal(scoreWithTaken(thief, takeHearts(thief, 3)).lines[0].chips, 26 - 6);
	const cartel = v3('cartel');
	finish(cartel);
	assert.equal(scoreWithTaken(cartel, takeHearts(cartel, 3)).lines[0].chips, 26 - 9);
	// The classic Moon Thief only cancels the moon.
	const old = bossRun('moon_thief', 'V3B');
	finish(old);
	assert.equal(scoreWithTaken(old, takeHearts(old, 3)).lines[0].chips, 26 - 3);
});

test('v3 bosses: Open Book hearts count 4; every diamond counts under the Diamond Jack', () => {
	const ob = bossRun('open_book', 'V3B', undefined, { ruleset: 'v3' });
	finish(ob);
	const heart = ob.hand.state.pack.find((c) => c.suit === H.HEARTS);
	assert.equal(ob.hand.state.pts(heart), 4);
	const dj = bossRun('diamond_jack', 'V3B', undefined, { ruleset: 'v3' });
	finish(dj);
	const st = dj.hand.state;
	assert.equal(st.pts(st.pack.find((c) => c.suit === H.DIAMONDS && c.rank === 11)), 10);
	assert.equal(st.pts(st.pack.find((c) => c.suit === H.DIAMONDS && c.rank === 2)), 1);
});

test('v3 bosses: the Widow halves the queen hand; the Shark cuts a quarter', () => {
	const w = bossRun('widow', 'V3B', undefined, { ruleset: 'v3' });
	finish(w);
	const pack = w.hand.state.pack;
	const qs = pack.find(H.isQueenOfSpades);
	const b = scoreWithTaken(w, [[], [], [], [qs], pack.filter((c) => c !== qs)]);
	assert.equal(b.lines.at(-1).xmult, 0.5);
	const sh = bossRun('shark', 'V3B', undefined, { ruleset: 'v3' });
	finish(sh);
	const p2 = sh.hand.state.pack;
	const h = p2.filter((c) => c.suit === H.HEARTS).slice(0, 2);
	const cut = scoreWithTaken(sh, [[], [], p2.filter((c) => !h.includes(c) && c.suit !== H.HEARTS), h, p2.filter((c) => c.suit === H.HEARTS && !h.includes(c))]);
	assert.ok(cut.lines.some((l) => l.label.startsWith('The Shark') && l.xmult === 0.75));
});

test('v3 bosses: the Pickpocket fines each passed card you take back', () => {
	const run = bossRun('pickpocket', 'V3B', undefined, { ruleset: 'v3' });
	finish(run);
	const got = run.hand.received;
	const st = run.hand.state;
	const back = st.pack.filter((c) => got.some((g) => g.id === c.id)).slice(0, 2);
	const b = scoreWithTaken(run, [[], st.pack.filter((c) => !back.includes(c)), [], back, []]);
	assert.equal(b.lines.find((l) => l.label.startsWith('The Pickpocket')).chips, -2 * R.PICKPOCKET_FINE);
});

test('beating a boss pays a bonus', () => {
	const run = bossRun('taxman');
	run.score = run.target;
	finish(run);
	run.score = run.target + 1000;
	R.continueAfterHand(run);
	assert.equal(run.lastPayout.boss, bosses.BOSS_BONUS);
	const plain = R.newRun('PLAIN', { bosses: true });
	finish(plain);
	plain.score = plain.target + 1000;
	R.continueAfterHand(plain);
	assert.equal(plain.lastPayout.boss, undefined);
});

// ------------------------------------------------------------------ expansion relics

const expansion = relics.DEFS.filter((d) => d.expansion);

test('there are 32 expansion relics, offered only when the run asks', () => {
	assert.equal(expansion.length, 32);
	const rng = newRng('POOL');
	for (let i = 0; i < 500; i++) assert.ok(!relics.randomUnowned(rng, []).expansion);
	const seen = new Set(Array.from({ length: 2000 }, () => relics.randomUnowned(rng, [], true).key));
	assert.ok(expansion.filter((d) => d.rarity <= 2).every((d) => seen.has(d.key)), 'every common and uncommon turns up');
	for (const d of expansion) assert.ok(d.icon === d.key, `${d.key} has its own icon`);
});

test('holding every expansion relic plays and scores cleanly', () => {
	for (let i = 0; i < 60; i++) {
		const run = R.newRun('ALL' + i, { moreRelics: true, bosses: true });
		for (const d of expansion) run.relics.push(relics.instantiate(d));
		for (let h = 0; h < 6 && (run.phase === R.PHASE.PASS || run.phase === R.PHASE.PLAY); h++) {
			const b = finish(run);
			assert.ok(Number.isFinite(b.total) && b.total >= 0);
			R.continueAfterHand(run);
			if (run.phase === R.PHASE.BOARD_WON) break;
		}
	}
});

test('Wildcard lets your first cards ignore follow-suit', () => {
	let checked = 0;
	for (let i = 0; i < 80 && checked < 5; i++) {
		const run = R.newRun('WILD' + i, { moreRelics: true });
		run.relics.push(relics.instantiate(relics.get('wildcard')));
		if (run.phase === R.PHASE.PASS) R.commitPass(run, run.hand.dealt[H.PLAYER].slice(0, 3), { stepwise: true });
		const st = run.hand.state;
		assert.equal(st.wildSeat, H.PLAYER);
		assert.equal(st.wildLeft, 3);
		while (!st.complete && st.turn !== H.PLAYER) H.play(st, st.turn, H.legalPlays(st, st.turn)[0]);
		if (st.trick.length === 0) continue; // you lead: nothing to show
		assert.equal(H.legalPlays(st, H.PLAYER).length, st.hands[H.PLAYER].length, 'anything goes');
		H.play(st, H.PLAYER, H.legalPlays(st, H.PLAYER)[0]);
		assert.equal(st.wildLeft, 2);
		checked++;
	}
	assert.ok(checked > 0);
});

test('The Fixer hands one of your hearts to the leader each hand', () => {
	let moved = 0;
	for (let i = 0; i < 60; i++) {
		const run = R.newRun('FIX' + i, { moreRelics: true });
		const fixer = relics.instantiate(relics.get('the_fixer'));
		run.relics.push(fixer);
		if (run.phase === R.PHASE.PASS) R.commitPass(run, ai.choosePass(run.hand.dealt[H.PLAYER], newRng('p' + i)));
		if (run.phase === R.PHASE.PLAY) R.playOut(run);
		const st = run.hand.state;
		const tookHeart = st.tricks.some((t) => t.winner === H.PLAYER && [...t.plays.map((p) => p.card), ...t.kitty].some((c) => c.suit === H.HEARTS));
		if (tookHeart && run.hand.result.shooter !== H.PLAYER) {
			assert.ok(fixer.state.used);
			moved++;
		}
	}
	assert.ok(moved > 0);
});

test('Shadow Moon and Moonlighter', () => {
	const shadow = R.newRun('SHADOW', { moreRelics: true });
	shadow.relics.push(relics.instantiate(relics.get('shadow_moon')));
	finish(shadow);
	const st = shadow.hand.state;
	const oneHeart = st.pack.find((c) => c.suit === H.HEARTS);
	const b = scoreWithTaken(shadow, [[], [oneHeart], st.pack.filter((c) => st.pts(c) <= 0), st.pack.filter((c) => st.pts(c) > 0 && c !== oneHeart), []]);
	assert.equal(b.shooter, H.PLAYER);

	const moon = R.newRun('MOONLIT', { moreRelics: true });
	moon.relics.push(relics.instantiate(relics.get('moonlighter')));
	finish(moon);
	const m = moon.hand.state;
	const qs = m.pack.find(H.isQueenOfSpades);
	const hearts = m.pack.filter((c) => c.suit === H.HEARTS).slice(0, 4); // 17 points
	const rest = m.pack.filter((c) => c !== qs && !hearts.includes(c));
	const mb = scoreWithTaken(moon, [[], rest.filter((c) => c.suit === H.HEARTS), rest.filter((c) => c.suit !== H.HEARTS), [qs, ...hearts], []]);
	assert.equal(mb.lines[0].chips, 26);
});

test("the Collector's Album, Interest Rate, Bargain Bin and Tip Jar", () => {
	const run = R.newRun('ECON', { moreRelics: true });
	assert.equal(R.relicSlots(run), R.RELIC_SLOTS);
	run.relics.push(relics.instantiate(relics.get('collectors_album')));
	assert.equal(R.relicSlots(run), R.RELIC_SLOTS + 1);
	assert.equal(R.relicSlotsUsed(run), 0);
	run.money = 60;
	assert.equal(R.interest(run), R.MAX_INTEREST);
	run.relics.push(relics.instantiate(relics.get('interest_rate')));
	assert.equal(R.interest(run), 8);
	run.relics.push(relics.instantiate(relics.get('bargain_bin')));
	finish(run);
	run.score = run.target + 1;
	R.continueAfterHand(run);
	R.enterShop(run);
	assert.equal(run.rerollCost, 0);
	R.reroll(run);
	assert.equal(run.rerollCost, R.BASE_REROLL_COST - 1);

	const tip = relics.get('tip_jar');
	const fake = { myTricks: Array.from({ length: 7 }, () => ({ points: 0 })) };
	assert.deepEqual(tip.score(fake), { money: 3 });
});

// ------------------------------------------------------------------ moon AI

test('moonOnCourse names the seat holding every point taken so far', () => {
	const run = R.newRun('ONCOURSE');
	finish(run);
	const st = run.hand.state;
	const hearts = st.pack.filter((c) => c.suit === H.HEARTS);
	st.taken = [[], [], [], hearts.slice(0, 3), []];
	assert.equal(H.moonOnCourse(st), H.PLAYER);
	st.taken = [[], [hearts[3]], [], hearts.slice(0, 3), []];
	assert.equal(H.moonOnCourse(st), null);
	st.taken = [[], [], [], [], []];
	assert.equal(H.moonOnCourse(st), null);
});

test('with moonAI, strong opponents go for the moon and shoot it more often', () => {
	let attempts = 0, moonsOn = 0, moonsOff = 0;
	for (let i = 0; i < 400; i++) {
		for (const moonAI of [true, false]) {
			const run = R.newRun('MAI' + i, { moonAI });
			const b = finish(run);
			if (moonAI && run.hand.state.moonSeats) attempts++;
			if (b.shooter !== null && b.shooter !== H.PLAYER) moonAI ? moonsOn++ : moonsOff++;
		}
	}
	assert.ok(attempts > 0, 'some hands have an attempt');
	assert.ok(moonsOn > moonsOff, `moons with ${moonsOn} vs without ${moonsOff}`);
	assert.equal(R.newRun('MAI0').moonAI, false, 'off by default');
});

test('aiCurve: plausible mistakes, and opponents sharpen table by table', () => {
	const run = R.newRun('CURVE', { aiCurve: true });
	const early = R.tableSkill(run);
	run.table = 8;
	assert.ok(R.tableSkill(run) > early);
	assert.equal(R.tableSkill(R.newRun('CURVE')), ai.DEFAULT_SKILL, 'off by default');
	// Always-a-mistake play stays plausible: no queen thrown when anything
	// else will do, no heart led while other suits remain.
	const rng = newRng('MIST');
	let checked = 0;
	for (let i = 0; i < 200; i++) {
		const r = R.newRun('M' + i);
		if (r.phase === R.PHASE.PASS) R.commitPass(r, r.hand.dealt[H.PLAYER].slice(0, 3), { stepwise: true });
		const st = r.hand.state;
		while (!st.complete) {
			const seat = st.turn, legal = H.legalPlays(st, seat);
			const card = ai.chooseCard(st, seat, { rng, skill: 0, plausible: true });
			if (legal.length > 1 && legal.some((c) => !H.isQueenOfSpades(c))) assert.ok(!H.isQueenOfSpades(card), 'no queen thrown');
			if (st.trick.length === 0 && legal.some((c) => c.suit !== H.HEARTS && !H.isQueenOfSpades(c))) assert.notEqual(card.suit, H.HEARTS, 'no heart lead');
			H.play(st, seat, card);
			checked++;
		}
	}
	assert.ok(checked > 1000);
});

// ------------------------------------------------------------------ rulesets

test('a ruleset stands for its options; explicit options win; classic is the default', () => {
	const v2 = R.newRun('RS', { ruleset: 'v2' });
	assert.ok(v2.editions && v2.bosses && v2.moreRelics && v2.moonAI && v2.aiCurve && v2.noRepeats);
	assert.equal(v2.target, 20);
	assert.equal(v2.ruleset, 'v2');
	const plain = R.newRun('RS');
	assert.equal(plain.ruleset, 'classic');
	assert.ok(!plain.bosses && !plain.editions);
	assert.equal(R.newRun('RS', { ruleset: 'v2', bosses: false }).bosses, false);
	// The same seed and ruleset plays the same run as the flags it names.
	const flags = R.newRun('SAME', { ...R.RULESETS.v2 });
	const named = R.newRun('SAME', { ruleset: 'v2' });
	assert.deepEqual(finish(flags).points, finish(named).points);
});

test('old saves made with flags still replay', () => {
	const opts = { editions: true, noRepeats: true, tableBase: R.GENTLE_TABLE_BASE, bosses: true, moreRelics: true };
	const run = replay({ version: 3, seed: 'OLDSAVE', actions: [], opts });
	assert.ok(run.bosses && run.editions);
	assert.equal(run.ruleset, 'classic');
});

test('v3 balance: its own relic, boss and money numbers; v2 runs keep theirs', () => {
	const v2 = R.newRun('BAL', { ruleset: 'v2' });
	const v3 = R.newRun('BAL', { ruleset: 'v3' });
	assert.equal(v2.balance, 1);
	assert.equal(v3.balance, 3);
	const fm = relics.get('full_moon');
	assert.equal(fm.score({ boardsWonThisTable: 0, balance: 1 }).xmult, 1.5);
	assert.equal(fm.score({ boardsWonThisTable: 0, balance: 3 }).xmult, 1.25);
	assert.match(relics.textAt(fm, 3), /1\.25/);
	assert.equal(bosses.bossAt('taxman', 3).tier, 2);
	assert.equal(bosses.bossAt('taxman', 1).tier, 1);
	assert.equal(R.overshootBonus(150, 100), 1);
	assert.equal(R.overshootBonus(149, 100), 0);
	assert.equal(R.overshootBonus(1000, 100), 3);
	for (const [run, board] of [[v2, 4], [v3, 4]]) {
		finish(run);
		run.score = run.target * 2;
		R.continueAfterHand(run);
		assert.equal(run.lastPayout.board, board);
		assert.equal(run.lastPayout.overshoot, run.balance >= 3 ? 2 : undefined);
	}
});
