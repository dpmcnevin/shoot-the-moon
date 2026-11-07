<!-- Choose which card a seal goes on: the whole pack, suit by suit. Cards
     that already carry a seal show it (a new seal replaces the old one). -->
<script lang="ts">
	import { scale, fade } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import * as cards from '../rules/cards.ts';
	import { SEALS, sealOf } from '../game/seals.ts';
	import { game } from '../app/game.svelte.ts';
	import { cardFace } from '../ui/images.ts';
	import { settings } from '../ui/settings.svelte.ts';
	import SealBadge from './SealBadge.svelte';
	import Button from './Button.svelte';

	const run = $derived(game.run!);
	const item = $derived(run.shop!.items[game.sealPick!]);
	const def = $derived(item.kind === 'seal' ? item.def : SEALS.gilded);
	const suits = [4, 3, 2, 1].map((s) => cards.RANKS.map((r) => cards.card(s, r)));
	let hovered = $state<string | null>(null);
	const hoveredName = $derived.by(() => {
		if (!hovered) return null;
		const c = suits.flat().find((x) => cards.code(x) === hovered)!;
		const existing = sealOf(run.seals, c);
		return existing ? `${cards.name(c)} (replaces its ${SEALS[existing].name})` : cards.name(c);
	});
</script>

<div class="backdrop" role="presentation" onclick={() => (game.sealPick = null)} transition:fade={{ duration: 120 }}></div>
<div class="picker" transition:scale={{ start: 0.7, duration: 300, easing: backOut }}>
	<div class="head">
		<SealBadge seal={def.key} size={40} />
		<div>
			<h2>Choose a card for the {def.name}</h2>
			<div class="dim">{def.text}.</div>
		</div>
	</div>
	<div class="grid">
		{#each suits as row, ri (ri)}
			<div class="row">
				{#each row as c (cards.code(c))}
					{@const code = cards.code(c)}
					{@const existing = sealOf(run.seals, c)}
					<button
						class="card"
						class:pixel={settings.pixelCards}
						aria-label="Seal {cards.name(c)}"
						onpointerenter={() => (hovered = code)}
						onpointerleave={() => hovered === code && (hovered = null)}
						onclick={() => game.placeSeal(code)}
					>
						<img src={cardFace(c, false, settings.pixelCards, settings.fourColor)} alt="" draggable="false" />
						{#if existing}<span class="badge"><SealBadge seal={existing} size={18} /></span>{/if}
					</button>
				{/each}
			</div>
		{/each}
	</div>
	<div class="foot">
		<span class="dim">{hoveredName ?? `Costs $${item.cost}`}</span>
		<Button variant="plain" onclick={() => (game.sealPick = null)} style="width: 140px">Cancel</Button>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		z-index: 300;
	}
	.picker {
		position: absolute;
		left: 50%;
		top: 50%;
		translate: -50% -50%;
		width: min(940px, calc(100% - 20px));
		box-sizing: border-box;
		padding: 18px 22px;
		background: var(--panel);
		border: 2px solid var(--brass-dim);
		border-radius: 10px;
		box-shadow: 4px 6px 0 rgba(0, 0, 0, 0.35);
		z-index: 310;
	}
	.head {
		display: flex;
		gap: 14px;
		align-items: center;
		margin-bottom: 14px;
	}
	h2 {
		margin: 0;
		font-size: 24px;
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
	}
	.dim {
		color: var(--ink-dim);
		font-size: 15px;
	}
	.grid {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.row {
		display: grid;
		grid-template-columns: repeat(13, 1fr);
		gap: 4px;
	}
	.card {
		position: relative;
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
		aspect-ratio: 80 / 112;
		border-radius: 5px;
		transition: transform 0.1s;
		touch-action: manipulation;
	}
	.card img {
		width: 100%;
		height: 100%;
		display: block;
		border-radius: 5px;
		box-shadow: 1px 2px 0 rgba(0, 0, 0, 0.35);
	}
	.card.pixel img {
		image-rendering: pixelated;
	}
	.card:hover {
		transform: translateY(-4px) scale(1.06);
		z-index: 2;
	}
	.badge {
		position: absolute;
		right: -3px;
		top: -3px;
		display: flex;
	}
	.foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 14px;
	}
</style>
