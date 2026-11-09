// A compact, readable log of a run, to download and send back for analysis.
// Built by replaying the save, so it covers everything since the run began:
// each hand (dealt, passed, received, every trick, the score line by line),
// each club (offers, buys, rerolls, bundles), ploys, skipped boards, payouts
// and the result. The save itself goes last, on one line, for an exact replay.
//
// Cards are short codes (QS, 10H); seats are N E S W, S being you. A trick
// reads "W:2C N:5C E:KC S:AC >S 0": who played what, who won, its points.

import * as R from '../game/run.ts';
import * as relics from '../game/relics.ts';
import * as cards from '../rules/cards.ts';
import * as H from '../rules/hearts.ts';
import * as ploysLib from '../game/ploys.ts';
import * as tagsLib from '../game/tags.ts';
import { applyAction, type Save } from './save.ts';
import type { Card } from '../rules/cards.ts';
import type { Run, ShopItem, Breakdown, BundleChoice } from '../game/run.ts';

const SEAT = ['', 'N', 'E', 'S', 'W'];
const c = (x: Card | undefined) => (x ? cards.code(x) : '?');
const list = (xs: Card[]) => xs.map(c).join(' ');
const n = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(2));

function offer(it: ShopItem): string {
	const kind = it.kind === 'relic' ? `${relics.RARITY_NAME[it.def.rarity].toLowerCase()} relic` : it.kind;
	const ed = it.kind === 'relic' && it.edition ? ` ${it.edition}` : '';
	return `${it.name}${ed} (${kind}) $${it.cost}`;
}

function choice(run: Run, o: BundleChoice): string {
	if (o.kind === 'edition') return `${o.edition} on ${c(run.pack.find((x) => x.id === o.cardId))}`;
	return o.def.name;
}

function scoreLine(b: Breakdown): string {
	const parts = b.lines.map((l) => {
		const bits = [
			l.chips ? `${l.chips > 0 ? '+' : ''}${n(l.chips)}c` : '',
			l.mult ? `+${n(l.mult)}m` : '',
			l.xmult && l.xmult !== 1 ? `x${n(l.xmult)}` : '',
			l.money ? `+$${l.money}` : ''
		]
			.filter(Boolean)
			.join(' ');
		return `${l.label}${bits ? ' ' + bits : ''}`;
	});
	return `${parts.join(' | ')} = ${n(b.chips)} x ${n(b.mult)} = ${b.total}`;
}

