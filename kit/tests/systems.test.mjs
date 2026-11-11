// The shared systems, through a real game: enhanced cards, relic editions,
// bundles, skipping boards, decks, bosses and endless.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/run/run.ts';
import { newRng } from '../src/core/rules/rng.ts';
import { hearts } from '../games/hearts/module.ts';
import { euchre } from '../games/euchre/module.ts';
import { bridge } from '../games/bridge/module.ts';

/** Play the current hand out with the bot. */
function playHand(run, rng = newRng('x')) {
	while (run.phase === 'pre' || run.phase === 'play') R.act(run, run.module.bot(run, rng));
}

test('packs: each game deals from its own pack, with ids', () => {
	assert.equal(R.newRun(hearts, 'P').pack.length, 52);
	assert.equal(R.newRun(bridge, 'P').pack.length, 52);
	const e = R.newRun(euchre, 'P');
	assert.equal(e.pack.length, 24);
	assert.ok(e.pack.every((c) => c.id > 0 && c.rank >= 9));
});

test('card editions score when you play the card; seals pay and wear off nothing', () => {
	const run = R.newRun(hearts, 'ED');
	for (const c of run.pack) R.setMod(run, c, { edition: 'etched', seal: 'gilded' });
	playHand(run);
	const lines = run.result.lines.map((l) => l.label);
	assert.equal(lines.filter((l) => l.startsWith('Etched ')).length, 13, 'one per card you played');
	assert.ok(run.result.money > 0 || run.result.lines.every((l) => !l.label.startsWith('Gilded')), 'gilded pays on tricks you win');
});

test('relic editions add every hand; Phantom takes no slot', () => {
	const run = R.newRun(euchre, 'RE');
	const def = euchre.relics[0];
	run.relics.push(R.instantiate(def, 'lacquered'), R.instantiate(euchre.relics[1], 'phantom'));
	assert.equal(R.relicSlotsUsed(run), 1);
	playHand(run);
	if (run.result.made) assert.ok(run.result.lines.some((l) => l.label === `Lacquered ${def.name}` && l.mult === 0.5));
});

test('bundles open to three choices; picking one takes it', () => {
	const run = R.newRun(bridge, 'BU', { money: 99 });
	run.phase = 'won';
	R.enterShop(run);
	run.shop.items[0] = { kind: 'bundle', def: { key: 'relic', name: 'Relic Bundle', text: '', cost: 6, icon: 'bundle_relic', weight: 1 }, name: 'Relic Bundle', cost: 6 };
	assert.ok(R.buy(run, 0)[0]);
	assert.equal(run.opening.options.length, 3);
	assert.equal(R.canBuy(run, 1)[0], false, 'open it first');
	assert.ok(R.pick(run, 1)[0]);
	assert.equal(run.relics.length, 1);
	assert.equal(run.opening, null);
});

test('skipping a board takes its tag and goes straight to the next', () => {
	const run = R.newRun(euchre, 'SK');
	const tag = R.skipTag(run);
	assert.ok(tag);
	const money = run.money;
	assert.ok(R.skipBoard(run)[0]);
	assert.equal(run.board, 2);
	assert.equal(run.stats.boardsSkipped, 1);
	if (tag === 'cash') assert.equal(run.money, money + 8);
	// Never the boss board.
	R.skipBoard(run);
	assert.equal(run.board, 3);
	assert.equal(R.skipTag(run), null);
});

test('decks change the start; a game adds its own (Burned)', () => {
	assert.equal(R.newRun(hearts, 'D', { deck: 'burned' }).pack.length, 51);
	assert.equal(R.newRun(bridge, 'D', { deck: 'gilded' }).money, 10);
	const royal = R.newRun(euchre, 'D', { deck: 'royal' });
	assert.equal(royal.pack.filter((c) => R.mod(royal, c).edition === 'etched').length, 4);
	assert.equal(R.newRun(hearts, 'D', { deck: 'schemer' }).ploys.length, 2);
});

test('bosses rule the last board of each table; endless goes on after victory', () => {
	const run = R.newRun(euchre, 'BO');
	assert.ok(run.boss, 'chosen when the table starts');
	R.skipBoard(run);
	R.skipBoard(run);
	assert.ok(R.bossActive(run));
	assert.equal(run.handsLeft, run.boss.hands ?? euchre.handsPerBoard);
	// Endless: past the last table the goals keep growing.
	assert.ok(R.goalFor(euchre, 9, 1) > R.goalFor(euchre, 8, 1));
	run.phase = 'victory';
	assert.ok(R.goEndless(run)[0]);
	assert.equal(run.phase, 'won');
	assert.ok(run.endless);
});
