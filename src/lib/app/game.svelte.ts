// The game controller: screens, timing, sound cues and input actions.
// Same pattern as Vulnerable's: the engine mutates its run in place, so
// reactivity works through a version counter, and `run`/`hand` return fresh
// transparent proxies per version. Every engine action goes through `act`,
// which logs it for the auto-save.

import * as cards from '../rules/cards.ts';
import * as H from '../rules/hearts.ts';
import * as R from '../game/run.ts';
import type { Card } from '../rules/cards.ts';
import type { Trick } from '../rules/hearts.ts';
import type { Hand, Run } from '../game/run.ts';
import * as sound from '../audio/sound.ts';
import * as save from './save.ts';
import * as packs from '../game/pack.ts';
import type { Action, Outcome } from './save.ts';
import { fx } from './fx.svelte.ts';
import { getLayout, seatOrigin, trickXY, type Layout, type Orientation } from './layout.ts';
import { C, hex, type Color } from '../ui/theme.ts';

const hexHeart = hex('#f08a8a');

export const PHASE = R.PHASE;
export const AI_DELAY = 0.45;
export const TRICK_HOLD = 1.0;
export const REVEAL_STEP = 0.3;

export interface RevealItem {
	label: string;
	money?: number;
	chips?: number;
	mult?: number;
	xmult?: number;
}

class Reveal {
	items: RevealItem[];
	shown = $state(0);
	done = $state(false);
	t = 0;
	totalY = 380;
	constructor(items: RevealItem[]) {
		this.items = items;
	}
}

export interface Sweep {
	id: number;
	card: Card;
	x: number;
	y: number;
	until: number;
}

let nextId = 1;
const ids = new WeakMap<Card, number>();
export function cardId(c: Card): number {
	let id = ids.get(c);
	if (!id) {
		id = nextId++;
		ids.set(c, id);
	}
	return id;
}

class Game {
	v = $state(0);
	screen = $state<'menu' | 'run'>('menu');
	orientation = $state<Orientation>('landscape');
	seedInput = $state('');
	showHelp = $state(false);
	/** Cards you've picked to pass. */
	passPick = $state.raw<Card[]>([]);
	trickHold = $state.raw<{ trick: Trick; timer: number } | null>(null);
	reveal = $state.raw<Reveal | null>(null);
	toast = $state.raw<{ text: string; color: Color; id: number } | null>(null);
	sweeps = $state.raw<Sweep[]>([]);
	shopRolls = $state(0);
	/** Shop slot of a seal waiting for you to pick its card. */
	sealPick = $state<number | null>(null);

	private _run: Run | null = null;
	private actions: Action[] = [];
	private lastPhase: string | null = null;
	private aiTimer = 0;
	private streak = 0;
	private toastTimer = 0;
	/** Set when taking the queen is what breaks hearts, for the cue. */
	private queenBroke = false;
	private pickAt: [number, number] = [0, 0];
	readonly handIntro = new WeakMap<object, number>();

	get run(): Run | null {
		void this.v;
		return this._run ? new Proxy(this._run, {}) : null;
	}
	get hand(): Hand {
		void this.v;
		return new Proxy(this._run!.hand, {});
	}
	get rawHand(): Hand {
		void this.v;
		return this._run!.hand;
	}
	get layout(): Layout {
		return getLayout(this.orientation);
	}
	bump() {
		this.v++;
	}

	// ------------------------------------------------------------------ saving

	private act(a: Action): Outcome {
		const out = save.applyAction(this._run!, a);
		this.actions.push(a);
		this.persist();
		return out;
	}

	private persist() {
		const run = this._run;
		if (!run) return;
		if (run.phase === PHASE.GAME_OVER || run.phase === PHASE.VICTORY) save.clear();
		else save.store({ version: save.SAVE_VERSION, seed: run.seed, actions: this.actions });
	}

	restore(): boolean {
		const s = save.load();
		if (!s) return false;
		try {
			this.startRun(save.replay(s));
			this.actions = s.actions.slice();
			this.screen = 'menu';
			return true;
		} catch (err) {
			console.warn('saved run could not be restored:', err);
			save.clear();
			return false;
		}
	}

