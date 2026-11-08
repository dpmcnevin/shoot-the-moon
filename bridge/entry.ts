// Bridge for the native iPad app. Bundled with esbuild into game-bundle.js
// and run in a JavaScriptCore context. It reuses the web game's engine
// unmodified and exposes a flat JSON-in/JSON-out API on
// `globalThis.ShootTheMoon`. The run lives here; Swift sends actions and
// draws the snapshot `view()` returns.
//
// Every action goes through the same `applyAction` the web app uses, and is
// appended to the log that `save()` returns, so saves are interchangeable.

import './polyfills.ts';
import * as cards from '../src/lib/rules/cards.ts';
import * as H from '../src/lib/rules/hearts.ts';
import * as R from '../src/lib/game/run.ts';
import * as relics from '../src/lib/game/relics.ts';
import * as seals from '../src/lib/game/seals.ts';
import * as packs from '../src/lib/game/pack.ts';
import { applyAction, replay, SAVE_VERSION, type Action, type Save } from '../src/lib/app/save.ts';
import { faceBitmap, backBitmap } from '../src/lib/ui/pixelcards.ts';
import { bitmap as iconBitmap } from '../src/lib/ui/icons.ts';
import { sealBitmap } from '../src/lib/ui/sealart.ts';
import { toRGBA, type Bitmap } from '../src/lib/ui/pixel.ts';
import type { Card } from '../src/lib/rules/cards.ts';
import type { Run } from '../src/lib/game/run.ts';
import type { Trick } from '../src/lib/rules/hearts.ts';

let run: Run | null = null;
let actions: Action[] = [];
/** Options the current run was started with (saved with it). */
let opts: R.RunOptions | undefined;

// ------------------------------------------------------------------ encoding

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64(bytes: Uint8Array | Uint8ClampedArray): string {
	let out = '';
	let i = 0;
	for (; i + 2 < bytes.length; i += 3) {
		const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
		out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
	}
	const rest = bytes.length - i;
	if (rest === 1) {
		const n = bytes[i] << 16;
		out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + '==';
	} else if (rest === 2) {
		const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
		out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=';
	}
	return out;
}

function image(b: Bitmap): string {
	return JSON.stringify({ w: b.w, h: b.h, rgba: base64(toRGBA(b, 1)) });
}

// ------------------------------------------------------------------ snapshot

function cardView(c: Card) {
	return { id: c.id ?? 0, suit: c.suit, rank: c.rank, code: cards.code(c), name: cards.name(c), seal: seals.sealOf(run!.seals, c) ?? null };
}

function trickView(t: Trick | null | undefined) {
	if (!t) return null;
	return {
		index: t.index,
		winner: t.winner,
		points: t.points,
		plays: t.plays.map((p) => ({ seat: p.seat, card: cardView(p.card) })),
		kitty: t.kitty.map(cardView)
	};
}

function shopView() {
	const r = run!;
	if (!r.shop) return null;
	return r.shop.items.map((it, i) => {
		const [ok, why] = R.canBuy(r, i);
		const base = { slot: i, kind: it.kind, name: it.name, cost: it.cost, sold: !!it.sold, canBuy: ok, why: why ?? null };
		if (it.kind === 'relic')
			return { ...base, text: it.def.text, icon: it.def.icon, rarity: it.def.rarity, rarityName: relics.RARITY_NAME[it.def.rarity], edition: editionView(it.edition) };
		if (it.kind === 'upgrade') {
			const lvl = r.levels[it.def.key];
			const [c, m] = R.upgradeBonus(it.def.key, lvl + 1);
			return { ...base, text: it.def.text, icon: it.def.icon, level: lvl, nextChips: c, nextMult: m };
		}
		if (it.kind === 'seal') return { ...base, text: it.def.text, seal: it.def.key, color: it.def.color };
		return { ...base, text: it.def.text, icon: it.def.icon, op: it.def.key };
	});
}

function editionView(key: relics.EditionKey | undefined) {
	if (!key) return null;
	const e = relics.EDITIONS[key];
	return { key: e.key, name: e.name, text: e.text };
}

