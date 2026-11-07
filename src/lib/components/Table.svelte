<!-- The table. Every card is one keyed sprite: your hand, the opponents'
     face-down hands, the trick, and cards sweeping to whoever won it. A card
     changing place (played, passed, received) flies there and flips. -->
<script lang="ts">
	import * as cards from '../rules/cards.ts';
	import * as H from '../rules/hearts.ts';
	import * as R from '../game/run.ts';
	import type { Card } from '../rules/cards.ts';
	import { game, cardId, PHASE } from '../app/game.svelte.ts';
	import { handSlots, opponentSlots, seatOrigin, trickXY, tossAngle, type Slot } from '../app/layout.ts';
	import { C, CARD_H, css } from '../ui/theme.ts';
	import * as sound from '../audio/sound.ts';
	import CardSprite from './CardSprite.svelte';
	import Button from './Button.svelte';
	import type { Placement } from './placement.ts';

	let { scale = 1 }: { scale?: number } = $props();

	const L = $derived(game.layout);
	const run = $derived(game.run!);
	const hand = $derived(game.hand);

	/** Each seat's cards right now: dealt hands while passing, live hands in play. */
	function seatCards(seat: number): Card[] {
		return hand.state ? hand.state.hands[seat] : hand.dealt[seat];
	}

	// ---------------------------------------------------------- your hand order
	const order = new WeakMap<object, number[]>();
	let orderV = $state(0);
	let hover = $state<number | null>(null);

	interface Drag {
		card: Card;
		id: number;
		pointerId: number;
		startX: number;
		startY: number;
		x: number;
		y: number;
		moved: boolean;
	}
	let drag = $state.raw<Drag | null>(null);
	let stageEl: HTMLElement | null = null;

	/** Display order: suits spades, hearts, diamonds, clubs, each low to high. */
	function bySuitLowToHigh(list: Card[]): Card[] {
		return list.slice().sort((a, b) => (a.suit !== b.suit ? b.suit - a.suit : a.rank - b.rank));
	}

	function ordered(input: Card[]): Card[] {
		void orderV;
		const list = bySuitLowToHigh(input);
		const saved = order.get(game.rawHand);
		if (!saved) return list;
		const rank = new Map(saved.map((id, i) => [id, i]));
		return list
			.map((c, i) => ({ c, k: rank.get(cardId(c)) ?? saved.length + i }))
			.sort((a, b) => a.k - b.k)
			.map((x) => x.c);
	}

	function preview(list: Card[]): Card[] {
		if (!drag?.moved || !list.includes(drag.card)) return list;
		const others = list.filter((c) => c !== drag!.card);
		let index = 0;
		for (const sl of handSlots(L, list)) if (sl.card !== drag.card && sl.cx < drag.x) index++;
		others.splice(index, 0, drag.card);
		return others;
	}

	const isTurn = $derived.by(() => {
		void game.v;
		return run.phase === PHASE.PLAY && R.isPlayerTurn(run) && !game.trickHold;
	});
	const legal = $derived.by(() => {
		void game.v;
		return new Set<Card>(isTurn ? H.legalPlays(hand.state!, H.PLAYER) : []);
	});
	const passing = $derived(run.phase === PHASE.PASS);
	const slots = $derived.by((): Slot[] => {
		void game.v;
		void drag;
		void orderV;
		return handSlots(L, preview(ordered(seatCards(H.PLAYER))));
	});

	const placements = $derived.by((): Placement[] => {
		void game.v;
		const out: Placement[] = [];
		const now = performance.now();
		const raw = game.rawHand;
		let intro = game.handIntro.get(raw);
		if (intro === undefined) {
			intro = now;
			game.handIntro.set(raw, now);
		}
		const fresh = now - intro < 400;
		const pick = new Set(game.passPick);

		// Your hand.
		slots.forEach((s, idx) => {
			const id = cardId(s.card);
			const picked = pick.has(s.card);
			const canAct = passing || legal.has(s.card);
			const hovered = hover === id && canAct && !drag?.moved;
			const lift = picked ? 30 : hovered ? 22 : canAct && isTurn ? 8 : 0;
			const from = hand.receivedFrom.get(s.card);
			const isNew = hand.received.includes(s.card) && hand.state && hand.state.played.length < 4;
			let spawn: Placement['spawn'];
			if (fresh) {
				const o = seatOrigin(L, H.PLAYER);
				spawn = { x: o[0], y: o[1], delay: idx * 0.045, faceUp: false, sound: true };
			} else if (from) {
				const o = seatOrigin(L, from);
				spawn = { x: o[0], y: o[1], r: 0.5, faceUp: false };
			}
			if (drag?.moved && drag.id === id) {
				out.push({ id, card: s.card, x: drag.x, y: drag.y, r: 0, s: 1.14, faceUp: true, z: 95, lift: 26,
					highlight: legal.has(s.card) && overTrick(drag.x, drag.y) ? css(C.good) : null });
				return;
			}
			out.push({
				id,
				card: s.card,
				x: s.cx,
				y: s.cy - lift,
				r: hovered || picked ? 0 : s.r,
				s: hovered ? 1.1 : 1,
				faceUp: true,
				z: hovered ? 45 : 10 + idx,
				lift,
				dim: isTurn && !legal.has(s.card),
				highlight: picked ? css(C.ploy) : isNew ? css(C.brass) : hovered ? css(C.brass) : null,
				idle: s.idle,
				flipDelay: fresh ? 0.28 + idx * 0.025 : 0.1,
				hovered,
				spawn
			});
		});

		// Opponents' face-down hands.
		for (const seat of [cards.WEST, cards.NORTH, cards.EAST]) {
			const list = seatCards(seat);
			const spots = opponentSlots(L, seat, list.length);
			const o = seatOrigin(L, seat);
			list.forEach((c, i) => {
				const sp = spots[i];
				out.push({
					id: cardId(c),
					card: c,
					x: sp.x,
					y: sp.y,
					r: sp.r,
					s: sp.s,
					faceUp: false,
					z: 5 + i,
					spawn: fresh ? { x: o[0], y: o[1], delay: 0.15 + i * 0.03, faceUp: false } : undefined
				});
			});
		}

		// The trick, or the one held after it finished.
		const plays = game.trickHold ? game.trickHold.trick.plays : (hand.state?.trick ?? []);
		const winner = game.trickHold?.trick.winner;
		plays.forEach((p, i) => {
			const [x, y] = trickXY(L, p.seat);
			const o = seatOrigin(L, p.seat);
			const won = winner === p.seat;
			out.push({
				id: cardId(p.card),
				card: p.card,
				x,
				y,
				r: tossAngle(p.card),
				s: won ? 1.08 : 1,
				faceUp: true,
				z: 60 + i,
				lift: won ? 10 : 2,
				highlight: won ? css(game.trickHold!.trick.points > 0 ? C.bad : C.brass) : null,
				flipDelay: 0,
				spawn: { x: o[0], y: o[1], r: 0, faceUp: true }
			});
		});

		const placed = new Set(out.map((p) => p.id));
		for (const sw of game.sweeps) {
			if (placed.has(sw.id)) continue;
			out.push({ id: sw.id, card: sw.card, x: sw.x, y: sw.y, r: tossAngle(sw.card) + 0.4, s: 0.5, faceUp: true, z: 70, fade: true });
		}
		return out;
	});

	// ---------------------------------------------------------- input
	let lastHover: number | null = null;
	$effect(() => {
		if (hover !== null && hover !== lastHover) sound.play('card_hover', { jitter: 0.15, volume: 0.6 });
		lastHover = hover;
	});

	function stagePoint(e: PointerEvent): [number, number] {
		const stage = ((e.target as HTMLElement).closest?.('.stage') as HTMLElement) ?? stageEl!;
		const r = stage.getBoundingClientRect();
		const k = stage.offsetWidth / r.width;
		return [(e.clientX - r.left) * k, (e.clientY - r.top) * k];
	}

	function overTrick(x: number, y: number): boolean {
		const dx = (x - L.tableCX) / L.ovalRX,
			dy = (y - L.trickCY) / L.ovalRY;
		return dx * dx + dy * dy < 1;
	}

	let lastPointer = 'mouse';
	let dragSlot: Slot | null = null;

	function down(e: PointerEvent, s: Slot) {
		lastPointer = e.pointerType;
		if (e.button !== 0) return;
		stageEl = (e.target as HTMLElement).closest('.stage') as HTMLElement;
		const [x, y] = stagePoint(e);
		dragSlot = s;
		drag = { card: s.card, id: cardId(s.card), pointerId: e.pointerId, startX: x, startY: y, x, y, moved: false };
	}

	function move(e: PointerEvent) {
		if (!drag || e.pointerId !== drag.pointerId) return;
		const [x, y] = stagePoint(e);
		const moved = drag.moved || Math.hypot(x - drag.startX, y - drag.startY) > 8;
		if (moved && !drag.moved) {
			hover = null;
			sound.play('card_hover', { jitter: 0.1, volume: 0.6 });
		}
		drag = { ...drag, x, y, moved };
	}

	function up(e: PointerEvent) {
		const d = drag;
		if (!d || e.pointerId !== d.pointerId) return;
		drag = null;
		const s = dragSlot;
		dragSlot = null;
		if (!d.moved) {
			if (s) activate(s);
			return;
		}
		if (legal.has(d.card) && overTrick(d.x, d.y)) return game.playCard(d.card);
		// Keep the new order for the rest of the hand.
		const list = ordered(seatCards(H.PLAYER));
		const others = list.filter((c) => c !== d.card);
		let index = 0;
		for (const sl of handSlots(L, list)) if (sl.card !== d.card && sl.cx < d.x) index++;
		others.splice(index, 0, d.card);
		order.set(game.rawHand, others.map(cardId));
		orderV++;
		sound.play('card_play', { jitter: 0.1, volume: 0.5 });
	}

	function activate(s: Slot) {
		const id = cardId(s.card);
		if (passing) {
			game.togglePass(s.card);
			return;
		}
		if (!legal.has(s.card)) return;
		const small = s.w * scale < 44;
		if (lastPointer !== 'mouse' && small && hover !== id) {
			hover = id;
			return;
		}
		hover = null;
		game.playCard(s.card);
	}

	// ---------------------------------------------------------- labels
	const livePoints = $derived.by(() => {
		void game.v;
		return hand.state ? H.pointsTaken(hand.state) : [0, 0, 0, 0, 0];
	});
	const turn = $derived(hand.state && !hand.state.complete ? hand.state.turn : null);
	const passTo = $derived(hand.passDir === 'hold' ? null : H.SEAT_NAMES[H.passTarget(H.PLAYER, hand.passDir)]);

	const trickText = $derived.by(() => {
		const t = game.trickHold?.trick;
		if (!t) return null;
		if (t.winner === H.PLAYER) return t.points > 0 ? { text: `You take ${t.points} point${t.points > 1 ? 's' : ''}`, good: false } : { text: 'Your trick, no points', good: true };
		return t.points > 0 ? { text: `${H.SEAT_NAMES[t.winner]} takes ${t.points}`, good: true } : { text: `${H.SEAT_NAMES[t.winner]}'s trick`, good: true };
	});