	private startRun(run: Run) {
		fx.clear();
		this._run = run;
		this.actions = [];
		this.passPick = [];
		this.trickHold = null;
		this.reveal = null;
		this.lastPhase = run.phase === PHASE.HAND_SCORED ? null : run.phase;
		this.sweeps = [];
		this.streak = 0;
		this.aiTimer = AI_DELAY;
		this.bump();
	}

	newRun() {
		const seed = this.seedInput !== '' ? this.seedInput.toUpperCase() : undefined;
		this.startRun(R.newRun(seed));
		this.lastPhase = null;
		this.screen = 'run';
		this.persist();
	}

	showToast(text: string, color: Color = C.brass) {
		this.toast = { text, color, id: (this.toast?.id ?? 0) + 1 };
		this.toastTimer = 2.6;
	}

	// ------------------------------------------------------------------ passing

	togglePass(card: Card) {
		const run = this._run!;
		if (run.phase !== PHASE.PASS) return;
		const pick = this.passPick;
		if (pick.includes(card)) this.passPick = pick.filter((c) => c !== card);
		else if (pick.length < 3) this.passPick = [...pick, card];
		else {
			sound.play('trick_lose', { volume: 0.4 });
			return;
		}
		sound.play('select', { pitch: 0.9 + this.passPick.length * 0.08 });
	}

	commitPass() {
		const run = this._run!;
		if (run.phase !== PHASE.PASS || this.passPick.length !== 3) return;
		this.act({ t: 'pass', cards: this.passPick.map((c) => c.id!) });
		this.passPick = [];
		this.aiTimer = AI_DELAY * 1.6;
		sound.play('reroll', { volume: 0.7 });
		this.bump();
	}

	// ------------------------------------------------------------------ tricks

	/**
	 * Cues for a card just played: hearts breaking (the first heart of the
	 * hand) and the queen of spades hitting the table.
	 */
	private cueCard(card: Card, seat: number, wasBroken: boolean) {
		const L = this.layout;
		const [x, y] = trickXY(L, seat);
		if (H.isQueenOfSpades(card)) {
			sound.play('queen_played');
			fx.shake(5);
			fx.burst(x, y, 16, [C.ink, C.bad], 160, { life: 0.5, size: 5 });
		} else if (card.suit === H.HEARTS && !wasBroken) {
			sound.play('hearts_broken');
			fx.burst(x, y, 22, [C.bad, hexHeart, C.ink], 220, { life: 0.8, size: 7 });
			this.showToast('Hearts are broken!', C.bad);
		}
	}

	private holdTrick(trick: Trick | null | undefined) {
		if (!trick) return;
		this.trickHold = { trick, timer: TRICK_HOLD };
		const [x, y] = trickXY(this.layout, trick.winner);
		if (trick.plays.some((p) => H.isQueenOfSpades(p.card))) {
			// The queen is taken: doom for you, a sly chime for anyone else.
			if (trick.winner === H.PLAYER) {
				this.streak = 0;
				sound.play('queen_taken');
				fx.shake(10);
				fx.burst(x, y, 30, [C.ink, C.bad], 140, { life: 1.0, size: 7, gravity: 300 });
				this.showToast(this.queenBroke ? 'You took the queen, and hearts are broken!' : 'You took the queen of spades!', C.bad);
			} else {
				sound.play('queen_dodged');
				fx.burst(x, y, 24, [C.good, C.goldLight], 220, { life: 0.8, size: 6 });
				this.showToast(`${H.SEAT_NAMES[trick.winner]} took the queen${this.queenBroke ? ', and hearts are broken' : ' of spades'}`, C.good);
			}
			if (this.queenBroke) setTimeout(() => sound.play('hearts_broken', { volume: 0.8 }), 650);
			this.queenBroke = false;
			return;
		}
		if (trick.winner === H.PLAYER) {
			if (trick.points > 0) {
				this.streak = 0;
				sound.play('trick_lose', { jitter: 0.04 });
			} else {
				this.streak++;
				sound.play('trick_win', { pitch: Math.min(1.5, 1 + 0.06 * (this.streak - 1)), volume: 0.7 });
			}
		} else if (trick.points > 0) {
			sound.play('coin', { volume: 0.6, jitter: 0.05 });
			fx.burst(x, y, 10 + trick.points, [C.bad, C.ink], 180, { life: 0.6, size: 6 });
		} else {
			sound.play('deal', { volume: 0.5 });
		}
	}

