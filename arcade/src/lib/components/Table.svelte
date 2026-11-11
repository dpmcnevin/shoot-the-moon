<!-- The table, drawn from a game's TableView: four seats, the trick in the
     middle, your hand along the bottom. Cards are keyed by suit and rank, so
     a card glides from a hand into the trick. -->
<script lang="ts">
	import { arcade } from '../app.svelte.ts';
	import { cardFace, cardBack } from '../ui/images.ts';
	import * as cards from '$kit/src/core/rules/cards.ts';
	import * as R from '$kit/src/run/run.ts';
	import type { Card } from '$kit/src/core/rules/cards.ts';
	import type { Pos } from '../games/types.ts';

	const X0 = 270,
		W = 1010,
		CX = X0 + W / 2,
		CY = 300,
		CW = 80,
		CH = 112;

	const view = $derived((void arcade.v, arcade.ui!.view(arcade.run!)));
	const pre = $derived((void arcade.v, arcade.run!.phase === R.PHASE.PRE));
	const key = (c: Card) => `${c.suit}-${c.rank}`;

	interface Sprite {
		k: string;
		card: Card;
		up: boolean;
		x: number;
		y: number;
		s: number;
		z: number;
		click?: () => void;
		dim?: boolean;
		lift?: boolean;
	}

	const TRICK: Record<Pos, [number, number]> = { N: [0, -96], S: [0, 96], W: [-130, 0], E: [130, 0] };

	const sprites = $derived.by(() => {
		const out: Sprite[] = [];
		for (const seat of view.seats) {
			const n = seat.cards.length;
			if (seat.pos === 'S') {
				const s = 1.3,
					w = CW * s;
				const gap = n > 1 ? Math.min(58, (880 - w) / (n - 1)) : 0;
				const x0 = CX - (w + gap * (n - 1)) / 2 + w / 2;
				seat.cards.forEach((c, i) => {
					const k = key(c);
					const picking = pre && !!arcade.ui!.pick;
					const legal = view.legal.has(k) && seat.playable;
					out.push({
						k, card: c, up: true, x: x0 + i * gap, y: 720 - (CH * s) / 2 - 22, s, z: 10 + i,
						lift: arcade.picked.includes(k),
						dim: !pre && view.legal.size > 0 && seat.playable && !legal,
						click: picking ? () => arcade.togglePick(k) : legal ? () => arcade.game({ t: 'play', card: cards.code(c) }) : undefined
					});
				});
			} else if (seat.pos === 'N') {
				const s = seat.faceUp ? 0.95 : 0.55,
					gap = seat.faceUp ? 40 : 22;
				const x0 = CX - (gap * (n - 1)) / 2;
				seat.cards.forEach((c, i) => {
					const k = key(c);
					const legal = view.legal.has(k) && seat.playable;
					out.push({
						k, card: c, up: seat.faceUp, x: x0 + i * gap, y: seat.faceUp ? 100 : 72, s, z: 5 + i,
						dim: seat.playable && view.legal.size > 0 && !legal,
						click: legal ? () => arcade.game({ t: 'play', card: cards.code(c) }) : undefined
					});
				});
			} else {
				const x = seat.pos === 'W' ? X0 + 60 : X0 + W - 60;
				const y0 = CY - (16 * (n - 1)) / 2;
				seat.cards.forEach((c, i) => out.push({ k: key(c), card: c, up: false, x, y: y0 + i * 16, s: 0.55, z: 5 + i }));
			}
		}
		view.trick.forEach((t, i) => {
			const [dx, dy] = TRICK[t.pos];
			out.push({ k: key(t.card), card: t.card, up: true, x: CX + dx, y: CY + dy, s: 1.15, z: 50 + i });
		});
		return out;
	});

	const LABEL: Record<Pos, [number, number]> = { N: [CX, 16], S: [CX, 520], W: [X0 + 60, CY - 150], E: [X0 + W - 60, CY - 150] };
</script>

<div class="table">
	{#each view.seats as seat (seat.pos)}
		<div class="label" class:active={seat.active} style:left="{LABEL[seat.pos][0]}px" style:top="{LABEL[seat.pos][1]}px">
			{seat.name}{#if seat.tally}<span class="tally">{seat.tally}</span>{/if}
		</div>
	{/each}
	{#if view.banner}<div class="banner" style:left="{CX}px">{view.banner}</div>{/if}
	{#each sprites as sp (sp.k)}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
		<img
			class="card"
			class:click={!!sp.click}
			class:dim={sp.dim}
			src={sp.up ? cardFace(sp.card, view.trump === sp.card.suit) : cardBack(arcade.ui!.back)}
			alt=""
			draggable="false"
			style:left="{sp.x - (CW * sp.s) / 2}px"
			style:top="{sp.y - (CH * sp.s) / 2 - (sp.lift ? 26 : 0)}px"
			style:width="{CW * sp.s}px"
			style:height="{CH * sp.s}px"
			style:z-index={sp.z}
			onclick={sp.click}
		/>
	{/each}
</div>

<style>
	.table {
		position: absolute;
		inset: 0;
	}
	.card {
		position: absolute;
		image-rendering: pixelated;
		transition:
			left 0.28s ease,
			top 0.28s ease,
			width 0.28s ease,
			height 0.28s ease,
			filter 0.15s;
		filter: drop-shadow(0 4px 0 rgba(0, 0, 0, 0.35));
	}
	.card.click {
		cursor: pointer;
	}
	.card.click:hover {
		transform: translateY(-10px);
	}
	.card.dim {
		filter: brightness(0.55) drop-shadow(0 4px 0 rgba(0, 0, 0, 0.35));
	}
	.label {
		position: absolute;
		transform: translateX(-50%);
		font-size: 16px;
		color: var(--ink-dim);
		white-space: nowrap;
		z-index: 70;
	}
	.label.active {
		color: var(--brass);
	}
	.tally {
		margin-left: 8px;
		padding: 0 6px;
		background: var(--panel);
		color: var(--ink);
	}
	.banner {
		position: absolute;
		top: 468px;
		transform: translateX(-50%);
		font-size: 15px;
		color: var(--brass);
		letter-spacing: 0.06em;
		z-index: 60;
	}
</style>