function view() {
	const r = run;
	if (!r) return { hasRun: false };
	const hand = r.hand;
	const st = hand.state;
	const mine = st ? st.hands[H.PLAYER] : hand.dealt[H.PLAYER];
	const legal = st && R.isPlayerTurn(r) ? H.legalPlays(st, H.PLAYER).map((c) => c.id) : [];
	const res = hand.result;
	return {
		hasRun: true,
		seed: String(r.seed),
		phase: r.phase,
		table: r.table,
		tables: R.TABLES,
		board: r.board,
		boardName: R.boardName(r),
		target: r.target,
		score: r.score,
		handsLeft: r.handsLeft,
		handsPerBoard: R.HANDS_PER_BOARD,
		money: r.money,
		interest: R.interest(r),
		rerollCost: r.rerollCost,
		relicSlots: R.RELIC_SLOTS,
		relicSlotsUsed: R.relicSlotsUsed(r),
		levels: Object.values(R.UPGRADES).map((u) => {
			const [c, m] = R.upgradeBonus(u.key, r.levels[u.key]);
			return { key: u.key, name: u.name, text: u.text, icon: u.icon, level: r.levels[u.key], chips: c, mult: m };
		}),
		relics: r.relics.map((x) => ({ key: x.key, name: x.name, rarity: x.def.rarity, rarityName: relics.RARITY_NAME[x.def.rarity], icon: x.def.icon, text: relics.textFor(x), sell: Math.max(1, Math.floor(x.cost / 2)), edition: editionView(x.edition) })),
		seals: Object.entries(r.seals).map(([id, key]) => {
			const c = r.pack.find((p) => String(p.id) === id);
			return { cardId: Number(id), key, name: seals.SEALS[key].name, text: seals.SEALS[key].text, card: c ? cardView(c) : null };
		}),
		pack: packs.sortedPack(r.pack).map(cardView),
		packPoints: r.pack.reduce((n, c) => n + seals.cardPoints(r.seals, c), 0),
		hand: {
			passDir: hand.passDir,
			passTo: hand.passDir === 'hold' ? null : H.SEAT_NAMES[H.passTarget(H.PLAYER, hand.passDir)],
			mine: mine.map(cardView),
			opponents: Object.fromEntries([1, 2, 4].map((s) => [s, (st ? st.hands[s] : hand.dealt[s]).map((c) => c.id)])),
			kitty: st && st.tricks.length > 0 ? [] : hand.kitty.map((c) => c.id),
			trick: st ? st.trick.map((p) => ({ seat: p.seat, card: cardView(p.card) })) : [],
			tricksPlayed: st ? st.tricks.length : 0,
			/** The last finished trick of this hand, for the Last trick button. */
			lastTrick: st && st.tricks.length ? trickView(st.tricks[st.tricks.length - 1]) : null,
			handSize: st ? st.handSize : mine.length,
			turn: st && !st.complete ? st.turn : null,
			isPlayerTurn: R.isPlayerTurn(r),
			legal,
			points: st ? H.pointsTaken(st) : [0, 0, 0, 0, 0],
			heartsBroken: st ? st.heartsBroken : false,
			received: hand.received.map((c) => c.id),
			receivedFrom: hand.received.length ? H.passSource(H.PLAYER, hand.passDir) : null
		},
		result: res
			? { lines: res.lines, chips: res.chips, mult: res.mult, total: res.total, myPoints: res.myPoints, shooter: res.shooter, points: res.points, money: res.money }
			: null,
		payout: r.lastPayout ?? null,
		shop: shopView(),
		stats: r.stats,
		seatNames: H.SEAT_NAMES
	};
}

// ------------------------------------------------------------------ API

function act(json: string): string {
	if (!run) throw new Error('no run');
	const a = JSON.parse(json) as Action;
	const before = run.hand.state?.heartsBroken ?? false;
	const out = applyAction(run, a);
	actions.push(a);
	return JSON.stringify({
		ok: out.ok,
		trick: trickView(out.tricks?.[0] ?? out.step?.trick ?? null),
		step: out.step ? { seat: out.step.seat, card: cardView(out.step.card) } : null,
		brokeHearts: !before && (run.hand.state?.heartsBroken ?? false),
		view: view()
	});
}

const api = {
	newRun(seed: string | null): string {
		opts = { editions: true, noRepeats: true, tableBase: R.GENTLE_TABLE_BASE };
		run = R.newRun(seed && seed.length ? seed.toUpperCase() : undefined, opts);
		actions = [];
		return JSON.stringify(view());
	},
	restore(json: string): string {
		const s = JSON.parse(json) as Save;
		if (s.version !== SAVE_VERSION) throw new Error('old save');
		run = replay(s);
		opts = s.opts;
		actions = s.actions.slice();
		return JSON.stringify(view());
	},
	save(): string {
		if (!run) return '';
		return JSON.stringify({ version: SAVE_VERSION, seed: run.seed, actions, ...(opts ? { opts } : {}) });
	},
	act,
	view: () => JSON.stringify(view()),
	/** Can a pack item be used on this card? */
	canApply(slot: number, cardId: number): string {
		const item = run?.shop?.items[slot];
		if (!run || !item || item.kind !== 'pack') return JSON.stringify([true]);
		return JSON.stringify(packs.canApply(run, item.def, run.pack.find((c) => c.id === cardId)));
	},
	cardImage: (suit: number, rank: number, trump: boolean, fourColor: boolean) =>
		image(faceBitmap({ suit, rank }, trump, fourColor)),
	backImage: () => image(backBitmap()),
	iconImage: (key: string) => image(iconBitmap(key)),
	sealImage: (key: string) => image(sealBitmap(key as seals.SealKey))
};

(globalThis as Record<string, unknown>).ShootTheMoon = api;