	endTrickHold() {
		const hold = this.trickHold;
		if (!hold) return;
		this.trickHold = null;
		const [x, y] = seatOrigin(this.layout, hold.trick.winner);
		const until = performance.now() + 450;
		const swept = [...hold.trick.plays.map((p) => p.card), ...hold.trick.kitty];
		this.sweeps = [...this.sweeps, ...swept.map((card) => ({ id: cardId(card), card, x, y, until }))];
		sound.play('deal', { volume: 0.6, pitch: 0.8 });
	}

	playCard(card: Card) {
		const run = this._run!;
		if (this.trickHold || !R.isPlayerTurn(run)) return;
		const wasBroken = run.hand.state!.heartsBroken;
		const tricks = this.act({ t: 'play', card: card.id! }).tricks!;
		sound.play('card_play', { jitter: 0.08 });
		this.cueCard(card, H.PLAYER, wasBroken);
		this.queenBroke = !wasBroken && card.suit !== H.HEARTS && run.hand.state!.heartsBroken;
		this.holdTrick(tricks[0]);
		this.aiTimer = AI_DELAY;
		this.bump();
	}

	playOut() {
		const run = this._run!;
		if (run.phase !== PHASE.PLAY) return;
		this.trickHold = null;
		this.act({ t: 'playOut' });
		sound.play('reroll');
		this.bump();
	}

	// ------------------------------------------------------------------ flow

	finishReveal() {
		const rv = this.reveal;
		if (!rv || rv.done) return;
		rv.shown = rv.items.length;
		rv.t = Math.max(rv.t, (rv.items.length + 1) * REVEAL_STEP);
	}

	continueAfterHand() {
		const run = this._run!;
		if (run.phase !== PHASE.HAND_SCORED || this.trickHold) return;
		if (this.reveal && !this.reveal.done) return this.finishReveal();
		this.act({ t: 'continue' });
		this.bump();
	}

	enterShop() {
		const run = this._run!;
		if (run.phase !== PHASE.BOARD_WON) return;
		sound.play('coin');
		this.act({ t: 'shop' });
		this.bump();
	}

	buy(i: number, x: number, y: number, card?: number) {
		const run = this._run!;
		if (!R.canBuy(run, i)[0]) return;
		const kind = run.shop!.items[i].kind;
		if ((kind === 'seal' || kind === 'pack') && card === undefined) {
			this.sealPick = i;
			this.pickAt = [x, y];
			sound.play('select');
			return;
		}
		this.sealPick = null;
		if (this.act({ t: 'buy', slot: i, card }).ok) {
			sound.play('coin');
			fx.burst(x, y, 30, C.confetti, 300, { life: 0.9 });
			fx.shake(3);
		}
		this.bump();
	}

	/** Use the waiting seal or pack item on a card. */
	placeSeal(id: number) {
		const i = this.sealPick;
		if (i === null) return;
		const run = this._run!;
		const item = run.shop!.items[i];
		if (item.kind === 'pack') {
			const ok = packs.canApply(run, item.def, run.pack.find((c) => c.id === id));
			if (!ok[0]) {
				this.showToast(`Can't: ${ok[1]}`, C.bad);
				sound.play('trick_lose', { volume: 0.5 });
				return;
			}
		}
		this.buy(i, this.pickAt[0], this.pickAt[1], id);
	}

	sellRelic(i: number) {
		this.act({ t: 'sellRelic', slot: i });
		sound.play('sell');
		this.bump();
	}

	reroll() {
		const run = this._run!;
		if (run.money < run.rerollCost) return;
		if (this.act({ t: 'reroll' }).ok) {
			sound.play('reroll');
			this.shopRolls++;
		}
		this.bump();
	}

	leaveShop() {
		this.act({ t: 'leave' });
		this.bump();
	}

	toMenu() {
		this.screen = 'menu';
	}

	escape() {
		if (this.screen === 'menu') this.showHelp = false;
		else if (this.sealPick !== null) this.sealPick = null;
		else this.screen = 'menu';
	}

	advance() {
		if (this.screen === 'menu') return this.newRun();
		const run = this._run!;
		if (this.trickHold) this.endTrickHold();
		else if (run.phase === PHASE.PASS) this.commitPass();
		else if (run.phase === PHASE.HAND_SCORED) this.continueAfterHand();
		else if (run.phase === PHASE.BOARD_WON) this.enterShop();
	}

