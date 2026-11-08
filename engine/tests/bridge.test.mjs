// The iPad app's engine bridge (the app lives in ~/src/xcode/ios/ShootTheMoon): evaluate the bundle the way the app does
// (no DOM, no TextEncoder) and play through its JSON API.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const path = new URL('../.bridge/game-bundle.js', import.meta.url);

function engine() {
	if (!existsSync(path)) throw new Error('run `npm run build:bridge` first');
	// A bare context, like JavaScriptCore: no TextEncoder, btoa or DOM.
	const ctx = vm.createContext({ console });
	vm.runInContext(readFileSync(path, 'utf8'), ctx);
	return ctx.ShootTheMoon;
}

test('the bridge plays a run end to end through its JSON API', () => {
	const S = engine();
	let v = JSON.parse(S.newRun('BRIDGE'));
	assert.equal(v.phase, 'pass');
	assert.equal(v.hand.mine.length, 13);
	let steps = 0,
		hands = 0;
	while (steps++ < 3000 && v.phase !== 'game_over' && v.phase !== 'victory') {
		let r;
		if (v.phase === 'pass') r = JSON.parse(S.act(JSON.stringify({ t: 'pass', cards: v.hand.mine.slice(0, 3).map((c) => c.id) })));
		else if (v.phase === 'play') {
			r = v.hand.isPlayerTurn
				? JSON.parse(S.act(JSON.stringify({ t: 'play', card: v.hand.legal[0] })))
				: JSON.parse(S.act(JSON.stringify({ t: 'ai' })));
			if (r.trick) assert.equal(r.trick.plays.length, 4);
			if (r.view.phase === 'play' && r.view.hand.tricksPlayed > 0) assert.equal(r.view.hand.lastTrick.plays.length, 4);
		} else if (v.phase === 'hand_scored') {
			hands++;
			r = JSON.parse(S.act(JSON.stringify({ t: 'continue' })));
		} else if (v.phase === 'board_won') r = JSON.parse(S.act(JSON.stringify({ t: 'shop' })));
		else if (v.phase === 'shop') {
			const item = v.shop.find((i) => i.canBuy && i.kind !== 'seal' && i.kind !== 'pack');
			if (item) S.act(JSON.stringify({ t: 'buy', slot: item.slot }));
			r = JSON.parse(S.act(JSON.stringify({ t: 'leave' })));
		}
		v = r.view;
	}
	assert.ok(hands >= 3, `hands ${hands}`);
	// The save restores to the same place.
	const S2 = engine();
	const restored = JSON.parse(S2.restore(S.save()));
	assert.equal(restored.phase, v.phase);
	assert.equal(restored.money, v.money);
	assert.deepEqual(restored.stats, v.stats);
});

test('the bridge renders pixel art as RGBA', () => {
	const S = engine();
	const card = JSON.parse(S.cardImage(4, 12, false, true));
	assert.equal(card.w, 40);
	assert.equal(card.h, 56);
	assert.equal(Buffer.from(card.rgba, 'base64').length, 40 * 56 * 4);
	assert.equal(JSON.parse(S.sealImage('ward')).w, 14);
	assert.equal(JSON.parse(S.iconImage('clean_sweep')).w, 18);
});

test('the bridge turns editions on for new runs and keeps them through a save', () => {
	const S = engine();
	S.newRun('EDSAVE');
	const save = JSON.parse(S.save());
	assert.deepEqual(save.opts, { ruleset: 'v4' });
	const cat = JSON.parse(S.catalog());
	assert.equal(cat.relics.length, 60); // 23 original + 32 expansion + 5 v4
	assert.equal(cat.bosses.length, 13);
	assert.ok(cat.seals.length === 5 && cat.editions.length === 4 && cat.packItems.length === 4 && cat.upgrades.length === 3 && cat.cardEditions.length === 3);
	const view = JSON.parse(S.view());
	assert.ok(view.boss && view.boss.name && view.boss.active === false);
	assert.equal(view.tableBoards.length, 3);
	assert.equal(view.tableBoards[0].target, 25); // v3's (and v4's) first goal
	assert.equal(JSON.parse(S.view()).target, 25, 'v3 first target');
	const S2 = engine();
	S2.restore(JSON.stringify(save));
	assert.deepEqual(JSON.parse(S2.save()).opts, save.opts);
	// An old save without options restores as it was: no editions.
	const S3 = engine();
	S3.restore(JSON.stringify({ version: save.version, seed: 'OLD', actions: [] }));
	assert.equal(JSON.parse(S3.save()).opts, undefined);
});