</script>

<svelte:window onpointermove={move} onpointerup={up} onpointercancel={() => (drag = null)} />

<div
	class="oval"
	style:left="{L.tableCX - L.ovalRX}px"
	style:top="{L.trickCY - L.ovalRY}px"
	style:width="{L.ovalRX * 2}px"
	style:height="{L.ovalRY * 2}px"
></div>

{#each [cards.WEST, cards.NORTH, cards.EAST] as seat (seat)}
	{@const S = L.seats[seat]}
	<div class="seat-label" class:active={turn === seat} style:left="{S.labelX}px" style:top="{S.labelY}px" style:text-align={S.align}>
		{H.SEAT_NAMES[seat].toUpperCase()}
		{#if livePoints[seat] > 0}<span class="pts">{livePoints[seat]}</span>{/if}
		{#if turn === seat}<span class="thinking"></span>{/if}
	</div>
{/each}

{#each placements as p (p.id)}
	<CardSprite {p} />
{/each}

{#each slots as s (cardId(s.card))}
	{@const actionable = passing || legal.has(s.card)}
	<button
		class="slot"
		class:actionable
		aria-label={cards.name(s.card)}
		style:left="{s.x}px"
		style:top="{L.handY - 30}px"
		style:width="{s.w}px"
		style:height="{CARD_H + 30}px"
		onpointerenter={(e) => e.pointerType === 'mouse' && actionable && (hover = cardId(s.card))}
		onpointerleave={(e) => e.pointerType === 'mouse' && hover === cardId(s.card) && (hover = null)}
		onpointerdown={(e) => down(e, s)}
		onclick={(e) => e.detail === 0 && activate(s)}
	></button>
{/each}

<div class="you-label" class:active={turn === H.PLAYER} style:left="{L.tableCX - 200}px" style:top="{L.handY - 54}px">
	SOUTH · You
	{#if livePoints[H.PLAYER] > 0}<span class="pts">{livePoints[H.PLAYER]}</span>{/if}
	{#if isTurn}<span class="your-play">Your play</span>{/if}
</div>

{#if passing}
	<div class="pass-bar" style:left="{L.tableCX - 210}px" style:top="{L.trickCY - 40}px">
		<div class="pass-title">Pass three cards {hand.passDir} {passTo ? `to ${passTo}` : ''}</div>
		<div class="pass-sub">{game.passPick.length} of 3 chosen · tap cards to pick them</div>
		<Button enabled={game.passPick.length === 3} pulse sound={false} onclick={() => game.commitPass()} style="width: 200px"
			>Pass {hand.passDir === 'left' ? '←' : hand.passDir === 'right' ? '→' : '↑'}</Button
		>
	</div>
{/if}

{#if hand.passDir === 'hold' && run.phase === PHASE.PLAY && hand.state && hand.state.played.length === 0}
	<div class="hold-note" style:left="{L.tableCX - 150}px" style:top="{L.trickCY - 14}px">No passing this hand</div>
{/if}

{#if trickText}
	<div class="trick-text" class:good={trickText.good} style:left="{L.tableCX - 150}px" style:top="{L.trickCY + 150}px">
		{trickText.text}
	</div>
{/if}

{#if run.phase === PHASE.PLAY}
	<div class="playout" style:left="{L.playOut.x}px" style:top="{L.playOut.y}px">
		<Button
			variant="plain"
			size="sm"
			style="width: {L.playOut.w}px; height: {L.playOut.h}px; font-size: 17px"
			title="Let the autopilot finish this hand for you."
			sound={false}
			onclick={() => game.playOut()}>Play it out</Button
		>
	</div>
{/if}

<style>
	.oval {
		position: absolute;
		border-radius: 50%;
		background: rgba(14, 45, 32, 0.55);
		border: 2px solid rgba(138, 106, 44, 0.6);
		box-shadow:
			inset 0 0 0 6px rgba(14, 45, 32, 0.55),
			inset 0 0 0 8px rgba(138, 106, 44, 0.6);
		pointer-events: none;
	}
	.seat-label,
	.you-label {
		position: absolute;
		width: 200px;
		font-size: 14px;
		color: var(--ink-dim);
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
		pointer-events: none;
		z-index: 50;
	}
	.seat-label {
		width: 140px;
	}
	.you-label {
		width: 400px;
		text-align: center;
	}
	.active {
		color: var(--brass);
	}
	.pts {
		display: inline-block;
		margin-left: 6px;
		padding: 0 7px;
		border-radius: 9px;
		background: var(--bad);
		color: var(--ink);
		font-weight: 700;
		font-size: 13px;
		text-shadow: none;
	}
	.thinking {
		display: inline-block;
		width: 8px;
		height: 8px;
		margin-left: 6px;
		border-radius: 50%;
		background: var(--brass);
		animation: blink 0.78s ease-in-out infinite;
	}
	@keyframes blink {
		50% {
			opacity: 0.1;
		}
	}
	.your-play {
		margin-left: 8px;
		color: var(--brass);
		animation: blink 1.25s ease-in-out infinite;
	}
	.slot {
		position: absolute;
		z-index: 80;
		background: transparent;
		border: none;
		padding: 0;
		cursor: grab;
		touch-action: none;
		-webkit-tap-highlight-color: transparent;
	}
	.slot.actionable {
		cursor: pointer;
	}
	.pass-bar {
		position: absolute;
		width: 420px;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 14px;
		background: var(--sidebar);
		border: 2px solid var(--ploy);
		border-radius: 10px;
		box-shadow: 3px 5px 0 rgba(0, 0, 0, 0.35);
		z-index: 85;
	}
	.pass-title {
		font-size: 22px;
		font-weight: 700;
	}
	.pass-sub {
		font-size: 14px;
		color: var(--ink-dim);
		margin-bottom: 6px;
	}
	.hold-note,
	.trick-text {
		position: absolute;
		width: 300px;
		text-align: center;
		font-size: 20px;
		font-weight: 700;
		color: var(--ink-dim);
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
		pointer-events: none;
		z-index: 75;
	}
	.trick-text {
		color: var(--bad);
	}
	.trick-text.good {
		color: var(--good);
	}
	.playout {
		position: absolute;
		z-index: 85;
	}
</style>