	skipPress(): boolean {
		if (this.screen !== 'run') return false;
		if (this.trickHold) {
			this.endTrickHold();
			return true;
		}
		if (this.reveal && !this.reveal.done && this._run!.phase === PHASE.HAND_SCORED) {
			this.finishReveal();
			return true;
		}
		return false;
	}

	// ------------------------------------------------------------------ phases

	private onPhaseEnter(phase: string) {
		const run = this._run!;
		const L = this.layout;
		if (phase === PHASE.HAND_SCORED) {
			const r = run.hand.result!;
			this.reveal = new Reveal(r.lines.map((l) => ({ ...l })));
			if (r.shooter === H.PLAYER) {
				sound.play('board_won');
				fx.burst(L.tableCX, L.trickCY, 70, C.confetti, 460, { life: 1.6, size: 10 });
				fx.shake(10);
			} else if (r.shooter !== null) sound.play('down');
		} else if (phase === PHASE.BOARD_WON) {
			sound.play('board_won');
			fx.burst(L.tableCX, L.table.y + 240, 60, C.confetti, 420, { life: 1.4, size: 9 });
		} else if (phase === PHASE.GAME_OVER) sound.play('game_over');
		else if (phase === PHASE.VICTORY) {
			sound.play('board_won');
			for (let i = 0; i < 4; i++) fx.burst(L.tableCX + (i - 1.5) * 200, L.table.y + 200, 50, C.confetti, 460, { life: 1.8, size: 10 });
		} else if (phase === PHASE.PASS) {
			this.passPick = [];
		}
	}

	private updateReveal(dt: number) {
		const rv = this.reveal;
		if (!rv || rv.done) return;
		rv.t += dt;
		while (rv.shown < rv.items.length && rv.t >= (rv.shown + 1) * REVEAL_STEP) {
			rv.shown++;
			const item = rv.items[rv.shown - 1];
			if (item.mult || (item.xmult && item.xmult !== 1)) {
				sound.play('mult', { pitch: 1 + 0.04 * rv.shown });
				fx.shake(2.5);
			} else sound.play('tick', { pitch: 1 + 0.06 * rv.shown });
		}
		if (rv.shown >= rv.items.length && rv.t >= (rv.items.length + 1) * REVEAL_STEP) {
			rv.done = true;
			const r = this._run!.hand.result!;
			if (r.total > 0) {
				sound.play('total');
				sound.play('made');
				const strength = Math.min(14, 3 + Math.log10(Math.max(10, r.total)) * 2.4);
				fx.shake(strength);
				fx.burst(this.layout.tableCX + 150, rv.totalY, 18 + Math.floor(strength * 2), C.confetti, 320, { life: 1, size: 8 });
			}
		}
	}

	update(dt: number) {
		if (this.toast) {
			this.toastTimer -= dt;
			if (this.toastTimer <= 0) this.toast = null;
		}
		if (this.sweeps.length) {
			const now = performance.now();
			if (this.sweeps.some((s) => s.until <= now)) this.sweeps = this.sweeps.filter((s) => s.until > now);
		}
		const run = this._run;
		if (this.screen !== 'run' || !run) return;
		if (run.phase !== this.lastPhase) {
			this.lastPhase = run.phase;
			this.onPhaseEnter(run.phase);
		}
		if (this.trickHold) {
			this.trickHold.timer -= dt;
			if (this.trickHold.timer <= 0) this.endTrickHold();
			return;
		}
		this.updateReveal(dt);
		if (run.phase === PHASE.PLAY && !R.isPlayerTurn(run)) {
			this.aiTimer -= dt;
			if (this.aiTimer <= 0) {
				const wasBroken = run.hand.state!.heartsBroken;
				const step = this.act({ t: 'ai' }).step;
				sound.play('card_play', { jitter: 0.08 });
				if (step) {
					this.cueCard(step.card, step.seat, wasBroken);
					this.queenBroke = !wasBroken && step.card.suit !== H.HEARTS && !!run.hand.state?.heartsBroken;
				}
				this.holdTrick(step?.trick);
				this.aiTimer = AI_DELAY;
				this.bump();
			}
		}
	}
}

export const game = new Game();