/** The run so far, as compact text. */
export function buildLog(save: Save): string {
	const run: Run = R.newRun(save.seed, save.opts);
	const out: string[] = [];
	const deck = run.deck !== 'standard' ? ` · deck ${run.deck}` : '';
	out.push(`SHOOT THE MOON log · seed ${run.seed} · ruleset ${run.ruleset}${deck}`);
	out.push('Cards: QS = queen of spades. Seats: N E S W (S is you). Trick: plays in order, >winner, points. Score: c chips, m mult.');

	let lastBoard = '';
	let lastHand: unknown = null;
	const tricksDone = new Set<number>();
	const boardHead = () => {
		const key = `${run.table}.${run.board}`;
		if (key === lastBoard) return;
		lastBoard = key;
		const boss = R.bossActive(run) && run.boss ? ` · boss ${run.boss}` : '';
		out.push('');
		out.push(`== Table ${run.table} ${R.boardName(run)} · goal ${run.target} · ${run.handsLeft} hands · $${run.money}${boss}`);
		const rel = run.relics.map((r) => r.name + (r.edition ? ` (${r.edition})` : '')).join(', ');
		if (rel) out.push(`   relics: ${rel}`);
		const lv = (Object.keys(run.levels) as R.UpgradeKey[])
			.filter((k) => run.levels[k] > 1)
			.map((k) => `${k} ${run.levels[k]}`)
			.join(', ');
		if (lv) out.push(`   levels: ${lv}`);
		if (run.ploys.length) out.push(`   ploys: ${run.ploys.join(', ')}`);
	};
	const handHead = () => {
		if (run.hand === lastHand || (run.phase !== R.PHASE.PASS && run.phase !== R.PHASE.PLAY)) return;
		lastHand = run.hand;
		tricksDone.clear();
		boardHead();
		out.push(`-- Hand ${run.handsThisBoard - run.handsLeft + 1} · pass ${run.hand.passDir} · dealt ${list(run.hand.dealt[H.PLAYER])}`);
	};
	const logTricks = () => {
		const st = run.hand.state;
		if (!st) return;
		for (const t of st.tricks) {
			if (tricksDone.has(t.index)) continue;
			tricksDone.add(t.index);
			out.push(`   ${t.index}. ${t.plays.map((p) => `${SEAT[p.seat]}:${c(p.card)}`).join(' ')} >${SEAT[t.winner]} ${t.points}`);
		}
	};

	handHead();
	for (const a of save.actions) {
		const before = run.phase;
		let note = '';
		if (a.t === 'pass') note = `   passed ${a.cards.map((id) => c(run.hand.dealt[H.PLAYER].find((x) => x.id === id))).join(' ')}`;
		else if (a.t === 'buy') {
			const it = run.shop?.items[a.slot];
			const card = a.card !== undefined ? run.pack.find((x) => x.id === a.card) : undefined;
			if (it) note = `   bought ${it.name}${card ? ` on ${c(card)}` : ''} $${it.cost}`;
		} else if (a.t === 'ploy') note = `   used ploy ${ploysLib.PLOYS[run.ploys[a.slot]]?.name ?? '?'}`;
		else if (a.t === 'pick') {
			const o = run.opening?.options[a.index];
			note = a.index < 0 || !o ? '   took nothing from the bundle' : `   took ${choice(run, o)}`;
		} else if (a.t === 'skip') {
			boardHead();
			const t = R.skipTag(run);
			note = `   skipped ${R.boardName(run)} for ${t ? tagsLib.TAGS[t].name : '?'}`;
		} else if (a.t === 'sellRelic') note = `   sold ${run.relics[a.slot]?.name ?? '?'}`;
		else if (a.t === 'reroll') note = `   reroll $${run.rerollCost}`;
		else if (a.t === 'leave') note = '   left the club';
		else if (a.t === 'endless') note = '   kept going: endless';

		applyAction(run, a);
		if (note) out.push(note);
		if (a.t === 'pass') out.push(`   got ${list(run.hand.received)}`);
		logTricks();
		if (run.phase === R.PHASE.HAND_SCORED && before !== R.PHASE.HAND_SCORED && run.hand.result) {
			const b = run.hand.result;
			out.push(`   points ${[3, 4, 1, 2].map((s) => `${SEAT[s]}${b.points[s]}`).join(' ')}${b.shooter ? ` · ${SEAT[b.shooter]} shot the moon` : ''}`);
			out.push(`   score: ${scoreLine(b)} · board ${run.score}/${run.target}`);
		}
		if (run.phase === R.PHASE.BOARD_WON && before !== R.PHASE.BOARD_WON && run.lastPayout) {
			const p = run.lastPayout;
			const extra = [p.relics ? `relics ${p.relics}` : '', p.boss ? `boss ${p.boss}` : '', p.overshoot ? `overshoot ${p.overshoot}` : ''].filter(Boolean);
			out.push(`   WON · paid $${p.total} (board ${p.board}, unused ${p.unused}, interest ${p.interest}${extra.length ? ', ' + extra.join(', ') : ''}) → $${run.money}`);
		}
		if ((a.t === 'shop' || a.t === 'reroll') && run.shop) out.push(`   club ($${run.money}): ${run.shop.items.map(offer).join(' · ')}`);
		if (a.t === 'buy' && run.opening) out.push(`   bundle: ${run.opening.options.map((o) => choice(run, o)).join(' · ')}`);
		if (run.phase === R.PHASE.GAME_OVER && before !== R.PHASE.GAME_OVER) out.push(`   LOST on table ${run.table} ${R.boardName(run)}: ${run.score}/${run.target}`);
		if (run.phase === R.PHASE.VICTORY && before !== R.PHASE.VICTORY) out.push('   VICTORY: all eight tables');
		handHead();
	}

	out.push('');
	const st = run.stats;
	out.push(`Now: table ${run.table} ${R.boardName(run)} · ${run.phase} · score ${run.score}/${run.target} · $${run.money} · hands ${st.handsPlayed} · moons ${st.moons} · clean ${st.cleanHands} · best ${st.bestHand}`);
	out.push(`save: ${JSON.stringify(save)}`);
	return out.join('\n');
}
